import { IsIn } from 'class-validator';

// Payment status is never writable by an Admin. This DTO exposes only
// the three preparation milestones after a verified PAID transition.
export class UpdateOrderStatusDto {
  @IsIn(['PREPARING', 'READY', 'COMPLETED'])
  status!: 'PREPARING' | 'READY' | 'COMPLETED';
}
