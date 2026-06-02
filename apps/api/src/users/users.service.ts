import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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
      // Indicamos si ya tiene clave pública registrada (sin exponer la clave)
      hasPublicKey: !!user.publicKey,
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

    return this.prisma.user.update({
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

  /**
   * Registra o actualiza la clave pública ECDSA P-256 del usuario.
   *
   * Validaciones:
   *  - Debe ser una clave raw no comprimida (65 bytes, prefijo 0x04)
   *  - No se guarda la clave privada — esa NUNCA llega al servidor
   */
  async registerPublicKey(userId: string, publicKey: string) {
    // Normalizar base64 URL-safe a estándar antes de decodificar
    const normalized = publicKey.replace(/-/g, '+').replace(/_/g, '/');
    const keyBytes = Buffer.from(normalized, 'base64');

    if (keyBytes.length !== 65) {
      throw new BadRequestException(
        `La clave pública debe tener 65 bytes (recibidos: ${keyBytes.length}). ` +
          'Exporta la clave con exportKey("raw", publicKey).',
      );
    }
    if (keyBytes[0] !== 0x04) {
      throw new BadRequestException(
        'La clave pública debe estar en formato no comprimido (prefijo 0x04). ' +
          'Usa namedCurve: "P-256" con exportKey("raw").',
      );
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { publicKey },
      select: {
        id: true,
        publicKey: true, // campo virtual — ver nota abajo
      },
    });

    // Nota: si no tienes publicKey en el select de Prisma todavía,
    // devuelve solo { id } hasta que hagas la migración.
    return { id: updated.id, hasPublicKey: true };
  }

  async findByEmail(email: string) {
  const user = await this.prisma.user.findUnique({
    where: { email },
    select: { id: true, fullName: true }, // solo lo mínimo
  });
  if (!user) throw new NotFoundException('Usuario no encontrado.');
  return user;
}

}