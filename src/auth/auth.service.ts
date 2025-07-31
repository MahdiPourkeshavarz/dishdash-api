/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-misused-promises */
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import * as bcrypt from 'bcrypt';
import { User } from 'src/users/entities/user.entity';
import { AuthDto } from './dto/auth.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
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

  private async getTokens(userId: string, email: string, username: string) {
    const payload = { sub: userId, email, username };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_ACCESS_TOKEN_SECRET'),
        expiresIn: '59m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_REFRESH_TOKEN_SECRET'),
        expiresIn: '15d',
      }),
    ]);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  private async updateRefreshToken(userId: string, refreshToken: string) {
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.usersService.setRefreshToken(userId, hashedRefreshToken);
  }

  private async login(user: User) {
    const tokens = await this.getTokens(
      user._id.toHexString(),
      user.email,
      user.username,
    );
    await this.updateRefreshToken(user._id.toHexString(), tokens.refresh_token);

    const userForResponse = {
      _id: user._id.toHexString(),
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      image: user.image,
    };

    return {
      user: userForResponse,
      ...tokens,
    };
  }

  async refreshToken(userId: string, refreshToken: string) {
    const user = await this.usersService.findById(userId);
    if (!user || !user.refreshToken) {
      throw new ForbiddenException('Access Denied');
    }

    const isRefreshTokenMatching = await bcrypt.compare(
      refreshToken,
      user.refreshToken,
    );

    if (!isRefreshTokenMatching) {
      throw new ForbiddenException('Access Denied');
    }

    const tokens = await this.getTokens(
      user._id.toHexString(),
      user.email,
      user.username,
    );
    await this.updateRefreshToken(user._id.toHexString(), tokens.refresh_token);
    return tokens;
  }
}
