import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  getHealth() {
    return {
      ok: true,
      service: 'api',
      timestamp: new Date().toISOString(),
    };
  }
}