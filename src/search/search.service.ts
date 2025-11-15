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
import { FARSI_FOOD_KEYWORDS } from './constants/food-keywords';

type PlaceWithContext = Place & {
  post_description?: string;
  source?: 'post' | 'place';
};

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

  async _findChatContext(query: string): Promise<PlaceWithContext[]> {
    const detectedKeywords = FARSI_FOOD_KEYWORDS.filter((keyword) =>
      query.includes(keyword),
    );

    const pipeline: any[] = [
      {
        $search: {
          index: 'places_search',
          compound: {
            should: [
              {
                text: {
                  query,
                  path: ['name', 'tags.cuisine', 'tags.name'],
                  fuzzy: { maxEdits: 1 },
                },
              },
              ...(detectedKeywords.length > 0
                ? [
                    {
                      text: {
                        query: detectedKeywords,
                        path: ['name', 'tags.cuisine', 'tags.name'],
                        score: { boost: { value: 5 } },
                      },
                    },
                  ]
                : []),
            ],
            minimumShouldMatch: 1,
          },
        },
      },
      {
        $addFields: {
          searchScore: { $meta: 'searchScore' },
          source: 'place',
        },
      },
      {
        $addFields: {
          smartRating: {
            $multiply: [
              { $ifNull: ['$averageRating', 0] },
              {
                $log10: {
                  $add: [{ $ifNull: ['$ratingCount', 0] }, 1],
                },
              },
            ],
          },
        },
      },
      {
        $addFields: {
          finalScore: { $add: ['$searchScore', '$smartRating'] },
        },
      },
      { $sort: { finalScore: -1 } },
      { $limit: 20 },

      {
        $project: {
          searchScore: 0,
          smartRating: 0,
          finalScore: 0,
        },
      },
    ];

    const result = await this.placesRepository.aggregate(pipeline).toArray();
    console.log('Final context results:', result.length); // Your log will now appear
    return result;
  }

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
      `${query.term || ''} ${convertedAtmosphere} ${convertedAmenity}`
        .trim()
        .replace(/\s\s+/g, ' ');

    let queryVector: number[] | null = null;

    if (semanticQuery) {
      try {
        const timeoutPromise = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 6000),
        );
        const embeddingPromise = this.uploadsService.generateEmbedding(
          `query: ${semanticQuery}`,
        );
        queryVector = await Promise.race([embeddingPromise, timeoutPromise]);
        if (queryVector)
          console.log('Embedding generated. Performing hybrid search.');
        else console.warn('Embedding timed out. Using text-only search.');
      } catch (error) {
        console.error('Embedding failed. Using text-only search.', error);
        queryVector = null;
      }
    }

    const pipeline: any[] = [
      {
        $search: {
          index: 'places_search',
          compound: {
            must: query.amenity
              ? [{ text: { query: query.amenity, path: 'tags.amenity' } }]
              : [],
            should: query.term
              ? [
                  {
                    autocomplete: {
                      query: query.term,
                      path: 'name',
                      fuzzy: { maxEdits: 1 },
                    },
                  },
                  { text: { query: query.term, path: 'name' } },
                ]
              : [],
            minimumShouldMatch: query.term ? 1 : 0,
          },
        },
      },
      { $addFields: { score: { $meta: 'searchScore' }, source: 'place' } },
      { $limit: 40 },
    ];

    if (queryVector) {
      pipeline.push({
        $unionWith: {
          coll: 'post',
          pipeline: [
            {
              $vectorSearch: {
                index: 'search_vector',
                path: 'search_embedding',
                queryVector: queryVector,
                numCandidates: 100,
                limit: 10,
              },
            },
            { $addFields: { score: { $meta: 'vectorSearchScore' } } },
            { $match: { score: { $gte: 0.9 } } },
            {
              $lookup: {
                from: 'place',
                localField: 'placeId',
                foreignField: '_id',
                as: 'placeDetails',
              },
            },
            { $unwind: '$placeDetails' },
            {
              $replaceRoot: {
                newRoot: {
                  $mergeObjects: [
                    '$placeDetails',
                    {
                      source: 'post',
                      post_description: '$description',
                      score: '$score',
                    },
                  ],
                },
              },
            },
          ],
        },
      });
    }

    pipeline.push(
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
      {
        $addFields: {
          popularityScore: {
            $multiply: [
              { $ifNull: ['$averageRating', 0] },
              { $log10: { $add: [{ $ifNull: ['$ratingCount', 0] }, 1] } },
            ],
          },
        },
      },
      {
        $addFields: {
          finalScore: {
            $add: ['$score', { $multiply: ['$popularityScore', 0.8] }],
          },
        },
      },
      { $sort: { finalScore: -1 } },
      { $limit: 50 },
    );

    return this.placesRepository.aggregate(pipeline).toArray();
  }
}
