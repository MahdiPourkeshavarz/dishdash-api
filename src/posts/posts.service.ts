/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { Post } from './entity/post.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { ObjectId } from 'mongodb';
import { UpdatePostDto } from './dto/update-post.dto';
import { Interaction } from 'src/interactions/entity/interaction.entity';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: MongoRepository<Post>,
    @InjectRepository(Interaction)
    private readonly interactionsRepository: MongoRepository<Interaction>,
    // private readonly placesService: PlacesService,
  ) {}

  async create(createPostDto: CreatePostDto, userId: string): Promise<Post> {
    const { osmId, ...postData } = createPostDto;

    const newPost = this.postsRepository.create({
      ...postData,
      userId,
      likes: 0,
      dislikes: 0,
    });

    // In the future, you would add the logic here to find or create a Place
    // based on the osmId and link it to the post.
    // const place = await this.placesService.findOrCreateByOsmId(osmId);
    // newPost.placeId = place._id.toHexString();

    return this.postsRepository.save(newPost);
  }

  async findAll(): Promise<Post[]> {
    return this.postsRepository.find({ relations: ['user'] });
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
