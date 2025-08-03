/* eslint-disable prettier/prettier */
import {
  Entity,
  ObjectIdColumn,
  Column,
  ObjectId,
  CreateDateColumn,
} from 'typeorm';

@Entity()
export class WishlistItem {
  @ObjectIdColumn()
  _id: ObjectId;

  @Column()
  userId: string;

  @Column()
  placeId: string;

  @CreateDateColumn()
  createdAt: Date;
}
