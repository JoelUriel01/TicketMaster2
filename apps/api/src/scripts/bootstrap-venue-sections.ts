// apps/api/src/scripts/bootstrap-venue-sections.ts
import 'dotenv/config';
import { PrismaService } from '../prisma/prisma.service';

const prisma = new PrismaService();

async function main() {
  const SECTIONS = [
    { code: 'IZQ', label: 'Izquierda', colorHex: '#7eb3bc' },
    { code: 'CTR', label: 'Central',   colorHex: '#4f98a3' },
    { code: 'DER', label: 'Derecha',   colorHex: '#7eb3bc' },
  ];

  for (const s of SECTIONS) {
    await prisma.venueSection.upsert({
      where: { code: s.code },
      update: { label: s.label, colorHex: s.colorHex },
      create: { code: s.code, label: s.label, colorHex: s.colorHex },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('Venue sections seeded');
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });