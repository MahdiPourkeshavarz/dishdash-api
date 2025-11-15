/* eslint-disable prettier/prettier */
/* eslint-disable no-irregular-whitespace */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { BboxDto } from './dto/bbox.dto';
import { Place } from './entity/place.entity';
import { MongoRepository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectId } from 'mongodb';
import { Poi } from './dto/poi.dto';
import { Rating } from 'src/interactions/entity/rating.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PlacesService {
  private readonly MATCH_MAX_DISTANCE_METERS = 20;
  private readonly SIMILARITY_THRESHOLD_PERCENT = 60;
  constructor(
    @InjectRepository(Place)
    private readonly placesRepository: MongoRepository<Place>,
    @InjectRepository(Rating)
    private readonly ratingRepository: MongoRepository<Rating>,
  ) {}

  async findById(id: string): Promise<Place | null> {
    if (!ObjectId.isValid(id)) {
      return null;
    }
    return this.placesRepository.findOneBy({ _id: new ObjectId(id) });
  }

  async findInBounds(bboxDto: BboxDto) {
    const { sw_lat, sw_lng, ne_lat, ne_lng } = bboxDto;

    console.log('Checking local database for places...');
    const localPlaces = await this.placesRepository.find({
      where: {
        position: {
          $geoWithin: {
            $box: [
              [parseFloat(sw_lng), parseFloat(sw_lat)],
              [parseFloat(ne_lng), parseFloat(ne_lat)],
            ],
          },
        },
      },
    });

    if (localPlaces.length > 0) {
      console.log(
        `Found ${localPlaces.length} places in the local database. Returning cached data.`,
      );
      return localPlaces;
    }

    console.log('No places found locally. Fetching from Overpass API...');
    const bboxString = `${sw_lat},${sw_lng},${ne_lat},${ne_lng}`;
    const query = `[out:json][timeout:25];(node["amenity"~"restaurant|cafe|fast_food"](${bboxString}););out body;>;out skel qt;`;

    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch from Overpass API: ${response.status}`);
    }
    const data = await response.json();
    const pois: any[] = data.elements;

    if (pois && pois.length > 0) {
      const placesToSave = pois
        .map((poi) => {
          if (!poi || !poi.id || !poi.tags || !poi.tags.name) return null;
          return {
            osmId: poi.id,
            name: poi.tags.name,
            position: [poi.lon, poi.lat],
            tags: poi.tags,
          };
        })
        .filter(Boolean);

      Promise.all(
        placesToSave.map((placeData) => this.findOrCreateByOsmId(placeData)),
      ).catch((err) => console.error('Error saving new places to DB:', err));
    }

    return pois;
  }

  async findOrCreateByOsmId(placeData: any): Promise<Place> {
    const existingPlace = await this.placesRepository.findOneBy({
      osmId: placeData.osmId,
    });

    if (existingPlace) {
      return existingPlace;
    }

    const newPlaceData = {
      osmId: placeData.osmId,
      name: placeData.tags.name || placeData.name,
      position: placeData.position,
      tags: placeData.tags,
    };

    const newPlace = this.placesRepository.create(newPlaceData);

    return this.placesRepository.save(newPlace);
  }

  async findOneByOsmId(osmId: number): Promise<Place | null> {
    return this.placesRepository.findOneBy({ osmId });
  }

  async seedDatabase() {
    const query = `
      [out:json][timeout:25];
      (
        node["amenity"~"restaurant|cafe|fast_food"](35.523976839685545, 51.14867584729524, 35.82007768096656, 51.60838554062815);
      );
      out body;
      >;
      out skel qt;
    `;

    try {
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!response.ok) {
        throw new Error(`Overpass API failed with status: ${response.status}`);
      }

      const data = await response.json();
      const pois: Poi[] = data.elements;

      if (!pois || pois.length === 0) {
        return { message: 'No places found to add.' };
      }

      const placesToInsert = pois
        .filter((poi) => poi.id && poi.tags?.name)
        .map((poi) => ({
          osmId: poi.id,
          name: poi.tags.name,
          position: [poi.lon, poi.lat] as [number, number],
          tags: poi.tags,
        }));

      const result = await this.placesRepository.insert(placesToInsert);

      return {
        message: 'Database seeded successfully!',
        count: result.raw.insertedCount,
      };
    } catch (error) {
      console.error('Seeding failed:', error);
      throw new InternalServerErrorException(
        'Failed to seed the database. The places might already exist.',
      );
    }
  }

  public async seedPlacesAndRatings(): Promise<void> {
    console.log('🌱 Starting database seeding process...');
    const startTime = Date.now();
    const stats = {
      total: 0,
      placesMatched: 0,
      placesCreated: 0,
      ratingsCreated: 0,
      errors: 0,
    };

    // Use a 'finally' block to ensure the summary always prints
    try {
      const scrapedPlaces = this.loadPlacesFromJson();
      stats.total = scrapedPlaces.length;

      for (let i = 0; i < scrapedPlaces.length; i++) {
        const scrapedPlace = scrapedPlaces[i];
        console.log(
          `\n[${i + 1}/${stats.total}] Processing: "${scrapedPlace.title}"`,
        );

        try {
          // STEP 1: Find or Create the Place
          const matchedPlace = await this.findMatchingPlace(
            scrapedPlace.title,
            scrapedPlace.coordinates.latitude,
            scrapedPlace.coordinates.longitude,
          );

          if (matchedPlace) {
            console.log(`   -> ✅ Matched existing place.`);
            stats.placesMatched++;

            // ✅ Update rating fields directly for matched places
            if (scrapedPlace.totalScore && scrapedPlace.reviewsCount) {
              await this.placesRepository.update(
                { _id: matchedPlace._id },
                {
                  averageRating: scrapedPlace.totalScore,
                  ratingCount: scrapedPlace.reviewsCount,
                },
              );
              console.log(
                `   -> ⭐ Updated ratings: avg=${scrapedPlace.totalScore}, count=${scrapedPlace.reviewsCount}`,
              );
              stats.ratingsCreated++;
            }
          } else {
            console.log(`   -> ➕ Creating new place.`);
          }
        } catch (error) {
          console.error(
            `   -> ❌ Error processing "${scrapedPlace.title}":`,
            error.message,
          );
          stats.errors++;
        }
      }
    } catch (error) {
      console.error(
        'A fatal error occurred during the seeding process:',
        error,
      );
      stats.errors++;
    } finally {
      const duration = (Date.now() - startTime) / 1000; // duration in seconds
      this.printSeedingSummary(stats, duration);
    }
  }

  async findMatchingPlace(
    title: string,
    latitude: number,
    longitude: number,
  ): Promise<Place | null> {
    const nearbyPlaces = await this.getNearbyPlaces(
      latitude,
      longitude,
      this.MATCH_MAX_DISTANCE_METERS,
    );

    let bestMatch: Place | null = null;
    let highestSimilarity = 0;
    let bestMatchInfo = { distance: 0, source: '' };

    // Check each nearby place to find the one with the highest similarity
    for (const place of nearbyPlaces) {
      const [lng, lat] = place.position;
      const distance = this.calculateDistance(latitude, longitude, lat, lng);

      // Check name similarity (primary name)
      const nameSimilarity = this.calculateSimilarity(title, place.name);
      if (nameSimilarity > highestSimilarity) {
        highestSimilarity = nameSimilarity;
        bestMatch = place;
        bestMatchInfo = { distance, source: 'name' };
      }

      // Check English name in tags
      if (place.tags?.['name:en']) {
        const enSimilarity = this.calculateSimilarity(
          title,
          place.tags['name:en'],
        );
        if (enSimilarity > highestSimilarity) {
          highestSimilarity = enSimilarity;
          bestMatch = place;
          bestMatchInfo = { distance, source: 'name:en' };
        }
      }
    }

    // Only return the best match if it meets the required similarity threshold
    if (highestSimilarity >= this.SIMILARITY_THRESHOLD_PERCENT) {
      console.log(
        `     Best match found: distance=${bestMatchInfo.distance.toFixed(2)}m, similarity=${highestSimilarity.toFixed(1)}% (${bestMatchInfo.source})`,
      );
      return bestMatch;
    }

    return null; // No suitable match found
  }

  /**
   * Get places near coordinates within maxDistance (meters)
   */
  private async getNearbyPlaces(
    latitude: number,
    longitude: number,
    maxDistance: number,
  ): Promise<Place[]> {
    return await this.placesRepository.find({
      where: {
        position: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude],
            },
            $maxDistance: maxDistance,
          },
        },
      },
    });
  }

  /**
   * Create new place in database
   */
  private async createPlace(
    name: string,
    latitude: number,
    longitude: number,
    categoryName?: string,
    website?: string,
    phone?: string,
  ): Promise<Place> {
    // Generate a unique 9-digit OSM ID
    const osmId = this.generateOsmId();

    const tags: Record<string, string> = {};

    if (categoryName) tags.amenity = categoryName;
    if (website) tags.website = website;
    if (phone) tags.phone = phone;

    const newPlace = this.placesRepository.create({
      osmId, // Add this line
      name,
      position: [longitude, latitude],
      tags,
    });

    return await this.placesRepository.save(newPlace);
  }

  private async addRatingsToPlace(
    place: Place,
    targetScore: number,
    count: number,
    startUserId: number,
  ): Promise<number> {
    const ratingScores = this.generateRatingDistribution(targetScore, count);
    const ratings: Rating[] = [];

    for (let i = 0; i < count; i++) {
      const userId = `user${startUserId + i}`;
      const score = ratingScores[i];
      const rating = this.ratingRepository.create({
        userId,
        placeId: place._id.toString(),
        score,
      });
      ratings.push(rating);
    }

    await this.ratingRepository.save(ratings);
    place.averageRating = targetScore;
    place.ratingCount = count;
    await this.placesRepository.save(place);
    return ratings.length;
  }

  private generateRatingDistribution(
    targetScore: number,
    count: number,
  ): number[] {
    const ratings: number[] = [];
    const baseRating = Math.floor(targetScore);
    const remainder = targetScore - baseRating;
    const higherCount = Math.round(remainder * count);
    const lowerCount = count - higherCount;

    for (let i = 0; i < lowerCount; i++) {
      ratings.push(baseRating);
    }
    for (let i = 0; i < higherCount; i++) {
      ratings.push(Math.min(baseRating + 1, 5));
    }

    const varianceCount = Math.min(Math.floor(count / 10), 5);
    for (let i = 0; i < varianceCount && i < ratings.length - 1; i++) {
      if (Math.random() > 0.5 && ratings[i] > 1) {
        ratings[i]--;
        if (ratings[i + 1] < 5) {
          ratings[i + 1]++;
        }
      }
    }
    return ratings;
  }

  private loadPlacesFromJson(): any[] {
    const jsonPath = path.join(__dirname, 'places_with_coordinates.json');
    if (!fs.existsSync(jsonPath)) {
      throw new InternalServerErrorException(
        `JSON file not found at: ${jsonPath}`,
      );
    }
    const fileContent = fs.readFileSync(jsonPath, 'utf-8');
    const scrapedData = JSON.parse(fileContent);
    const places = scrapedData.places || scrapedData;
    if (!Array.isArray(places)) {
      throw new InternalServerErrorException(
        'Invalid JSON format. Expected array of places.',
      );
    }
    return places;
  }

  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const normalized1 = this.normalizeString(str1);
    const normalized2 = this.normalizeString(str2);
    if (normalized1 === normalized2) return 100;
    const distance = this.levenshteinDistance(normalized1, normalized2);
    const maxLength = Math.max(normalized1.length, normalized2.length);
    const similarity = (1 - distance / maxLength) * 100;
    return Math.round(similarity * 100) / 100;
  }

  private normalizeString(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  }

  private printSeedingSummary(stats: any, duration: number): void {
    console.log('\n' + '='.repeat(80));
    console.log('🌱 SEEDING COMPLETE');
    console.log('='.repeat(80));
    console.log(`\n📈 Results:`);
    console.log(`   Total processed:     ${stats.total}`);
    console.log(
      `   ✅ Places matched:   ${stats.placesMatched} (${((stats.placesMatched / stats.total) * 100).toFixed(1)}%)`,
    );
    console.log(
      `   ➕ Places created:   ${stats.placesCreated} (${((stats.placesCreated / stats.total) * 100).toFixed(1)}%)`,
    );
    console.log(
      `   📊 Ratings created:  ${stats.ratingsCreated.toLocaleString()}`,
    );
    console.log(`   ❌ Errors:           ${stats.errors}`);
    console.log(`   ⏱️  Duration:         ${duration}s`);
    console.log(
      `   ⚡ Speed:            ${(stats.total / duration).toFixed(2)} places/sec`,
    );
    console.log('\n' + '='.repeat(80) + '\n');
  }

  private generateOsmId(): number {
    const min = 100000000; // 9 digits minimum
    const max = 999999999; // 9 digits maximum
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  async normalizePlaceCategories(): Promise<void> {
    const places = await this.placesRepository.find(); // Get all places from the database

    for (const place of places) {
      // Check if the 'amenity' needs normalization (i.e., categoryName exists)
      if (place.tags?.amenity) {
        const amenity = place.tags?.amenity.toLowerCase();
        let normalizedCategory = '';

        if (
          amenity === 'restaurant' ||
          amenity === 'cafe' ||
          amenity === 'fast_food'
        ) {
          normalizedCategory = amenity;
        } else if (amenity.includes('fast food')) {
          normalizedCategory = 'fast_food';
        } else if (amenity.includes('cafe')) {
          normalizedCategory = 'cafe';
        } else if (amenity.includes('restaurant')) {
          normalizedCategory = 'restaurant';
        }

        // If category is already normalized, skip update
        if (place.tags.amenity !== normalizedCategory) {
          // Update the category with normalized value
          place.tags.amenity = normalizedCategory;

          // Save the updated place back to the database
          await this.placesRepository.save(place);
          console.log(
            `Updated category for ${place.name} to ${normalizedCategory}`,
          );
        }
      }
    }

    console.log('Category normalization complete!');
  }

  async findPlacesWithEmptyAmenity(): Promise<Place[]> {
    const placesWithEmptyAmenity = await this.placesRepository.find({
      where: {
        $or: [
          { 'tags.amenity': { $exists: false } },
          { 'tags.amenity': '' },
          { 'tags.amenity': null },
        ],
      },
    });

    console.log('\n' + '='.repeat(80));
    console.log('🔍 PLACES WITH EMPTY AMENITY');
    console.log('='.repeat(80));
    console.log(
      `\n📊 Total places with empty amenity: ${placesWithEmptyAmenity.length}\n`,
    );

    if (placesWithEmptyAmenity.length > 0) {
      console.log('📋 Place names:');
      placesWithEmptyAmenity.forEach((place, index) => {
        console.log(`   ${index + 1}. ${place.name}`);
      });
    } else {
      console.log('✅ No places with empty amenity found!');
    }

    console.log('\n' + '='.repeat(80) + '\n');

    return placesWithEmptyAmenity;
  }

  async findPlacesWithEmptyPosition(): Promise<Place[]> {
    const placesWithEmptyAmenity = await this.placesRepository.find({
      where: {
        $or: [
          { position: { $exists: false } },
          { position: '' },
          { position: null },
        ],
      },
    });

    console.log('\n' + '='.repeat(80));
    console.log('🔍 PLACES WITH EMPTY position');
    console.log('='.repeat(80));
    console.log(
      `\n📊 Total places with empty position: ${placesWithEmptyAmenity.length}\n`,
    );

    if (placesWithEmptyAmenity.length > 0) {
      console.log('📋 Place names:');
      placesWithEmptyAmenity.forEach((place, index) => {
        console.log(`   ${index + 1}. ${place.name}`);
      });
    } else {
      console.log('✅ No places with empty position found!');
    }

    console.log('\n' + '='.repeat(80) + '\n');

    return placesWithEmptyAmenity;
  }
}
