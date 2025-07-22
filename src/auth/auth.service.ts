/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-misused-promises */
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import * as bcrypt from 'bcrypt';
import { User } from 'src/users/entities/user.entity';
import { AuthDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async signUp(dto: AuthDto) {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('A user with this email already exists.');
    }

    const newUser = await this.usersService.create({
      email: dto.email,
      password: dto.password,
      username: dto.username,
      fullName: dto.fullName,
    });
    return this.login(newUser);
  }

  async signIn(email: string, pass: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('User not found. Please sign up first.');
    }

    const isMatch = await bcrypt.compare(pass, user.password as string);
    if (!isMatch) {
      throw new UnauthorizedException(
        'Invalid credentials. Please check your password.',
      );
    }

    return this.login(user);
  }

  private login(user: User) {
    const payload = {
      sub: user._id.toHexString(),
      email: user.email,
      username: user.username,
    };

    const userForResponse = {
      _id: user._id.toHexString(),
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      image: user.image,
    };

    return {
      user: userForResponse,
      access_token: this.jwtService.sign(payload),
    };
  }
}
