/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { Controller } from '@nestjs/common';
import { Body, Delete, Get, Param, Post, Request } from '@nestjs/common';
import { InteractionsService } from './interactions.service';

@Controller('interactions')
export class InteractionsController {
  constructor(private readonly interactionsService: InteractionsService) {}

  @Post('wishlist')
  addToWishlist(@Request() req, @Body('placeId') placeId: string) {
    const userId = req.user.sub;
    return this.interactionsService.addToWishlist(userId, placeId);
  }

  @Delete('wishlist/:placeId')
  removeFromWishlist(@Request() req, @Param('placeId') placeId: string) {
    const userId = req.user.sub;
    return this.interactionsService.removeFromWishlist(userId, placeId);
  }

  @Get('wishlist')
  getWishlist(@Request() req) {
    const userId = req.user.sub;
    return this.interactionsService.getWishlistForUser(userId);
  }
}
