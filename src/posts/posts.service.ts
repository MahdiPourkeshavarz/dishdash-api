/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  ForbiddenException,
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

  async create(
    createPostDto: CreatePostDto,
    userId: string,
    file: Express.Multer.File,
  ): Promise<Post> {
    const { url: imageUrl } = await this.uploadsService.saveFile(file);
    const parsedPosition = JSON.parse(createPostDto.position);

    let placeId: string | undefined = undefined;
    if (createPostDto.osmId) {
      const place = await this.placesService.findOneByOsmId(
        createPostDto.osmId,
      );
      if (place) {
        placeId = place._id.toHexString();
      }
    }

    const newPost = this.postsRepository.create({
      description: createPostDto.description,
      satisfaction: createPostDto.satisfaction,
      areaName: createPostDto.areaName,
      imageUrl,
      position: parsedPosition,
      userId,
      place: placeId ? { _id: new ObjectId(placeId) } : undefined,
      likes: 0,
      dislikes: 0,
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
    if (!bbox) {
      return this.postsRepository.find({
        relations: ['user', 'place'],
      });
    }

    const { sw_lat, sw_lng, ne_lat, ne_lng } = bbox;

    return this.postsRepository.find({
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
      relations: ['user', 'place'],
    });
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
    const post = await this.findOne(id);

    if (post.userId.toString() !== userId) {
      throw new ForbiddenException('You are not allowed to edit this post.');
    }

    Object.assign(post, updatePostDto);
    return this.postsRepository.save(post);
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
