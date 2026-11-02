import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

@Injectable()
export class AdminGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // Được gán từ JwtAuthGuard chạy trước đó

    if (!user || !user.id) {
      throw new UnauthorizedException('Chưa xác thực người dùng.');
    }

    // Truy vấn trực tiếp DB để lấy role chính xác nhất
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });

    if (!dbUser || dbUser.role !== 'ADMIN') {
      throw new ForbiddenException('Bạn không có quyền truy cập chức năng Admin.');
    }

    return true;
  }
}