/* eslint-disable prettier/prettier */

import { forwardRef, Module } from '@nestjs/common';
import { InteractionsController } from './interactions.controller';
import { InteractionsService } from './interactions.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WishlistItem } from './entity/wishlist.entity';
import { UsersModule } from 'src/users/users.module';
import { PlacesModule } from 'src/places/places.module';
import { Interaction } from './entity/interaction.entity';
import { Rating } from './entity/rating.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([WishlistItem, Interaction, Rating]),
    UsersModule,
    forwardRef(() => PlacesModule),
  ],
  controllers: [InteractionsController],
  providers: [InteractionsService],
  exports: [TypeOrmModule.forFeature([Rating]), InteractionsService],
})
export class InteractionsModule {}
