/* eslint-disable prettier/prettier */

import { Module } from '@nestjs/common';
import { InteractionsController } from './interactions.controller';
import { InteractionsService } from './interactions.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WishlistItem } from './entity/wishlist.entity';
import { UsersModule } from 'src/users/users.module';
import { PlacesModule } from 'src/places/places.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WishlistItem]),
    UsersModule,
    PlacesModule,
  ],
  controllers: [InteractionsController],
  providers: [InteractionsService],
})
export class InteractionsModule {}
