/* eslint-disable prettier/prettier */

export interface Poi {
  id: number;
  lat: number;
  lon: number;
  tags: {
    [key: string]: string | undefined;
    name?: string;
    amenity?: string;
    cuisine?: string;
    phone?: string;
    website?: string;
    opening_hours?: string;
    'addr:street'?: string;
  };
}
