/* eslint-disable prettier/prettier */
import { Entity, ObjectIdColumn, Column, ObjectId } from 'typeorm';

@Entity()
export class User {
  @ObjectIdColumn()
  _id: ObjectId;

  @Column()
  email: string;

  @Column()
  username: string;

  @Column()
  password?: string;

  @Column({ nullable: true })
  fullName: string;

  @Column({ nullable: true })
  image: string;
}
