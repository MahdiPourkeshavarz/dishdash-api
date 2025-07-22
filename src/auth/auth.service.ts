/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-misused-promises */
import { Injectable, UnauthorizedException } from '@nestjs/common';
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

  async signUpAndLogin(dto: AuthDto) {
    const user = await this.usersService.findByEmail(dto.email);

    if (user) {
      const isMatch = await bcrypt.compare(
        dto.password,
        user.password as string,
      );
      if (!isMatch) {
        throw new UnauthorizedException('Invalid credentials');
      }
      return this.login(user);
    } else {
      const newUser = await this.usersService.create({
        email: dto.email,
        password: dto.password,
        username: dto.username,
        fullName: dto.fullName,
      });
      return this.login(newUser);
    }
  }

  private login(user: User) {
    const payload = {
      sub: user._id,
      email: user.email,
      username: user.username,
    };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
