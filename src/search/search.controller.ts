/* eslint-disable prettier/prettier */
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchDto } from './dto/search-query.dto';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(@Query() query: SearchDto) {
    if (!query.term && !query.atmosphere) {
      throw new BadRequestException('A search term or atmosphere is required.');
    }
    return this.searchService.hybridSearch(query);
  }

  @Post('chat')
  handleChat(@Body('query') userQuery: string) {
    return this.searchService.handleChatQuery(userQuery);
  }
}
