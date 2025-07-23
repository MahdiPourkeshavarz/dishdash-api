/* eslint-disable prettier/prettier */
import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { PlacesService } from './places.service';
import { BboxDto } from './dto/bbox.dto';
import { Place } from './entity/place.entity';

@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get(':id')
  async getPlaceById(@Param('id') id: string): Promise<Place> {
    const place = await this.placesService.findById(id);
    if (!place) {
      throw new NotFoundException(`Place with ID ${id} not found`);
    }
    return place;
  }

  @Get()
  findInBounds(@Query() bboxDto: BboxDto) {
    return this.placesService.findInBounds(bboxDto);
  }

  @Post('seed')
  seedDatabase() {
    return this.placesService.seedDatabase();
  }
}
