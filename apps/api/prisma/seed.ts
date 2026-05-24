import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config(); // carga el .env

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });


const DEFS = [
  { code: 'IZQ', rows: [
    { r: 'A', n: 3 }, { r: 'B', n: 5 }, { r: 'C', n: 6 }, { r: 'D', n: 6 },
    { r: 'E', n: 6 }, { r: 'F', n: 6 }, { r: 'G', n: 6 }, { r: 'H', n: 6 },
    { r: 'I', n: 6 }, { r: 'J', n: 6 }, { r: 'K', n: 6 },
  ]},
  { code: 'CTR', rows: [
    { r: 'A', n: 8  }, { r: 'B', n: 11 }, { r: 'C', n: 11 }, { r: 'D', n: 11 },
    { r: 'E', n: 11 }, { r: 'F', n: 11 }, { r: 'G', n: 11 }, { r: 'H', n: 11 },
    { r: 'I', n: 11 }, { r: 'J', n: 11 }, { r: 'K', n: 11 },
  ]},
  { code: 'DER', rows: [
    { r: 'A', n: 3 }, { r: 'B', n: 5 }, { r: 'C', n: 6 }, { r: 'D', n: 6 },
    { r: 'E', n: 6 }, { r: 'F', n: 6 }, { r: 'G', n: 6 }, { r: 'H', n: 6 },
    { r: 'I', n: 6 }, { r: 'J', n: 6 }, { r: 'K', n: 6 },
  ]},
];

const CFG = {
  IZQ: { cx: 42,  max: 6  },
  CTR: { cx: 260, max: 11 },
  DER: { cx: 628, max: 6  },
};
const ROWS = ['K','J','I','H','G','F','E','D','C','B','A'];
const GAP = 22, STARY = 126;

async function main() {
  console.log('Seeding VenueSections...');

  // Crear secciones si no existen
  const sections = [
    { code: 'IZQ', label: 'Izquierda', colorHex: '#7eb3bc' },
    { code: 'CTR', label: 'Central',   colorHex: '#4f98a3' },
    { code: 'DER', label: 'Derecha',   colorHex: '#7eb3bc' },
  ];

  for (const sec of sections) {
    await prisma.venueSection.upsert({
      where: { code: sec.code },
      update: {},
      create: sec,
    });
  }
  console.log('✓ VenueSections listas');

  console.log('Seeding Seats...');

  for (const sec of DEFS) {
    const section = await prisma.venueSection.findUnique({ where: { code: sec.code } });
    if (!section) { console.error(`Sección ${sec.code} no encontrada`); continue; }

    for (const rd of sec.rows) {
      const ri = ROWS.indexOf(rd.r);
      const y  = STARY + ri * GAP;
      const cfg = CFG[sec.code as keyof typeof CFG];

      for (let i = 0; i < rd.n; i++) {
        let x: number;
        if (sec.code === 'CTR') {
          const off = ((cfg.max - rd.n) / 2) * GAP;
          x = cfg.cx + off + i * GAP;
        } else if (sec.code === 'IZQ') {
          x = cfg.cx + (cfg.max - 1) * GAP - i * GAP;
        } else {
          x = cfg.cx + i * GAP;
        }

        const num = i + 1;
        const seatId = `${sec.code}-${rd.r}-${String(num).padStart(2, '0')}`;

        await prisma.seat.upsert({
          where: { id: seatId },
          update: {},
          create: {
            id:        seatId,
            sectionId: section.id,
            row:       rd.r,
            number:    num,
            seatLabel: `Fila ${rd.r}, Asiento ${num}`,
            x,
            y,
          },
        });
      }
    }
    console.log(`✓ Asientos sección ${sec.code}`);
  }

  console.log('Seed completo ✓');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());