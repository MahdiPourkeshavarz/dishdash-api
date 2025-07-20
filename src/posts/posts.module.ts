/* eslint-disable prettier/prettier */
import { forwardRef, Module } from '@nestjs/common';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { UploadsModule } from 'src/uploads/uploads.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Interaction } from 'src/interactions/entity/interaction.entity';
import { Post } from './entity/post.entity';
import { PlacesModule } from 'src/places/places.module';

@Module({
  imports: [
    UploadsModule,
    TypeOrmModule.forFeature([Post, Interaction]),
    forwardRef(() => PlacesModule),
  ],
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}
