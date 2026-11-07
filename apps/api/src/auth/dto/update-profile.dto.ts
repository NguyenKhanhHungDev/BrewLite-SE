import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';

export class UpdateProfileDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsString()
  @Matches(/^(?:0[0-9]{9}|\+84[0-9]{9})$/, {
    message: 'Số điện thoại gồm 10 chữ số bắt đầu bằng 0 hoặc +84 và 9 chữ số.',
  })
  phone!: string;
}
