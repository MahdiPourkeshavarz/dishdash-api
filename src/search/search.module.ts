/* eslint-disable prettier/prettier */
import { Module, Post } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadsModule } from 'src/uploads/uploads.module';

@Module({
  imports: [TypeOrmModule.forFeature([Post]), UploadsModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
