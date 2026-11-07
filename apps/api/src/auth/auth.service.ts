import {
  Injectable,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  OnModuleDestroy,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService implements OnModuleDestroy {
  private readonly prisma: PrismaClient;

  constructor(private readonly jwt: JwtService) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is missing');
    this.prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });
  }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    try {
      const user = await this.prisma.user.create({
        data: { email, passwordHash },
      });
      return { id: user.id, email: user.email };
    } catch (error: unknown) {
      // Cần xử lý trường hợp 2 request đăng ký cùng email đồng thời.
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return {
      accessToken: await this.jwt.signAsync({
        sub: user.id,
        sessionVersion: user.sessionVersion,
      }),
    };
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
  async isSessionCurrent(userId: number, sessionVersion: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { sessionVersion: true },
    });
    return !!user && user.sessionVersion === sessionVersion;
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    if (dto.newPassword !== dto.confirmation)
      throw new BadRequestException('Mật khẩu xác nhận không khớp.');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (
      !user ||
      !(await bcrypt.compare(dto.currentPassword, user.passwordHash))
    ) {
      throw new BadRequestException('Mật khẩu hiện tại không đúng.');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    // Compare-and-swap prevents simultaneous changes with an obsolete password.
    const changed = await this.prisma.user.updateMany({
      where: { id: userId, passwordHash: user.passwordHash },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    if (changed.count !== 1)
      throw new ConflictException(
        'Mật khẩu đã thay đổi. Vui lòng đăng nhập lại.',
      );
    return {
      message: 'Đã đổi mật khẩu. Mọi phiên đăng nhập đã được thu hồi.',
    };
  }
  async updateProfile(userId: number, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name, phone: dto.phone },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        loyaltyPoints: true,
        role: true,
      },
    });
  }
  async me(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        loyaltyPoints: true,
        role: true,
      },
    });
    if (!user) throw new UnauthorizedException('User no longer exists');
    return user;
  }
}
