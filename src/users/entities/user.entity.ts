/* eslint-disable prettier/prettier */
import { Exclude } from 'class-transformer';
import { WishlistItem } from 'src/interactions/entity/wishlist.entity';
import { Post } from 'src/posts/entity/post.entity';
import { Entity, ObjectIdColumn, Column, ObjectId, OneToMany } from 'typeorm';

@Entity()
export class User {
  @ObjectIdColumn()
  _id: ObjectId;

  @Column()
  email: string;

  @Column()
  username: string;

  @Column()
  @Exclude()
  password?: string;

  @Column({ nullable: true })
  fullName: string;

  @OneToMany(() => Post, (post) => post.user)
  posts: Post[];

  @OneToMany(() => WishlistItem, (wishlistItem) => wishlistItem.user)
  wishlistItems: WishlistItem[];

  @Column({ nullable: true })
  image: string;

  toJSON() {
    delete this.password;
    return this;
  }
}
