/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Place } from 'src/places/entity/place.entity';
import { Post } from 'src/posts/entity/post.entity';
import { UploadsService } from 'src/uploads/uploads.service';
import { MongoRepository } from 'typeorm';
import { SearchDto } from './dto/search-query.dto';
import { PlacesService } from 'src/places/places.service';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: MongoRepository<Post>,
    private readonly uploadsService: UploadsService,
    private readonly placesService: PlacesService,
    @InjectRepository(Place)
    private readonly placesRepository: MongoRepository<Place>,
  ) {}

  async hybridSearch(query: SearchDto): Promise<(Post | Place)[]> {
    const convertedAtmosphere =
      query.atmosphere === 'خوب' ? 'خوب good' : 'شیک awesome';
    const convertedAmenity =
      query.amenity === 'restaurant'
        ? 'رستوران restaurant'
        : query.amenity === 'cafe'
          ? 'کافه cafe'
          : query.amenity === 'fast_food'
            ? 'فست فود پیتزا برگر سوخاری pizza burger fastfood'
            : '';
    const semanticQuery =
      `${query.term || ''} ${convertedAtmosphere || ''} ${convertedAmenity || ''}`.trim();

    let queryVector: number[] | null = null;

    // 1. Attempt to generate embedding with a timeout
    if (semanticQuery) {
      try {
        const timeoutPromise = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 6000),
        );
        const embeddingPromise = this.uploadsService.generateEmbedding(
          `query: ${semanticQuery}`,
        );
        const result = await Promise.race([embeddingPromise, timeoutPromise]);
        if (result) {
          queryVector = result;
        } else {
          console.warn('Embedding generation timed out.');
        }
      } catch (error) {
        console.error('Embedding generation failed:', error.message);
        queryVector = null;
      }
    }

    // 2. Build the main pipeline, starting on the 'posts' collection
    const aggregationPipeline: any[] = [];

    // 3. If embedding was successful, add the vector search part
    if (queryVector) {
      aggregationPipeline.push(
        {
          $vectorSearch: {
            index: 'search_vector',
            path: 'search_embedding',
            queryVector: queryVector,
            numCandidates: 150,
            limit: 10,
          },
        },
        {
          $addFields: {
            score: { $meta: 'vectorSearchScore' },
          },
        },
        // ✅ THEN, match on that new field.
        {
          $match: {
            score: { $gte: 0.9 },
          },
        },
        {
          $lookup: {
            from: 'place',
            localField: 'placeId',
            foreignField: '_id',
            as: 'placeInfo',
          },
        },
        { $unwind: '$placeInfo' },
        {
          $replaceRoot: {
            newRoot: {
              $mergeObjects: [
                '$placeInfo',
                { score: '$score', source: 'post' },
              ],
            },
          },
        },
      );
    }

    // 4. Always merge with the text search results from the 'places' collection
    aggregationPipeline.push({
      $unionWith: {
        coll: 'place',
        pipeline: [
          {
            $search: {
              index: 'places_search',
              compound: {
                should: [
                  {
                    autocomplete: {
                      query: query.term || '',
                      path: 'name',
                      fuzzy: { maxEdits: 1 },
                    },
                  },
                  { text: { query: query.term || '', path: 'name' } },
                ],
                minimumShouldMatch: query.term ? 1 : 0,
              },
            },
          },
          { $addFields: { score: { $meta: 'searchScore' }, source: 'place' } },
        ],
      },
    });

    // 5. Deduplicate and sort the final combined list
    aggregationPipeline.push(
      {
        $group: {
          _id: '$_id',
          doc: { $first: '$$ROOT' },
          maxScore: { $max: '$score' },
        },
      },
      {
        $replaceRoot: {
          newRoot: { $mergeObjects: ['$doc', { score: '$maxScore' }] },
        },
      },
      { $sort: { score: -1 } },
      { $limit: 50 },
    );

    // If there's no query term and no vector, the pipeline will be empty.
    if (aggregationPipeline.length === 1 && !queryVector) {
      // Only contains the unionWith
      return [];
    }

    return this.postsRepository.aggregate(aggregationPipeline).toArray();
  }
}
