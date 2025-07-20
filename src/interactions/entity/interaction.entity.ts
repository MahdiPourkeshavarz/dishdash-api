/* eslint-disable prettier/prettier */
import { Entity, ObjectIdColumn, Column, ObjectId, ManyToOne } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Post } from 'src/posts/entity/post.entity';

@Entity()
export class Interaction {
  @ObjectIdColumn()
  _id: ObjectId;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  user: User;

  @Column()
  postId: string;

  @ManyToOne(() => Post)
  post: Post;

  // Stores whether the user liked or disliked the post
  @Column()
  vote: 'like' | 'dislike';
}
