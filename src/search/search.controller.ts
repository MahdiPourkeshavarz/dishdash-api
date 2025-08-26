/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
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
import { LangChainService } from './langchain.service';

@Controller('search')
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly langChainService: LangChainService,
  ) {}

  @Get()
  search(@Query() query: SearchDto) {
    if (!query.term && !query.atmosphere) {
      throw new BadRequestException('A search term or atmosphere is required.');
    }
    return this.searchService.hybridSearch(query);
  }

  @Post('chat')
  handleChat(
    @Body('query') userQuery: string,
    @Body('thread_id') thread_id: string,
  ) {
    return this.langChainService.invokeAgent(userQuery, thread_id);
  }
}
