/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, NotFoundException } from '@nestjs/common';
import { WishlistItem } from './entity/wishlist.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { PlacesService } from 'src/places/places.service';
import { Rating } from './entity/rating.entity';
import { Place } from 'src/places/entity/place.entity';
import { ObjectId } from 'mongodb';

@Injectable()
export class InteractionsService {
  constructor(
    @InjectRepository(WishlistItem)
    private readonly wishlistRepository: MongoRepository<WishlistItem>,
    private readonly placesService: PlacesService,
    @InjectRepository(Rating)
    private readonly ratingRepository: MongoRepository<Rating>,
    @InjectRepository(Place)
    private readonly placesRepository: MongoRepository<Place>,
  ) {}

  async addToWishlist(userId: string, placeData: any): Promise<WishlistItem> {
    const place = await this.placesService.findOrCreateByOsmId(placeData);

    const placeId = place._id.toHexString();

    const existingItem = await this.wishlistRepository.findOneBy({
      userId,
      placeId,
    });
    if (existingItem) {
      return existingItem;
    }

    const newWishlistItem = this.wishlistRepository.create({ userId, placeId });
    return this.wishlistRepository.save(newWishlistItem);
  }

  async removeFromWishlist(userId: string, placeId: string): Promise<void> {
    const result = await this.wishlistRepository.delete({ userId, placeId });

    if (result.affected === 0) {
      throw new NotFoundException('Wishlist item not found');
    }
  }

  async getWishlistForUser(userId: string): Promise<WishlistItem[]> {
    return this.wishlistRepository.find({
      where: { userId },
    });
  }

  async ratePlace(
    userId: string,
    placeId: string,
    score: number,
  ): Promise<Place> {
    let rating = await this.ratingRepository.findOneBy({ userId, placeId });

    if (rating) {
      rating.score = score;
    } else {
      rating = this.ratingRepository.create({ userId, placeId, score });
    }
    await this.ratingRepository.save(rating);

    const allRatingsForPlace = await this.ratingRepository.find({
      where: { placeId },
    });
    const ratingCount = allRatingsForPlace.length;
    const totalScore = allRatingsForPlace.reduce((sum, r) => sum + r.score, 0);
    const averageRating = ratingCount > 0 ? totalScore / ratingCount : 0;

    const updatedPlace = await this.placesRepository.findOneAndUpdate(
      { _id: new ObjectId(placeId) },
      { $set: { averageRating, ratingCount } },
      { returnDocument: 'after' },
    );

    return updatedPlace as Place;
  }
}
