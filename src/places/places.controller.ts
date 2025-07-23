/* eslint-disable prettier/prettier */
import { Controller, Get, Post, Query } from '@nestjs/common';
import { PlacesService } from './places.service';
import { BboxDto } from './dto/bbox.dto';

@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get()
  findInBounds(@Query() bboxDto: BboxDto) {
    return this.placesService.findInBounds(bboxDto);
  }

  @Post('seed')
  seedDatabase() {
    return this.placesService.seedDatabase();
  }
}
