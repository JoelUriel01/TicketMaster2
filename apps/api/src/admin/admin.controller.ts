import { Controller, Post, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('admin')
@UseGuards(SupabaseAuthGuard, RolesGuard)  // ← tus guards existentes
@Roles(UserRole.ADMIN)                      // ← solo ADMIN puede hacer todo aquí
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('invite-organizer')
  inviteOrganizer(@Body('email') email: string) {
    return this.adminService.inviteOrganizer(email);
  }

  @Get('organizers')
  listOrganizers() {
    return this.adminService.listOrganizers();
  }

  @Patch('organizers/:id/revoke')
  revokeOrganizer(@Param('id') id: string) {
    return this.adminService.revokeOrganizer(id);
  }
}