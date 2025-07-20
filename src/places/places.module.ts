/* eslint-disable prettier/prettier */
import { forwardRef, Module } from '@nestjs/common';
import { PlacesController } from './places.controller';
import { PlacesService } from './places.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Place } from './entity/place.entity';
import { PostsModule } from 'src/posts/posts.module';

@Module({
  imports: [TypeOrmModule.forFeature([Place]), forwardRef(() => PostsModule)],
  controllers: [PlacesController],
  providers: [PlacesService],
})
export class PlacesModule {}
