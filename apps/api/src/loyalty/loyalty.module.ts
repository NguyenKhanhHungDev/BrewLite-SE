import { Module } from '@nestjs/common';
import { LOYALTY_STORE } from './loyalty.contract.js';
import { LoyaltyPrismaAdapter } from './loyalty.prisma-adapter.js';
import { LoyaltyService } from './loyalty.service.js';

@Module({
  providers: [
    LoyaltyService,
    { provide: LOYALTY_STORE, useClass: LoyaltyPrismaAdapter },
  ],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
