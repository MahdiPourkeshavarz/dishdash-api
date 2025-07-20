/* eslint-disable prettier/prettier */
import {
  Entity,
  ObjectIdColumn,
  Column,
  ObjectId,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Place } from 'src/places/entity/place.entity';

@Entity()
export class WishlistItem {
  @ObjectIdColumn()
  _id: ObjectId;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.wishlistItems)
  user: User;

  @Column()
  placeId: string;

  @ManyToOne(() => Place, (place) => place.wishlistedBy)
  place: Place;

  @CreateDateColumn()
  createdAt: Date;
}
