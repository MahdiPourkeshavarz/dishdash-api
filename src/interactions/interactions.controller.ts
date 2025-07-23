/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { Controller, UseGuards } from '@nestjs/common';
import { Body, Delete, Get, Param, Post, Request } from '@nestjs/common';
import { InteractionsService } from './interactions.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Poi } from 'src/places/dto/poi.dto';
import { plainToInstance } from 'class-transformer';
import { WishlistItem } from './entity/wishlist.entity';

@Controller('interactions')
export class InteractionsController {
  constructor(private readonly interactionsService: InteractionsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('wishlist')
  addToWishlist(@Request() req, @Body('poi') poi: Poi) {
    const userId = req.user.sub;
    return this.interactionsService.addToWishlist(userId, poi);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('wishlist/:placeId')
  removeFromWishlist(@Request() req, @Param('placeId') placeId: string) {
    const userId = req.user.sub;
    return this.interactionsService.removeFromWishlist(userId, placeId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('wishlist')
  getWishlist(@Request() req) {
    const userId = req.user.sub;
    const wishlist = this.interactionsService.getWishlistForUser(userId);
    return plainToInstance(WishlistItem, wishlist, {
      excludeExtraneousValues: false,
    });
  }
}
