/* eslint-disable prettier/prettier */
import { WishlistItem } from 'src/interactions/entity/wishlist.entity';
import { Post } from 'src/posts/entity/post.entity';
import { Entity, ObjectIdColumn, Column, ObjectId, OneToMany } from 'typeorm';

@Entity()
export class Place {
  @ObjectIdColumn()
  _id: ObjectId;

  @Column({ unique: true })
  osmId: number;

  @Column()
  name: string;

  @Column('array')
  position: [number, number];

  @Column('simple-json')
  tags: Record<string, any>;

  @OneToMany(() => Post, (post) => post.place)
  posts: Post[];

  @OneToMany(() => WishlistItem, (wishlistItem) => wishlistItem.place)
  wishlistedBy: WishlistItem[];
}
