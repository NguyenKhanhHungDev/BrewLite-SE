import { registerDecorator } from 'class-validator';

// bcrypt only considers the first 72 UTF-8 bytes. Apply only to new passwords.
export function MaxPasswordBytes(): PropertyDecorator {
  return (target, propertyKey) => registerDecorator({
    name: 'maxPasswordBytes',
    target: target.constructor,
    propertyName: String(propertyKey),
    options: { message: 'Mật khẩu mới không được vượt quá 72 byte UTF-8.' },
    validator: {
      validate: (value: unknown) => typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= 72,
    },
  });
}
