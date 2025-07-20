/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { IsNumberString } from 'class-validator';

export class BboxDto {
  @IsNumberString()
  sw_lat: string;

  @IsNumberString()
  sw_lng: string;

  @IsNumberString()
  ne_lat: string;

  @IsNumberString()
  ne_lng: string;
}
