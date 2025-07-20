/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { BboxDto } from './dto/bbox.dto';

@Injectable()
export class PlacesService {
  async findInBounds(bboxDto: BboxDto) {
    const { sw_lat, sw_lng, ne_lat, ne_lng } = bboxDto;
    const bboxString = `${sw_lat},${sw_lng},${ne_lat},${ne_lng}`;

    const query = `
      [out:json][timeout:25];
      (
        node["amenity"~"restaurant|cafe|fast_food"](${bboxString});
      );
      out body;
      >;
      out skel qt;
    `;

    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch data from Overpass API. Status: ${response.status}`,
      );
    }

    const data = await response.json();
    return data.elements;
  }
}
