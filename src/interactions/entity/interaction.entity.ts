/* eslint-disable prettier/prettier */
import { Entity, ObjectIdColumn, Column, ObjectId } from 'typeorm';

@Entity()
export class Interaction {
  @ObjectIdColumn()
  _id: ObjectId;

  @Column()
  userId: string;

  @Column()
  postId: string;

  @Column()
  vote: 'like' | 'dislike';
}
