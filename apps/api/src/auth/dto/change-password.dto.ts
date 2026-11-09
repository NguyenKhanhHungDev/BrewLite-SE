import { MaxPasswordBytes } from '../validators/max-password-bytes.js';
import { IsString, MinLength } from 'class-validator';
export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;
  @IsString()
  @MinLength(8)
  @MaxPasswordBytes()
  newPassword!: string;
  @IsString()
  confirmation!: string;
}
