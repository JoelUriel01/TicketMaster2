import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole } from '@prisma/client';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function bootstrapAdmin() {
  const targetEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;

  if (!targetEmail) {
    console.error('❌ Define BOOTSTRAP_ADMIN_EMAIL en tu .env antes de correr este script.');
    process.exit(1);
  }

  const existingAdmin = await prisma.user.findFirst({
    where: { role: UserRole.ADMIN },
  });

  if (existingAdmin) {
    console.warn('⚠️  Ya existe un ADMIN en la base:', existingAdmin.email);
    console.warn('   Este script solo se puede usar una vez.');
    await prisma.$disconnect();
    process.exit(0);
  }

  const targetUser = await prisma.user.findUnique({
    where: { email: targetEmail },
  });

  if (!targetUser) {
    console.error(`❌ No se encontró ningún usuario con email: ${targetEmail}`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const updated = await prisma.user.update({
    where: { email: targetEmail },
    data: { role: UserRole.ADMIN },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      updatedAt: true,
    },
  });

  console.log('✅ Admin creado correctamente:');
  console.table(updated);
  await prisma.$disconnect();
}

bootstrapAdmin();