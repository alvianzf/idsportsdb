import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  await prisma.user.upsert({
    where: { email: "superadmin@koni-batam.go.id" },
    update: {},
    create: {
      email: "superadmin@koni-batam.go.id",
      passwordHash,
      role: "SUPER_ADMIN_KONI",
      fullName: "Super Admin KONI Batam",
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@koni-batam.go.id" },
    update: {},
    create: {
      email: "admin@koni-batam.go.id",
      passwordHash,
      role: "ADMIN_KONI",
      fullName: "Admin KONI Batam",
    },
  });

  const cabor = await prisma.cabangOlahraga.upsert({
    where: { nama: "Atletik" },
    update: {},
    create: {
      nama: "Atletik",
      ketuaCabor: "Budi Santoso",
      sekretariat: "Jl. Sudirman No. 1, Batam Kota",
    },
  });

  await prisma.user.upsert({
    where: { email: "admincabor.atletik@koni-batam.go.id" },
    update: {},
    create: {
      email: "admincabor.atletik@koni-batam.go.id",
      passwordHash,
      role: "ADMIN_CABOR",
      fullName: "Admin Cabor Atletik",
      cabangOlahragaId: cabor.id,
    },
  });

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
