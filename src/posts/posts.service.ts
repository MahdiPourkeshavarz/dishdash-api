/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, MongoRepository } from 'typeorm';
import { Post } from './entity/post.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { ObjectId } from 'mongodb';
import { UpdatePostDto } from './dto/update-post.dto';
import { Interaction } from 'src/interactions/entity/interaction.entity';
import { UploadsService } from 'src/uploads/uploads.service';
import { BboxDto } from 'src/places/dto/bbox.dto';
import { PlacesService } from 'src/places/places.service';
import { ConfigService } from '@nestjs/config';
import { Place } from 'src/places/entity/place.entity';

@Injectable()
export class PostsService {
  constructor(
    private readonly uploadsService: UploadsService,
    @InjectRepository(Post)
    private readonly postsRepository: MongoRepository<Post>,
    @InjectRepository(Interaction)
    private readonly interactionsRepository: MongoRepository<Interaction>,
    private readonly placesService: PlacesService,
  ) {}
  private _buildSearchEmbeddingText(
    createPostDto: CreatePostDto,
    place: Place | null,
  ): string {
    const satisfactionFarsiMap = {
      awesome: 'عالی و خوشمزه',
      good: 'خوب',
      bad: 'بد',
      disgusted: 'افتضاح',
    };
    const amenityFarsiMap = {
      restaurant: 'رستوران',
      cafe: 'کافه',
      fast_food: 'فست فود',
    };
    const tagFarsiMap: { [key: string]: string } = {
      pizza: 'پیتزا',
      hamburger: 'همبرگر',
      kebab: 'کباب',
      food: 'غذا',
      plate: 'بشقاب',
    };

    const placeName = place?.name || createPostDto.areaName || 'a location';
    const amenity = place?.tags?.amenity;
    const parsedTags = createPostDto.tags ? JSON.parse(createPostDto.tags) : [];
    const satisfaction = createPostDto.satisfaction;
    const description = createPostDto.description;

    const englishText =
      `A user review with a satisfaction level of '${satisfaction}'. The review is for the place: "${placeName}"${amenity ? `, which is a ${amenity}` : ''}. The user's description says: "${description}". ${parsedTags.length > 0 ? `Visual tags from the image are: ${parsedTags.join(', ')}.` : ''}`
        .trim()
        .replace(/\s\s+/g, ' ');

    const translatedFarsiTags = parsedTags.map(
      (tag) => tagFarsiMap[tag.toLowerCase()] || tag,
    );
    const farsiSatisfaction =
      satisfactionFarsiMap[satisfaction] || satisfaction;
    const farsiAmenity = amenity ? amenityFarsiMap[amenity] || amenity : '';
    const farsiText =
      `یک نظر کاربر با سطح رضایت '${farsiSatisfaction}'. این نظر برای مکان "${placeName}" است${farsiAmenity ? `، که یک ${farsiAmenity} میباشد` : ''}. توضیحات کاربر: "${description}". ${translatedFarsiTags.length > 0 ? `برچسب‌های بصری از تصویر: ${translatedFarsiTags.join('، ')}.` : ''}`
        .trim()
        .replace(/\s\s+/g, ' ');

    return `${englishText} || ${farsiText}`;
  }

  async create(
    createPostDto: CreatePostDto,
    userId: string,
    file: Express.Multer.File,
  ): Promise<Post> {
    const uploadResult = await this.uploadsService.uploadPostImage(file);
    const imageUrl = uploadResult.secure_url;
    const parsedPosition = JSON.parse(createPostDto.position);

    let placeId: string | undefined = undefined;
    let place: Place | null = null;
    if (createPostDto.osmId) {
      place = await this.placesService.findOneByOsmId(createPostDto.osmId);
      if (place) {
        placeId = place._id.toHexString();
      }
    }

    const parsedTags = createPostDto.tags ? JSON.parse(createPostDto.tags) : [];

    const textToEmbed = this._buildSearchEmbeddingText(createPostDto, place);

    const embedding = await this.uploadsService.generateEmbedding(textToEmbed);
    const newPost = this.postsRepository.create({
      description: createPostDto.description,
      satisfaction: createPostDto.satisfaction,
      areaName: createPostDto.areaName,
      imageUrl,
      position: parsedPosition,
      userId,
      place: place ? place : {},
      tags: parsedTags,
      likes: 0,
      dislikes: 0,
      search_embedding: embedding,
      placeId,
    });

    const savedPost = await this.postsRepository.save(newPost);

    const populatedPost = await this.postsRepository.findOne({
      where: { _id: savedPost._id },
      relations: ['user', 'place'],
    });

    if (!populatedPost) {
      throw new InternalServerErrorException(
        'Could not retrieve the created post.',
      );
    }

    return populatedPost;
  }

