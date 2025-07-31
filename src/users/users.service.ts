/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import { ChangePasswordDto } from './dto/change-password.dto';

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

    const updateData: Partial<User> = {};
    if (updateUserDto.username) {
      updateData.username = updateUserDto.username;
    }

    if (file) {
      console.log('Processing file:', file.originalname, file.mimetype);
      const { url: newImageUrl } = await this.uploadsService.saveFile(file);
      console.log('New image URL:', newImageUrl);
      updateData.image = newImageUrl;
      const baseUrl = 'http://localhost:8000';

      if (user.image && user.image !== newImageUrl) {
        try {
          const oldImageFilename = user.image.split('/').pop();
          if (oldImageFilename) {
            await fs.unlink(join(baseUrl, 'Uploads', oldImageFilename));
          }
        } catch (error) {
          console.error(
            `Failed to delete old profile picture: ${user.image}`,
            error,
          );
        }
      }
    }

    await this.usersRepository.update(id, updateData);
    const updatedUser = await this.findById(id);
    console.log('Updated user:', updatedUser);
    return updatedUser as User;
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

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    const user = await this.findById(userId);
    if (!user || !user.password) {
      throw new NotFoundException('User not found or password not set.');
    }

    const isPasswordCorrect = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.password,
    );

    if (!isPasswordCorrect) {
      throw new BadRequestException('Incorrect current password.');
    }

    const hashedNewPassword = await bcrypt.hash(
      changePasswordDto.newPassword,
      10,
    );

    await this.usersRepository.update(userId, { password: hashedNewPassword });
  }

  async setRefreshToken(userId: string, refreshToken: string) {
    await this.usersRepository.update(userId, { refreshToken });
  }
}
