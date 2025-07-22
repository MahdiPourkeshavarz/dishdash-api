/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { MongoRepository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { ObjectId } from 'mongodb';
import { UpdateUserDto } from './dto/update-user.dto';
import { UploadsService } from 'src/uploads/uploads.service';
import { promises as fs } from 'fs';
import { join } from 'path';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: MongoRepository<User>,
    private readonly uploadsService: UploadsService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const { password, ...userData } = createUserDto;

    const newUser = this.usersRepository.create(userData);

    if (password) {
      newUser.password = await bcrypt.hash(password, 10);
    }

    return this.usersRepository.save(newUser);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ email });
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    file?: Express.Multer.File,
  ): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    if (file) {
      const oldImageUrl = user.image;
      const { url: newImageUrl } = await this.uploadsService.saveFile(file);
      user.image = newImageUrl;

      if (oldImageUrl) {
        try {
          const oldImageFilename = oldImageUrl.split('/').pop();
          if (oldImageFilename) {
            await fs.unlink(join(process.cwd(), 'uploads', oldImageFilename));
          }
        } catch (error) {
          console.error(
            `Failed to delete old profile picture: ${oldImageUrl}`,
            error,
          );
        }
      }
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

  async findAll(): Promise<Omit<User, 'password'>[]> {
    return this.usersRepository.find({
      select: {
        _id: true,
        email: true,
        username: true,
        fullName: true,
        image: true,
        password: false,
      },
    });
  }
}
