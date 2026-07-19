import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "password123";

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  console.log("Seeding users...");

  await prisma.user.upsert({
    where: { email: "superadmin@simo-konibatam.com" },
    update: {},
    create: {
      email: "superadmin@simo-konibatam.com",
      passwordHash,
      role: "SUPER_ADMIN_KONI",
      fullName: "Super Admin KONI Batam",
    },
  });

  // ---------------------------------------------------------------------------
  // Cabang Olahraga — 48 cabor di bawah naungan KONI Batam.
  // Hanya nama dan organisasi nasional yang di-seed; ketua/sekretariat diisi
  // oleh KONI Batam lewat aplikasi.
  // ---------------------------------------------------------------------------

  console.log("Seeding cabang olahraga...");

  const caborData = [
    { nama: "Aero Sport", organisasiNasional: "FASI" },
    { nama: "Anggar", organisasiNasional: "IKASI" },
    { nama: "Angkat Besi", organisasiNasional: "PABSI" },
    { nama: "Atletik", organisasiNasional: "PASI" },
    { nama: "Baseball & Softball", organisasiNasional: "PERBASASI" },
    { nama: "Berkuda", organisasiNasional: "PORDASI" },
    { nama: "Biliar", organisasiNasional: "POBSI" },
    { nama: "Binaraga", organisasiNasional: "PBFI" },
    { nama: "Bola Basket", organisasiNasional: "PERBASI" },
    { nama: "Bola Voli", organisasiNasional: "PBVSI" },
    { nama: "Boling", organisasiNasional: "PBI" },
    { nama: "Bridge", organisasiNasional: "GABSI" },
    { nama: "Bulu Tangkis", organisasiNasional: "PBSI" },
    { nama: "Catur", organisasiNasional: "PERCASI" },
    { nama: "Dansa", organisasiNasional: "IODI" },
    { nama: "Dayung", organisasiNasional: "PODSI" },
    { nama: "Drum Band", organisasiNasional: "PDBI" },
    { nama: "E-Sports", organisasiNasional: "PBESI" },
    { nama: "Golf", organisasiNasional: "PGI" },
    { nama: "Gulat", organisasiNasional: "PGSI" },
    { nama: "Hoki", organisasiNasional: "FHI" },
    { nama: "Judo", organisasiNasional: "PJSI" },
    { nama: "Kabaddi", organisasiNasional: "FOKSI" },
    { nama: "Karate", organisasiNasional: "FORKI" },
    { nama: "Kempo", organisasiNasional: "PERKEMI" },
    { nama: "Kickboxing", organisasiNasional: "KBI" },
    { nama: "Kriket", organisasiNasional: "PCI" },
    { nama: "Layar", organisasiNasional: "PORLASI" },
    { nama: "Menembak", organisasiNasional: "PERBAKIN" },
    { nama: "Muaythai", organisasiNasional: "PBMI" },
    { nama: "Olahraga Bermotor", organisasiNasional: "IMI" },
    { nama: "Panahan", organisasiNasional: "PERPANI" },
    { nama: "Panjat Tebing", organisasiNasional: "FPTI" },
    { nama: "Pencak Silat", organisasiNasional: "IPSI" },
    { nama: "Renang", organisasiNasional: "PRSI" },
    { nama: "Selam", organisasiNasional: "POSSI" },
    { nama: "Senam", organisasiNasional: "PERSANI" },
    { nama: "Sepak Bola", organisasiNasional: "PSSI" },
    { nama: "Sepak Takraw", organisasiNasional: "PSTI" },
    { nama: "Sepatu Roda", organisasiNasional: "PERSEROSI" },
    { nama: "Ski Air & Wakeboard", organisasiNasional: "PSAWI" },
    { nama: "Squash", organisasiNasional: "PSI" },
    { nama: "Taekwondo", organisasiNasional: "PBTI" },
    { nama: "Tarung Derajat", organisasiNasional: "KODRAT" },
    { nama: "Tenis", organisasiNasional: "PELTI" },
    { nama: "Tenis Meja", organisasiNasional: "PTMSI" },
    { nama: "Tinju", organisasiNasional: "PERTINA" },
    { nama: "Wushu", organisasiNasional: "WI" },
  ];

  for (const data of caborData) {
    await prisma.cabangOlahraga.upsert({
      where: { nama: data.nama },
      update: { organisasiNasional: data.organisasiNasional },
      create: data,
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
