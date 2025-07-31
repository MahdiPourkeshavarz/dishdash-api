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
    const semanticQuery =
      `${query.term || ''} ${query.atmosphere || ''}`.trim();
    if (!semanticQuery && !query.amenity) {
      return [];
    }

    const queryVector = await this.uploadsService.generateEmbedding(
      `query: ${semanticQuery}`,
    );

    const aggregationPipeline: any[] = [
      {
        $vectorSearch: {
          index: 'search_vector',
          path: 'search_embedding',
          queryVector: queryVector,
          numCandidates: 150,
          limit: 50,
        },
      },
      {
        $project: {
          placeId: 1,
          score: { $meta: 'vectorSearchScore' },
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
          newRoot: { $mergeObjects: ['$placeInfo', { score: '$score' }] },
        },
      },
      {
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
                    {
                      text: {
                        query: query.term || '',
                        path: 'name',
                      },
                    },
                  ],
                },
              },
            },
            { $addFields: { score: { $meta: 'searchScore' } } },
          ],
        },
      },
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
    ];

    return this.postsRepository.aggregate(aggregationPipeline).toArray();
  }
}
