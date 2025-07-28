/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Place } from 'src/places/entity/place.entity';
import { Post } from 'src/posts/entity/post.entity';
import { UploadsService } from 'src/uploads/uploads.service';
import { MongoRepository } from 'typeorm';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: MongoRepository<Post>,
    private readonly uploadsService: UploadsService,
  ) {}

  async hybridSearch(searchTerm: string): Promise<(Post | Place)[]> {
    const queryVector = await this.uploadsService.generateEmbedding(
      `query: ${searchTerm}`,
    );

    const aggregationPipeline: any[] = [
      {
        $vectorSearch: {
          index: 'post_vector_index',
          path: 'search_embedding',
          queryVector: queryVector,
          numCandidates: 150,
          limit: 10,
        },
      },
      {
        $addFields: {
          resultType: 'post',
          score: { $meta: 'vectorSearchScore' },
        },
      },

      {
        $unionWith: {
          coll: 'place',
          pipeline: [
            {
              $search: {
                index: 'places_search',
                text: {
                  query: searchTerm,
                  path: ['name', 'tags.cuisine', 'tags.amenity'],
                  fuzzy: { maxEdits: 1 },
                },
              },
            },
            {
              $addFields: {
                resultType: 'place',
                score: { $meta: 'searchScore' },
              },
            },
          ],
        },
      },

      { $sort: { score: -1 } },
      { $limit: 20 },

      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    ];

    return this.postsRepository.aggregate(aggregationPipeline).toArray();
  }
}
