/* eslint-disable prettier/prettier */
import {
  Entity,
  ObjectIdColumn,
  Column,
  ObjectId,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Place } from 'src/places/entity/place.entity';
import { Expose } from 'class-transformer';

@Entity()
export class WishlistItem {
  @ObjectIdColumn()
  _id: ObjectId;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.wishlistItems)
  @JoinColumn({ name: 'userId', referencedColumnName: '_id' })
  @Expose()
  user: User;

  @Column()
  placeId: string;

  @ManyToOne(() => Place, (place) => place.wishlistedBy, { eager: true })
  @JoinColumn({ name: 'placeId', referencedColumnName: '_id' })
  @Expose()
  place: Place;

  @CreateDateColumn()
  createdAt: Date;
}
