/* eslint-disable prettier/prettier */

import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

@Entity()
@Index(['userId', 'placeId'], { unique: true })
export class Rating {
  @ObjectIdColumn()
  _id: ObjectId;

  @Column()
  userId: string;

  @Column()
  placeId: string;

  @Column()
  score: number;
}
