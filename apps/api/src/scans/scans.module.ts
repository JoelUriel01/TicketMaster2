import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ScansController } from './scans.controller';
import { ScansService } from './scans.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.TICKET_QR_SECRET,
      signOptions: { algorithm: 'HS256' },
    }),
  ],
  controllers: [ScansController],
  providers: [ScansService],
})
export class ScansModule {}