/* eslint-disable prettier/prettier */
import { IsOptional, IsString, IsIn } from 'class-validator';

export class SearchDto {
  @IsString()
  @IsOptional()
  term?: string;

  @IsString()
  @IsOptional()
  atmosphere?: string;

  @IsIn(['restaurant', 'cafe', 'fast_food'])
  @IsOptional()
  amenity?: string;

  // @IsNumberString()
  // @IsOptional()
  // sw_lat?: string;

  // @IsNumberString()
  // @IsOptional()
  // sw_lng?: string;

  // @IsNumberString()
  // @IsOptional()
  // ne_lat?: string;

  // @IsNumberString()
  // @IsOptional()
  // ne_lng?: string;
}
