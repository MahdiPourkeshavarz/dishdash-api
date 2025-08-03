/* eslint-disable prettier/prettier */
import { Exclude } from 'class-transformer';
import { Entity, ObjectIdColumn, Column, ObjectId } from 'typeorm';

@Entity()
export class User {
  @ObjectIdColumn()
  _id: ObjectId;

  @Column({ nullable: true })
  @Exclude()
  refreshToken?: string;

  @Column()
  email: string;

  @Column()
  username: string;

  @Column()
  @Exclude()
  password?: string;

  @Column({ nullable: true })
  fullName: string;

  @Column({ nullable: true })
  image: string | null;

  toJSON() {
    delete this.password;
    return this;
  }
}
