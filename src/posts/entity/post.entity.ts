/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Entity,
  ObjectIdColumn,
  Column,
  ObjectId,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Place } from 'src/places/entity/place.entity';

@Entity()
export class Post {
  @ObjectIdColumn()
  _id: ObjectId;

  @Column()
  description: string;

  @Column()
  imageUrl: string;

  @Column()
  position: [number, number];

  @Column({ nullable: true })
  areaName?: string;

  @Column()
  satisfaction: string;

  @Column({ default: 0 })
  likes: number;

  @Column({ default: 0 })
  dislikes: number;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.posts)
  @JoinColumn({ name: 'userId', referencedColumnName: '_id' })
  user: User;

  @ManyToOne(() => Place, (place) => place.posts, { nullable: true })
  @JoinColumn({ name: 'placeId', referencedColumnName: '_id' })
  place: Place;

  @CreateDateColumn()
  createdAt: Date;

  @Column('array')
  tags?: string[];

  @Column('double', { array: true, nullable: true })
  search_embedding?: number[];
}
