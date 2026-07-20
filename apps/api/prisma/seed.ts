import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "password123";

// Fixed ids so re-running the seed updates the same example rows instead of
// duplicating them (PengurusCabor has no natural unique key).
const JUJITSU_PENGURUS_IDS = {
  ketua: "b1f4c0de-0001-4000-8000-000000000001",
  sekretaris: "b1f4c0de-0001-4000-8000-000000000002",
  bendahara: "b1f4c0de-0001-4000-8000-000000000003",
  ketuaBidang: "b1f4c0de-0001-4000-8000-000000000004",
  anggotaBidang: "b1f4c0de-0001-4000-8000-000000000005",
};
const JUJITSU_SK_ID = "b1f4c0de-0002-4000-8000-000000000001";
const JUJITSU_SK_FILE_URL = "/uploads/cabor-documents/sk-jujitsu-batam-2017.pdf";

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
    { nama: "Jujitsu", organisasiNasional: "PBJI" },
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

  // ---------------------------------------------------------------------------
  // Pengurus + SK Jujitsu — contoh struktur organisasi untuk halaman publik
  // Cabor, disalin dari "SK Batam.pdf" (Skep/01/PBJSI-Kepri/III/2017,
  // masa bakti 2017–2022). Dewan Pembina sengaja tidak dimasukkan: itu badan
  // penasihat, bukan bagian struktur pengurus.
  // ---------------------------------------------------------------------------

  console.log("Seeding pengurus Jujitsu (contoh)...");

  const jujitsu = await prisma.cabangOlahraga.findUnique({ where: { nama: "Jujitsu" } });
  if (jujitsu) {
    const masaBakti = { masaBaktiMulai: new Date("2017-03-06"), masaBaktiAkhir: new Date("2022-03-06") };

    // Ketua Umum is the root; everyone else reports to them.
    const ketua = await prisma.pengurusCabor.upsert({
      where: { id: JUJITSU_PENGURUS_IDS.ketua },
      update: {},
      create: {
        id: JUJITSU_PENGURUS_IDS.ketua,
        cabangOlahragaId: jujitsu.id,
        namaPengurus: "Hendrik Soputan",
        jabatan: "KETUA_UMUM",
        ...masaBakti,
      },
    });

    const bawahan = [
      { id: JUJITSU_PENGURUS_IDS.sekretaris, nama: "Djafri Rajab", jabatan: "SEKRETARIS_UMUM" as const, bidang: null },
      { id: JUJITSU_PENGURUS_IDS.bendahara, nama: "Rosy Kartikasari", jabatan: "BENDAHARA_UMUM" as const, bidang: null },
      {
        id: JUJITSU_PENGURUS_IDS.ketuaBidang,
        nama: "Afrinandi",
        jabatan: "KETUA_BIDANG" as const,
        bidang: "Bina Prestasi dan Dokumentasi",
      },
    ];

    for (const b of bawahan) {
      await prisma.pengurusCabor.upsert({
        where: { id: b.id },
        update: {},
        create: {
          id: b.id,
          cabangOlahragaId: jujitsu.id,
          namaPengurus: b.nama,
          jabatan: b.jabatan,
          bidang: b.bidang,
          reportsToId: ketua.id,
          ...masaBakti,
        },
      });
    }

    // Jackson sits in the same bidang, reporting to its ketua.
    await prisma.pengurusCabor.upsert({
      where: { id: JUJITSU_PENGURUS_IDS.anggotaBidang },
      update: {},
      create: {
        id: JUJITSU_PENGURUS_IDS.anggotaBidang,
        cabangOlahragaId: jujitsu.id,
        namaPengurus: "Jackson",
        jabatan: "ANGGOTA",
        bidang: "Bidang Bina Prestasi dan Dokumentasi",
        reportsToId: JUJITSU_PENGURUS_IDS.ketuaBidang,
        ...masaBakti,
      },
    });

    await prisma.caborDocument.upsert({
      where: { id: JUJITSU_SK_ID },
      update: {},
      create: {
        id: JUJITSU_SK_ID,
        caborId: jujitsu.id,
        jenis: "SK Pengurus",
        nomorDokumen: "Skep/01/PBJSI-Kepri/III/2017",
        tanggalDokumen: new Date("2017-03-06"),
        deskripsi: "Pengukuhan Susunan Pengurus Cabang Ju Jitsu Seluruh Indonesia Kota Batam, masa bakti 2017–2022.",
        fileUrl: JUJITSU_SK_FILE_URL,
      },
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
