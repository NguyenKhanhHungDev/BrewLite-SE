import { MaxPasswordBytes } from '../validators/max-password-bytes.js';
import { IsEmail, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @MinLength(8)
  @MaxPasswordBytes()
  password!: string;
}