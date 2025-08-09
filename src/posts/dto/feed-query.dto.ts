/* eslint-disable prettier/prettier */
import { IsNumber, IsOptional, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class FeedQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsString()
  sw_lat: string;

  @IsString()
  sw_lng: string;

  @IsString()
  ne_lat: string;

  @IsString()
  ne_lng: string;
}
