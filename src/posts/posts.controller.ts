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
  Post as PostRoute,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { BboxDto } from 'src/places/dto/bbox.dto';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @UseGuards(JwtAuthGuard)
  @PostRoute()
  @UseInterceptors(FileInterceptor('imageFile'))
  create(
    @Body() createPostDto: CreatePostDto,
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const userId = req.user.sub;
    return this.postsService.create(createPostDto, userId, file);
  }

  @Get()
  findAll(@Query() bboxDto: BboxDto, @Request() req) {
    const userId = req.user?.sub;
    const hasBbox = Object.keys(bboxDto).length > 0;
    return this.postsService.findAll(hasBbox ? bboxDto : undefined, userId);
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
  @PostRoute(':id/like')
  likePost(@Param('id') id: string, @Request() req) {
    const userId = req.user.sub;
    return this.postsService.like(id, userId);
  }

  @UseGuards(JwtAuthGuard)
  @PostRoute(':id/dislike')
  dislikePost(@Param('id') id: string, @Request() req) {
    const userId = req.user.sub;
    return this.postsService.dislike(id, userId);
  }
}
