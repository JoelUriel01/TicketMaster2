import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async updateUserRole(userId: string, role: UserRole) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        updatedAt: true,
      },
    });
  }

  // NUEVO: crear si no existe
  async findOrCreateMe(userIdFromAuth: string, email: string, fullName?: string) {
    let user = await this.prisma.user.findUnique({
      where: { id: userIdFromAuth },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          id: userIdFromAuth,
          email,
          fullName: fullName ?? '',
          // opcional: role por defecto
          // role: UserRole.BUYER,
        },
      });
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      mfaEnabled: user.mfaEnabled,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async findMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        emailVerified: true,
        phoneVerified: true,
        mfaEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return user;
  }

  async updateProfile(userId: string, fullName: string) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { fullName },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        emailVerified: true,
        phoneVerified: true,
        mfaEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updated;
  }

  async updateRole(id: string, role: UserRole) {
  return this.prisma.user.update({
    where: { id },
    data: { role },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      updatedAt: true,
    },
  });
}
}