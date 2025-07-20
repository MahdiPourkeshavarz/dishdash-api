/* eslint-disable prettier/prettier */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { MongoRepository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { ObjectId } from 'mongodb';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: MongoRepository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const { password, ...userData } = createUserDto;

    const newUser = this.usersRepository.create(userData);

    if (password) {
      const salt = await bcrypt.genSalt();
      newUser.password = await bcrypt.hash(password, salt);
    }

    return this.usersRepository.save(newUser);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ email });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    Object.assign(user, updateUserDto);

    return this.usersRepository.save(user);
  }

  async findById(id: string): Promise<User | null> {
    if (!ObjectId.isValid(id)) {
      return null;
    }

    return this.usersRepository.findOneBy({
      _id: new ObjectId(id),
    });
  }
}
