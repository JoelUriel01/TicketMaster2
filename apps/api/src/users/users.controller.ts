import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { RegisterPublicKeyDto } from './dto/register-public-key.dto';

@Controller('users')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  getMe(@Req() req: any) {
    return this.usersService.findOrCreateMe(
      req.user.id,
      req.user.email,
      req.user.user_metadata?.full_name,
    );
  }

  @Patch('me')
  @UseGuards(SupabaseAuthGuard)
  updateMe(@Req() req: any, @Body() body: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.id, body.fullName);
  }

  /**
   * POST /users/me/public-key
   * Registra (o actualiza) la clave pública ECDSA P-256 del usuario.
   * El cliente la genera en el dispositivo y la envía una sola vez al registrarse
   * o cuando cambia de dispositivo.
   */
  @Post('me/public-key')
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(HttpStatus.OK)
  registerPublicKey(@Req() req: any, @Body() body: RegisterPublicKeyDto) {
    return this.usersService.registerPublicKey(req.user.id, body.publicKey);
  }

  @Patch(':id/role')
  @Roles(UserRole.ADMIN)
  updateRole(
    @Param('id') id: string,
    @Body() body: UpdateUserRoleDto,
  ) {
    return this.usersService.updateRole(id, body.role);
  }

  @Get('by-email/:email')
@UseGuards(SupabaseAuthGuard)
findByEmail(@Param('email') email: string) {
  return this.usersService.findByEmail(email);
}


}