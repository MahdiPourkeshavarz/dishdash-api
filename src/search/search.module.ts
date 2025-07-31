/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadsModule } from 'src/uploads/uploads.module';
import { Post } from 'src/posts/entity/post.entity';
import { Place } from 'src/places/entity/place.entity';
import { PlacesModule } from 'src/places/places.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Post, Place]),
    UploadsModule,
    PlacesModule,
  ],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
