/* eslint-disable prettier/prettier */
import { forwardRef, Module } from '@nestjs/common';
import { PlacesController } from './places.controller';
import { PlacesService } from './places.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Place } from './entity/place.entity';
import { PostsModule } from 'src/posts/posts.module';
import { Rating } from 'src/interactions/entity/rating.entity';
import { InteractionsModule } from 'src/interactions/interactions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Place, Rating]),
    forwardRef(() => PostsModule),
    forwardRef(() => InteractionsModule),
  ],
  controllers: [PlacesController],
  providers: [PlacesService],
  exports: [PlacesService, TypeOrmModule.forFeature([Place])],
})
export class PlacesModule {}
