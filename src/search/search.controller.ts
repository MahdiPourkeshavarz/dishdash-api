/* eslint-disable prettier/prettier */
import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(@Query('term') term: string) {
    if (!term) {
      throw new BadRequestException('A search term is required.');
    }
    return this.searchService.hybridSearch(term);
  }
}
