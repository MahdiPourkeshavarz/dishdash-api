/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Body,
  Delete,
  Get,
  Module,
  Param,
  Post,
  Request,
} from '@nestjs/common';
import { InteractionsController } from './interactions.controller';
import { InteractionsService } from './interactions.service';

@Module({
  controllers: [InteractionsController],
  providers: [InteractionsService],
})
export class InteractionsModule {
  constructor(private readonly interactionsService: InteractionsService) {}

  @Post('wishlist')
  addToWishlist(@Request() req, @Body('placeId') placeId: string) {
    const userId = req.user.sub; // Get userId from the validated JWT
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
