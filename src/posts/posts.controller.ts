/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  create(@Body() createPostDto: CreatePostDto, @Request() req) {
    const userId = req.user.sub;
    return this.postsService.create(createPostDto, userId);
  }

  @Get()
  findAll() {
    return this.postsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.postsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updatePostDto: UpdatePostDto,
    @Request() req,
  ) {
    const userId = req.user.sub;
    return this.postsService.update(id, updatePostDto, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    const userId = req.user.sub;
    return this.postsService.remove(id, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/like')
  likePost(@Param('id') id: string, @Request() req) {
    const userId = req.user.sub;
    return this.postsService.like(id, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/dislike')
  dislikePost(@Param('id') id: string, @Request() req) {
    const userId = req.user.sub;
    return this.postsService.dislike(id, userId);
  }
}
