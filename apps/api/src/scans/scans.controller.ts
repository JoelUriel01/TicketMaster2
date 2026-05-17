import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ScansService } from './scans.service';
import { ValidateScanDto } from './dto/validate-scan.dto';

@Controller('scans')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class ScansController {
  constructor(private readonly scansService: ScansService) {}

  @Post('validate')
  @Roles(UserRole.STAFF, UserRole.ORGANIZER, UserRole.ADMIN)
  validate(@Req() req, @Body() dto: ValidateScanDto) {
    return this.scansService.validateScan(req.user.id, dto);
  }
}