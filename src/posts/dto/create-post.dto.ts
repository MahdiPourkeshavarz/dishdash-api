/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable prettier/prettier */
import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  IsNumber,
} from 'class-validator';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  satisfaction: string;

  @IsArray()
  position: [number, number];

  @IsArray()
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  areaName?: string;

  @IsNumber()
  @IsOptional()
  osmId?: number;
}