  async findAll(bbox?: BboxDto): Promise<Post[]> {
    // 1. Start building the aggregation pipeline.
    const pipeline: any[] = [];

    // 2. If a bounding box is provided, add the geospatial filter.
    if (bbox) {
      const { sw_lat, sw_lng, ne_lat, ne_lng } = bbox;
      pipeline.push({
        $match: {
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
    }

    // 3. Add the $lookup stages to join the 'user' and 'place' data.
    pipeline.push(
      {
        $lookup: {
          from: 'user', // The name of your user collection
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $lookup: {
          from: 'place', // The name of your place collection
          localField: 'placeId',
          foreignField: '_id',
          as: 'place',
        },
      },
      // 4. Use $unwind to convert the joined arrays into single objects.
      {
        $unwind: { path: '$user', preserveNullAndEmptyArrays: true },
      },
      {
        $unwind: { path: '$place', preserveNullAndEmptyArrays: true },
      },
      // 5. Use $project to explicitly define the final shape of the document.
      {
        $project: {
          // Exclude the large fields by setting them to 0
          search_embedding: 0,
          tags: 0,
          // Also exclude sensitive user data for security
          'user.password': 0,
          'user.refreshToken': 0,
        },
      },
    );

    // 6. Execute the aggregation pipeline.
    return this.postsRepository.aggregate(pipeline).toArray();
  }

  async findOne(id: string): Promise<Post> {
    if (!ObjectId.isValid(id)) {
      throw new NotFoundException(`Invalid ID format: ${id}`);
    }
    const post = await this.postsRepository.findOne({
      where: { _id: new ObjectId(id) },
      relations: ['user'],
    });

    if (!post) {
      throw new NotFoundException(`Post with ID "${id}" not found`);
    }
    return post;
  }

  async update(
    id: string,
    updatePostDto: UpdatePostDto,
    userId: string,
  ): Promise<Post> {
    const post = await this.postsRepository.findOne({
      where: { _id: new ObjectId(id) },
    });

    if (!post) {
      throw new NotFoundException(`Post with ID "${id}" not found`);
    }
    if (post.userId.toString() !== userId) {
      throw new ForbiddenException('You are not allowed to edit this post.');
    }

    Object.assign(post, updatePostDto);

    await this.postsRepository.save(post);

    const updatedAndPopulatedPost = await this.postsRepository.findOne({
      where: { _id: new ObjectId(id) },
      relations: ['user', 'place'],
    });

    if (!updatedAndPopulatedPost) {
      throw new InternalServerErrorException(
        'Could not retrieve updated post.',
      );
    }

    return updatedAndPopulatedPost;
  }

  async remove(id: string, userId: string): Promise<void> {
    const post = await this.findOne(id);

    if (post.userId.toString() !== userId) {
      throw new ForbiddenException('You are not allowed to delete this post.');
    }

    await this.postsRepository.delete(id);
  }

  async like(postId: string, userId: string): Promise<Post> {
    const post = await this.findOne(postId);
    const existingInteraction = await this.interactionsRepository.findOneBy({
      postId,
      userId,
    });

    if (existingInteraction) {
      if (existingInteraction.vote === 'like') {
        await this.interactionsRepository.delete(existingInteraction._id);
        post.likes--;
      } else {
        existingInteraction.vote = 'like';
        await this.interactionsRepository.save(existingInteraction);
        post.likes++;
        post.dislikes--;
      }
    } else {
      const newInteraction = this.interactionsRepository.create({
        postId,
        userId,
        vote: 'like',
      });
      await this.interactionsRepository.save(newInteraction);
      post.likes++;
    }

    return this.postsRepository.save(post);
  }

  async dislike(postId: string, userId: string): Promise<Post> {
    const post = await this.findOne(postId);
    const existingInteraction = await this.interactionsRepository.findOneBy({
      postId,
      userId,
    });

    if (existingInteraction) {
      if (existingInteraction.vote === 'dislike') {
        await this.interactionsRepository.delete(existingInteraction._id);
        post.dislikes--;
      } else {
        existingInteraction.vote = 'dislike';
        await this.interactionsRepository.save(existingInteraction);
        post.dislikes++;
        post.likes--;
      }
    } else {
      const newInteraction = this.interactionsRepository.create({
        postId,
        userId,
        vote: 'dislike',
      });
      await this.interactionsRepository.save(newInteraction);
      post.dislikes++;
    }

    return this.postsRepository.save(post);
  }
}
