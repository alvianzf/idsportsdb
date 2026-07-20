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
  // Cabang Olahraga — 51 cabor di bawah naungan KONI Batam, per "LIST CABOR"
  // dari klien (2026-07-20).
  // Hanya nama dan organisasi nasional yang di-seed; ketua/sekretariat diisi
  // oleh KONI Batam lewat aplikasi.
  // ---------------------------------------------------------------------------

  console.log("Seeding cabang olahraga...");

  const caborData = [
    { nama: "Aero Sport", organisasiNasional: "FASI" },
    { nama: "Anggar", organisasiNasional: "IKASI" },
    { nama: "Angkat Berat", organisasiNasional: "PABSI" },
    { nama: "Angkat Besi", organisasiNasional: "PABSI" },
    { nama: "Atletik", organisasiNasional: "PASI" },
    { nama: "Barongsai" },
    { nama: "Basket", organisasiNasional: "PERBASI" },
    { nama: "Biliar", organisasiNasional: "POBSI" },
    { nama: "Binaraga", organisasiNasional: "PBFI" },
    { nama: "Bola Tangan" },
    { nama: "Boling", organisasiNasional: "PBI" },
    { nama: "Bridge", organisasiNasional: "GABSI" },
    { nama: "Bulu Tangkis", organisasiNasional: "PBSI" },
    { nama: "Catur", organisasiNasional: "PERCASI" },
    { nama: "Dance Sport", organisasiNasional: "IODI" },
    { nama: "Dayung", organisasiNasional: "PODSI" },
    { nama: "Drumband", organisasiNasional: "PDBI" },
    { nama: "E-sport", organisasiNasional: "PBESI" },
    { nama: "Golf", organisasiNasional: "PGI" },
    { nama: "Gulat", organisasiNasional: "PGSI" },
    { nama: "Judo", organisasiNasional: "PJSI" },
    { nama: "Jujitsu" },
    { nama: "Karate", organisasiNasional: "FORKI" },
    { nama: "Kickboxing", organisasiNasional: "KBI" },
    { nama: "Kurash" },
    { nama: "Layar", organisasiNasional: "PORLASI" },
    { nama: "Menembak", organisasiNasional: "PERBAKIN" },
    { nama: "Motor", organisasiNasional: "IMI" },
    { nama: "Muaythai", organisasiNasional: "PBMI" },
    { nama: "Panahan", organisasiNasional: "PERPANI" },
    { nama: "Panjat Tebing", organisasiNasional: "FPTI" },
    { nama: "Pentaque" },
    { nama: "Renang", organisasiNasional: "PRSI" },
    { nama: "Sambo" },
    { nama: "Savate" },
    { nama: "Selam", organisasiNasional: "POSSI" },
    { nama: "Sepak Bola", organisasiNasional: "PSSI" },
    { nama: "Sepak Takraw", organisasiNasional: "PSTI" },
    { nama: "Sepatu Roda", organisasiNasional: "PERSEROSI" },
    { nama: "Sepeda", organisasiNasional: "ISSI" },
    { nama: "Shorinji Kempo", organisasiNasional: "PERKEMI" },
    { nama: "Silat", organisasiNasional: "IPSI" },
    { nama: "Ski Air & Wake Board", organisasiNasional: "PSAWI" },
    { nama: "Taekwondo", organisasiNasional: "PBTI" },
    { nama: "Tarung Derajat", organisasiNasional: "KODRAT" },
    { nama: "Tenis Lapangan", organisasiNasional: "PELTI" },
    { nama: "Tenis Meja", organisasiNasional: "PTMSI" },
    { nama: "Tinju", organisasiNasional: "PERTINA" },
    { nama: "Voli", organisasiNasional: "PBVSI" },
    { nama: "Woodball" },
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
