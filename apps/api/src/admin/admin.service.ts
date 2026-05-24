import { Injectable, ForbiddenException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  private supabaseAdmin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  constructor(private readonly prisma: PrismaService) {}
  
async inviteOrganizer(email: string) {
  const { error } = await this.supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { role: 'ORGANIZER' },
    redirectTo: `${process.env.FRONTEND_URL}/accept-invite`,
  });

  if (error) throw new Error(error.message);
  return { message: `Invitación enviada a ${email}` };
}

  async listOrganizers() {
    return this.prisma.user.findMany({
      where: { role: 'ORGANIZER' },
      select: { id: true, email: true, fullName: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeOrganizer(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { role: 'BUYER' },
      select: { id: true, email: true, fullName: true, role: true },
    });
  }


  
}