import {
  BadRequestException,
  Injectable,
  ParseIntPipe,
  type ArgumentMetadata,
} from '@nestjs/common';

/** Prisma Int IDs use PostgreSQL signed int32, not JavaScript's safe-integer range. */
@Injectable()
export class ParseDatabaseIdPipe extends ParseIntPipe {
  override async transform(
    value: string,
    metadata: ArgumentMetadata,
  ): Promise<number> {
    const id = await super.transform(value, metadata);
    if (typeof id !== 'number' || id < 1 || id > 2147483647) {
      throw new BadRequestException('Mã phải là số nguyên từ 1 đến 2147483647.');
    }
    return id;
  }
}
