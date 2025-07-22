/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, NotFoundException } from '@nestjs/common';
import { WishlistItem } from './entity/wishlist.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { UsersService } from 'src/users/users.service';
import { PlacesService } from 'src/places/places.service';

@Injectable()
export class InteractionsService {
  constructor(
    @InjectRepository(WishlistItem)
    private readonly wishlistRepository: MongoRepository<WishlistItem>,
    private readonly usersService: UsersService,
    private readonly placesService: PlacesService,
  ) {}

  async addToWishlist(userId: string, placeId: string): Promise<WishlistItem> {
    const existingItem = await this.wishlistRepository.findOneBy({
      userId,
      placeId,
    });
    if (existingItem) {
      return existingItem;
    }

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    // ✅ 3. Verify that the place exists before saving
    const place = await this.placesService.findById(placeId);
    if (!place) {
      throw new NotFoundException(`Place with ID "${placeId}" not found`);
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
      relations: ['place'],
    });
  }
}
