/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { WishlistItem } from 'src/interactions/entity/wishlist.entity';
import { Post } from 'src/posts/entity/post.entity';
import { Entity, ObjectIdColumn, Column, ObjectId, OneToMany } from 'typeorm';

interface PlaceTags {
  [key: string]: string | undefined;
  name?: string;
  amenity?: string;
  cuisine?: string;
  phone?: string;
  website?: string;
  opening_hours?: string;
  'addr:street'?: string;
}

@Entity()
export class Place {
  @ObjectIdColumn()
  _id: ObjectId;

  @Column({ unique: true })
  osmId: number;

  @Column()
  name: string;

  @Column()
  position: [number, number];

  @Column('simple-json')
  tags: PlaceTags;

  @OneToMany(() => Post, (post) => post.place)
  posts: Post[];

  @OneToMany(() => WishlistItem, (wishlistItem) => wishlistItem.place)
  wishlistedBy: WishlistItem[];
}
