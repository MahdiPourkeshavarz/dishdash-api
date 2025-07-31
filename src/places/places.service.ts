/* eslint-disable prettier/prettier */
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

@Injectable()
export class PlacesService {
  constructor(
    @InjectRepository(Place)
    private readonly placesRepository: MongoRepository<Place>,
  ) {}

  async findById(id: string): Promise<Place | null> {
    if (!ObjectId.isValid(id)) {
      return null;
    }
    return this.placesRepository.findOneBy({ _id: new ObjectId(id) });
  }

  async findInBounds(bboxDto: BboxDto) {
    const { sw_lat, sw_lng, ne_lat, ne_lng } = bboxDto;

    const tehranBounds = {
      sw_lat: 35.52,
      sw_lng: 51.14,
      ne_lat: 35.82,
      ne_lng: 51.6,
    };

    const isInsideTehran =
      parseFloat(sw_lat) >= tehranBounds.sw_lat &&
      parseFloat(sw_lng) >= tehranBounds.sw_lng &&
      parseFloat(ne_lat) <= tehranBounds.ne_lat &&
      parseFloat(ne_lng) <= tehranBounds.ne_lng;

    if (isInsideTehran) {
      console.log('Fetching places from local database...');
      return this.placesRepository.find({
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
    } else {
      console.log('Fetching places from Overpass API and updating DB...');
      const bboxString = `${sw_lat},${sw_lng},${ne_lat},${ne_lng}`;
      const query = `[out:json][timeout:25];(node["amenity"~"restaurant|cafe|fast_food"](${bboxString}););out body;>;out skel qt;`;

      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch from Overpass API: ${response.status}`,
        );
      }
      const data = await response.json();
      const pois: any[] = data.elements;

      if (pois && pois.length > 0) {
        const placesToProcess = pois
          .map((poi) => {
            if (!poi || !poi.id || !poi.tags) return null;
            return {
              osmId: poi.id,
              name: poi.tags.name,
              position: [poi.lon, poi.lat],
              tags: poi.tags,
            };
          })
          .filter(Boolean);

        await Promise.all(
          placesToProcess.map((placeData) =>
            this.findOrCreateByOsmId(placeData),
          ),
        );
      }

      return pois;
    }
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
}
