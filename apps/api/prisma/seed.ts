import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";

const prisma = new PrismaClient();

const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "password123";
const CARD_VERIFY_BASE_URL =
  process.env.CARD_VERIFY_BASE_URL ?? "http://localhost:5173/verify";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dateOf(year: number, month: number, day: number) {
  return new Date(year, month - 1, day);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  console.log("Seeding users...");

  const superAdmin = await prisma.user.upsert({
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

  // ---------------------------------------------------------------------------
  // Cabang Olahraga
  // ---------------------------------------------------------------------------

  console.log("Seeding cabang olahraga...");

  const caborData = [
    { nama: "Atletik", ketuaCabor: "Budi Santoso", sekretariat: "Jl. Sudirman No. 1, Batam Kota" },
    { nama: "Renang", ketuaCabor: "Dewi Kusuma", sekretariat: "Jl. Hang Tuah No. 5, Sekupang" },
    { nama: "Bulu Tangkis", ketuaCabor: "Ahmad Fauzi", sekretariat: "Jl. Imam Bonjol No. 12, Lubuk Baja" },
    { nama: "Karate", ketuaCabor: "Hendri Wijaya", sekretariat: "Jl. Raja Ali Haji No. 3, Batu Ampar" },
    { nama: "Taekwondo", ketuaCabor: "Siti Rahayu", sekretariat: "Jl. Duyung No. 7, Nongsa" },
    { nama: "Pencak Silat", ketuaCabor: "Ruslan Hakim", sekretariat: "Jl. Brigjen Katamso No. 9, Sagulung" },
    { nama: "Bola Voli", ketuaCabor: "Maya Sari", sekretariat: "Jl. Ahmad Yani No. 15, Bengkong" },
    { nama: "Sepak Bola", ketuaCabor: "Rudi Hermawan", sekretariat: "Jl. Laksamana Bintan No. 2, Batam Kota" },
  ];

  const caborMap: Record<string, string> = {};
  for (const data of caborData) {
    const c = await prisma.cabangOlahraga.upsert({
      where: { nama: data.nama },
      update: { ketuaCabor: data.ketuaCabor, sekretariat: data.sekretariat },
      create: data,
    });
    caborMap[data.nama] = c.id;
  }

  // ---------------------------------------------------------------------------
  // Admin Cabor users
  // ---------------------------------------------------------------------------

  console.log("Seeding admin cabor users...");

  const adminCaborList = [
    { email: "admincabor.atletik@koni-batam.go.id", fullName: "Admin Cabor Atletik", cabor: "Atletik" },
    { email: "admincabor.renang@koni-batam.go.id", fullName: "Admin Cabor Renang", cabor: "Renang" },
    { email: "admincabor.badminton@koni-batam.go.id", fullName: "Admin Cabor Bulu Tangkis", cabor: "Bulu Tangkis" },
    { email: "admincabor.karate@koni-batam.go.id", fullName: "Admin Cabor Karate", cabor: "Karate" },
  ];

  for (const ac of adminCaborList) {
    await prisma.user.upsert({
      where: { email: ac.email },
      update: {},
      create: {
        email: ac.email,
        passwordHash,
        role: "ADMIN_CABOR",
        fullName: ac.fullName,
        cabangOlahragaId: caborMap[ac.cabor],
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Pelatih
  // ---------------------------------------------------------------------------

  console.log("Seeding pelatih...");

  const pelatihData = [
    // Atletik
    { namaPelatih: "Suparman", nomorLisensi: "LIC-ATL-001", cabor: "Atletik", tingkatanLisensi: "Nasional", mulai: dateOf(2022, 1, 1), akhir: dateOf(2025, 12, 31), riwayat: "Mantan atlet PON 2016, pelatih kepala Atletik Batam sejak 2020." },
    { namaPelatih: "Yeni Andriani", nomorLisensi: "LIC-ATL-002", cabor: "Atletik", tingkatanLisensi: "Daerah", mulai: dateOf(2023, 3, 1), akhir: dateOf(2026, 2, 28), riwayat: "Spesialis lari jarak pendek, lisensi daerah Kepri." },
    // Renang
    { namaPelatih: "Halim Prasetyo", nomorLisensi: "LIC-REN-001", cabor: "Renang", tingkatanLisensi: "Nasional", mulai: dateOf(2021, 6, 1), akhir: dateOf(2024, 5, 31), riwayat: "Pelatih renang bersertifikat PRSI, spesialis gaya bebas dan punggung." },
    { namaPelatih: "Tika Wulandari", nomorLisensi: "LIC-REN-002", cabor: "Renang", tingkatanLisensi: "Daerah", mulai: dateOf(2023, 1, 1), akhir: dateOf(2025, 12, 31), riwayat: "Asisten pelatih, fokus kategori junior." },
    // Bulu Tangkis
    { namaPelatih: "Agus Setiawan", nomorLisensi: "LIC-BDM-001", cabor: "Bulu Tangkis", tingkatanLisensi: "Nasional", mulai: dateOf(2020, 8, 1), akhir: dateOf(2024, 7, 31), riwayat: "Alumni PB Djarum, pelatih ganda dan tunggal." },
    { namaPelatih: "Rina Oktaviani", nomorLisensi: "LIC-BDM-002", cabor: "Bulu Tangkis", tingkatanLisensi: "Daerah", mulai: dateOf(2022, 4, 1), akhir: dateOf(2025, 3, 31), riwayat: "Spesialis ganda putri, pelatih junior Batam." },
    // Karate
    { namaPelatih: "Firman Hidayat", nomorLisensi: "LIC-KRT-001", cabor: "Karate", tingkatanLisensi: "Nasional", mulai: dateOf(2021, 1, 1), akhir: dateOf(2025, 12, 31), riwayat: "Dan 4 Karate, pelatih kata dan kumite." },
    { namaPelatih: "Nurul Hidayah", nomorLisensi: "LIC-KRT-002", cabor: "Karate", tingkatanLisensi: "Daerah", mulai: dateOf(2023, 7, 1), akhir: dateOf(2026, 6, 30), riwayat: "Asisten pelatih, fokus kategori putri." },
    // Taekwondo
    { namaPelatih: "Bambang Irawan", nomorLisensi: "LIC-TKD-001", cabor: "Taekwondo", tingkatanLisensi: "Nasional", mulai: dateOf(2020, 1, 1), akhir: dateOf(2025, 12, 31), riwayat: "Pemegang sabuk hitam Dan 5, pelatih kepala Taekwondo Batam." },
    { namaPelatih: "Lestari Ningrum", nomorLisensi: "LIC-TKD-002", cabor: "Taekwondo", tingkatanLisensi: "Daerah", mulai: dateOf(2022, 9, 1), akhir: dateOf(2025, 8, 31), riwayat: "Dan 3, spesialis poomsae." },
    // Pencak Silat
    { namaPelatih: "Sarwono", nomorLisensi: "LIC-PS-001", cabor: "Pencak Silat", tingkatanLisensi: "Nasional", mulai: dateOf(2019, 1, 1), akhir: dateOf(2024, 12, 31), riwayat: "Pelatih tanding dan seni, veteran Pencak Silat nasional." },
    // Bola Voli
    { namaPelatih: "Dani Kurniawan", nomorLisensi: "LIC-VLY-001", cabor: "Bola Voli", tingkatanLisensi: "Nasional", mulai: dateOf(2021, 3, 1), akhir: dateOf(2025, 2, 28), riwayat: "Mantan pemain proliga, spesialis setter." },
    // Sepak Bola
    { namaPelatih: "Mulyadi", nomorLisensi: "LIC-FB-001", cabor: "Sepak Bola", tingkatanLisensi: "Nasional", mulai: dateOf(2020, 6, 1), akhir: dateOf(2025, 5, 31), riwayat: "Lisensi AFC C, pelatih kepala tim Batam." },
    { namaPelatih: "Hendra Saputra", nomorLisensi: "LIC-FB-002", cabor: "Sepak Bola", tingkatanLisensi: "Daerah", mulai: dateOf(2022, 1, 1), akhir: dateOf(2025, 12, 31), riwayat: "Asisten pelatih, khusus kiper dan pertahanan." },
  ];

  for (const p of pelatihData) {
    const existing = await prisma.pelatih.findUnique({ where: { nomorLisensi: p.nomorLisensi } });
    if (!existing) {
      await prisma.pelatih.create({
        data: {
          namaPelatih: p.namaPelatih,
          nomorLisensi: p.nomorLisensi,
          cabangOlahragaId: caborMap[p.cabor],
          tingkatanLisensi: p.tingkatanLisensi,
          masaBerlakuMulai: p.mulai,
          masaBerlakuAkhir: p.akhir,
          riwayatKepelatihan: p.riwayat,
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Pengurus Cabor (3 per cabor — Ketua, Sekretaris, Bendahara)
  // ---------------------------------------------------------------------------

  console.log("Seeding pengurus cabor...");

  const pengurusData: Array<{
    cabor: string;
    jabatan: string;
    namaPengurus: string;
    kontak: string;
    mulai: Date;
    akhir: Date;
    isKetua?: boolean;
  }> = [
    // Atletik
    { cabor: "Atletik", jabatan: "Ketua", namaPengurus: "Budi Santoso", kontak: "08111234001", mulai: dateOf(2023, 1, 1), akhir: dateOf(2027, 12, 31), isKetua: true },
    { cabor: "Atletik", jabatan: "Sekretaris", namaPengurus: "Citra Dewi", kontak: "08111234002", mulai: dateOf(2023, 1, 1), akhir: dateOf(2027, 12, 31) },
    { cabor: "Atletik", jabatan: "Bendahara", namaPengurus: "Eko Prasetyo", kontak: "08111234003", mulai: dateOf(2023, 1, 1), akhir: dateOf(2027, 12, 31) },
    // Renang
    { cabor: "Renang", jabatan: "Ketua", namaPengurus: "Dewi Kusuma", kontak: "08111234011", mulai: dateOf(2022, 6, 1), akhir: dateOf(2026, 5, 31), isKetua: true },
    { cabor: "Renang", jabatan: "Sekretaris", namaPengurus: "Fajar Nugroho", kontak: "08111234012", mulai: dateOf(2022, 6, 1), akhir: dateOf(2026, 5, 31) },
    { cabor: "Renang", jabatan: "Bendahara", namaPengurus: "Gita Lestari", kontak: "08111234013", mulai: dateOf(2022, 6, 1), akhir: dateOf(2026, 5, 31) },
    // Bulu Tangkis
    { cabor: "Bulu Tangkis", jabatan: "Ketua", namaPengurus: "Ahmad Fauzi", kontak: "08111234021", mulai: dateOf(2023, 3, 1), akhir: dateOf(2027, 2, 28), isKetua: true },
    { cabor: "Bulu Tangkis", jabatan: "Sekretaris", namaPengurus: "Hesti Ramadhani", kontak: "08111234022", mulai: dateOf(2023, 3, 1), akhir: dateOf(2027, 2, 28) },
    { cabor: "Bulu Tangkis", jabatan: "Bendahara", namaPengurus: "Iqbal Maulana", kontak: "08111234023", mulai: dateOf(2023, 3, 1), akhir: dateOf(2027, 2, 28) },
    // Karate
    { cabor: "Karate", jabatan: "Ketua", namaPengurus: "Hendri Wijaya", kontak: "08111234031", mulai: dateOf(2022, 1, 1), akhir: dateOf(2026, 12, 31), isKetua: true },
    { cabor: "Karate", jabatan: "Sekretaris", namaPengurus: "Juliana Putri", kontak: "08111234032", mulai: dateOf(2022, 1, 1), akhir: dateOf(2026, 12, 31) },
    { cabor: "Karate", jabatan: "Bendahara", namaPengurus: "Khairul Anwar", kontak: "08111234033", mulai: dateOf(2022, 1, 1), akhir: dateOf(2026, 12, 31) },
    // Taekwondo
    { cabor: "Taekwondo", jabatan: "Ketua", namaPengurus: "Siti Rahayu", kontak: "08111234041", mulai: dateOf(2023, 6, 1), akhir: dateOf(2027, 5, 31), isKetua: true },
    { cabor: "Taekwondo", jabatan: "Sekretaris", namaPengurus: "Lutfi Arifin", kontak: "08111234042", mulai: dateOf(2023, 6, 1), akhir: dateOf(2027, 5, 31) },
    { cabor: "Taekwondo", jabatan: "Bendahara", namaPengurus: "Mega Pratiwi", kontak: "08111234043", mulai: dateOf(2023, 6, 1), akhir: dateOf(2027, 5, 31) },
    // Pencak Silat
    { cabor: "Pencak Silat", jabatan: "Ketua", namaPengurus: "Ruslan Hakim", kontak: "08111234051", mulai: dateOf(2021, 1, 1), akhir: dateOf(2025, 12, 31), isKetua: true },
    { cabor: "Pencak Silat", jabatan: "Sekretaris", namaPengurus: "Nita Sari", kontak: "08111234052", mulai: dateOf(2021, 1, 1), akhir: dateOf(2025, 12, 31) },
    { cabor: "Pencak Silat", jabatan: "Bendahara", namaPengurus: "Oji Firmansyah", kontak: "08111234053", mulai: dateOf(2021, 1, 1), akhir: dateOf(2025, 12, 31) },
    // Bola Voli
    { cabor: "Bola Voli", jabatan: "Ketua", namaPengurus: "Maya Sari", kontak: "08111234061", mulai: dateOf(2022, 8, 1), akhir: dateOf(2026, 7, 31), isKetua: true },
    { cabor: "Bola Voli", jabatan: "Sekretaris", namaPengurus: "Pandu Setiawan", kontak: "08111234062", mulai: dateOf(2022, 8, 1), akhir: dateOf(2026, 7, 31) },
    { cabor: "Bola Voli", jabatan: "Bendahara", namaPengurus: "Qorina Azzahra", kontak: "08111234063", mulai: dateOf(2022, 8, 1), akhir: dateOf(2026, 7, 31) },
    // Sepak Bola
    { cabor: "Sepak Bola", jabatan: "Ketua", namaPengurus: "Rudi Hermawan", kontak: "08111234071", mulai: dateOf(2023, 1, 1), akhir: dateOf(2027, 12, 31), isKetua: true },
    { cabor: "Sepak Bola", jabatan: "Sekretaris", namaPengurus: "Sri Wahyuni", kontak: "08111234072", mulai: dateOf(2023, 1, 1), akhir: dateOf(2027, 12, 31) },
    { cabor: "Sepak Bola", jabatan: "Bendahara", namaPengurus: "Taufik Rahman", kontak: "08111234073", mulai: dateOf(2023, 1, 1), akhir: dateOf(2027, 12, 31) },
  ];

  // Map ketua jabatan to id so we can set reportsToId for sekretaris/bendahara
  const ketuaIdByCabor: Record<string, string> = {};
  for (const p of pengurusData) {
    const existing = await prisma.pengurusCabor.findFirst({
      where: { cabangOlahragaId: caborMap[p.cabor], jabatan: p.jabatan },
    });
    if (!existing) {
      const created = await prisma.pengurusCabor.create({
        data: {
          cabangOlahragaId: caborMap[p.cabor],
          namaPengurus: p.namaPengurus,
          jabatan: p.jabatan,
          masaBaktiMulai: p.mulai,
          masaBaktiAkhir: p.akhir,
          kontak: p.kontak,
          reportsToId: p.isKetua ? null : ketuaIdByCabor[p.cabor] ?? null,
        },
      });
      if (p.isKetua) ketuaIdByCabor[p.cabor] = created.id;
    } else {
      if (p.isKetua) ketuaIdByCabor[p.cabor] = existing.id;
    }
  }

  // ---------------------------------------------------------------------------
  // Atlet
  // ---------------------------------------------------------------------------

  console.log("Seeding atlet...");

  type AtletSeed = {
    nomorIndukAtlet: string;
    nomorRegistrasi: string;
    namaLengkap: string;
    nik: string;
    tempatLahir: string;
    tanggalLahir: Date;
    jenisKelamin: "L" | "P";
    alamat: string;
    kecamatan: string;
    nomorHp: string;
    email: string;
    cabor: string;
    statusAtlet: "ACTIVE" | "INACTIVE" | "INJURED" | "TRAINING_CAMP" | "TRANSFERRED";
    tingkatAtlet: "PEMULA" | "DAERAH" | "PROVINSI" | "NASIONAL" | "INTERNASIONAL";
    pendidikan: string;
    pekerjaan: string;
    extraCabor?: string;
  };

  const atletData: AtletSeed[] = [
    // Atletik
    { nomorIndukAtlet: "ATL-2021-001", nomorRegistrasi: "REG-ATL-001", namaLengkap: "Rizky Pratama", nik: "2171010101980001", tempatLahir: "Batam", tanggalLahir: dateOf(2001, 3, 15), jenisKelamin: "L", alamat: "Jl. Cendana No. 5, Batam Kota", kecamatan: "Batam Kota", nomorHp: "082112340001", email: "rizky.pratama@email.com", cabor: "Atletik", statusAtlet: "ACTIVE", tingkatAtlet: "NASIONAL", pendidikan: "S1", pekerjaan: "Mahasiswa" },
    { nomorIndukAtlet: "ATL-2021-002", nomorRegistrasi: "REG-ATL-002", namaLengkap: "Sari Dewi Anggraini", nik: "2171010101990002", tempatLahir: "Batam", tanggalLahir: dateOf(1999, 7, 22), jenisKelamin: "P", alamat: "Jl. Mawar No. 10, Lubuk Baja", kecamatan: "Lubuk Baja", nomorHp: "082112340002", email: "sari.dewi@email.com", cabor: "Atletik", statusAtlet: "ACTIVE", tingkatAtlet: "PROVINSI", pendidikan: "SMA", pekerjaan: "Pelajar" },
    { nomorIndukAtlet: "ATL-2022-003", nomorRegistrasi: "REG-ATL-003", namaLengkap: "Dani Wijaksono", nik: "2171010101980003", tempatLahir: "Tanjungpinang", tanggalLahir: dateOf(2000, 11, 8), jenisKelamin: "L", alamat: "Jl. Nangka No. 3, Sagulung", kecamatan: "Sagulung", nomorHp: "082112340003", email: "dani.wija@email.com", cabor: "Atletik", statusAtlet: "TRAINING_CAMP", tingkatAtlet: "NASIONAL", pendidikan: "SMA", pekerjaan: "Atlet Profesional" },
    { nomorIndukAtlet: "ATL-2022-004", nomorRegistrasi: "REG-ATL-004", namaLengkap: "Fitri Handayani", nik: "2171010102000004", tempatLahir: "Batam", tanggalLahir: dateOf(2003, 5, 30), jenisKelamin: "P", alamat: "Jl. Seroja No. 7, Bengkong", kecamatan: "Bengkong", nomorHp: "082112340004", email: "fitri.h@email.com", cabor: "Atletik", statusAtlet: "ACTIVE", tingkatAtlet: "DAERAH", pendidikan: "SMP", pekerjaan: "Pelajar" },
    // Renang
    { nomorIndukAtlet: "REN-2020-001", nomorRegistrasi: "REG-REN-001", namaLengkap: "Kevin Alamsyah", nik: "2171010101970005", tempatLahir: "Batam", tanggalLahir: dateOf(2002, 1, 14), jenisKelamin: "L", alamat: "Jl. Pelabuhan No. 2, Sekupang", kecamatan: "Sekupang", nomorHp: "082112340005", email: "kevin.a@email.com", cabor: "Renang", statusAtlet: "ACTIVE", tingkatAtlet: "NASIONAL", pendidikan: "SMA", pekerjaan: "Pelajar" },
    { nomorIndukAtlet: "REN-2021-002", nomorRegistrasi: "REG-REN-002", namaLengkap: "Linda Permata Sari", nik: "2171010102010006", tempatLahir: "Batam", tanggalLahir: dateOf(2001, 9, 5), jenisKelamin: "P", alamat: "Jl. Pantai Indah No. 11, Sekupang", kecamatan: "Sekupang", nomorHp: "082112340006", email: "linda.ps@email.com", cabor: "Renang", statusAtlet: "ACTIVE", tingkatAtlet: "PROVINSI", pendidikan: "SMA", pekerjaan: "Pelajar" },
    { nomorIndukAtlet: "REN-2022-003", nomorRegistrasi: "REG-REN-003", namaLengkap: "Muhammad Farel", nik: "2171010102020007", tempatLahir: "Batam", tanggalLahir: dateOf(2004, 6, 20), jenisKelamin: "L", alamat: "Jl. Kolam Renang No. 4, Batu Ampar", kecamatan: "Batu Ampar", nomorHp: "082112340007", email: "m.farel@email.com", cabor: "Renang", statusAtlet: "ACTIVE", tingkatAtlet: "DAERAH", pendidikan: "SMP", pekerjaan: "Pelajar" },
    { nomorIndukAtlet: "REN-2023-004", nomorRegistrasi: "REG-REN-004", namaLengkap: "Novia Ramadhani", nik: "2171010102040008", tempatLahir: "Batam", tanggalLahir: dateOf(2005, 3, 12), jenisKelamin: "P", alamat: "Jl. Telaga No. 8, Bengkong", kecamatan: "Bengkong", nomorHp: "082112340008", email: "novia.r@email.com", cabor: "Renang", statusAtlet: "INJURED", tingkatAtlet: "PEMULA", pendidikan: "SMP", pekerjaan: "Pelajar" },
    // Bulu Tangkis
    { nomorIndukAtlet: "BDM-2019-001", nomorRegistrasi: "REG-BDM-001", namaLengkap: "Oscar Firmansyah", nik: "2171010101990009", tempatLahir: "Batam", tanggalLahir: dateOf(1999, 4, 18), jenisKelamin: "L", alamat: "Jl. Badminton No. 6, Lubuk Baja", kecamatan: "Lubuk Baja", nomorHp: "082112340009", email: "oscar.f@email.com", cabor: "Bulu Tangkis", statusAtlet: "ACTIVE", tingkatAtlet: "NASIONAL", pendidikan: "S1", pekerjaan: "Atlet Profesional" },
    { nomorIndukAtlet: "BDM-2020-002", nomorRegistrasi: "REG-BDM-002", namaLengkap: "Putri Melati", nik: "2171010102000010", tempatLahir: "Batam", tanggalLahir: dateOf(2000, 12, 3), jenisKelamin: "P", alamat: "Jl. Seruni No. 9, Batam Kota", kecamatan: "Batam Kota", nomorHp: "082112340010", email: "putri.m@email.com", cabor: "Bulu Tangkis", statusAtlet: "ACTIVE", tingkatAtlet: "PROVINSI", pendidikan: "SMA", pekerjaan: "Pelajar", extraCabor: "Atletik" },
    { nomorIndukAtlet: "BDM-2021-003", nomorRegistrasi: "REG-BDM-003", namaLengkap: "Qori Asyari", nik: "2171010102020011", tempatLahir: "Tanjungpinang", tanggalLahir: dateOf(2002, 8, 25), jenisKelamin: "L", alamat: "Jl. Enggang No. 14, Nongsa", kecamatan: "Nongsa", nomorHp: "082112340011", email: "qori.a@email.com", cabor: "Bulu Tangkis", statusAtlet: "ACTIVE", tingkatAtlet: "DAERAH", pendidikan: "SMA", pekerjaan: "Pelajar" },
    // Karate
    { nomorIndukAtlet: "KRT-2020-001", nomorRegistrasi: "REG-KRT-001", namaLengkap: "Reva Handika", nik: "2171010102000012", tempatLahir: "Batam", tanggalLahir: dateOf(2000, 2, 10), jenisKelamin: "L", alamat: "Jl. Dojo No. 1, Batu Ampar", kecamatan: "Batu Ampar", nomorHp: "082112340012", email: "reva.h@email.com", cabor: "Karate", statusAtlet: "ACTIVE", tingkatAtlet: "NASIONAL", pendidikan: "S1", pekerjaan: "Karyawan" },
    { nomorIndukAtlet: "KRT-2021-002", nomorRegistrasi: "REG-KRT-002", namaLengkap: "Shella Anggraeni", nik: "2171010102010013", tempatLahir: "Batam", tanggalLahir: dateOf(2001, 6, 28), jenisKelamin: "P", alamat: "Jl. Merak No. 3, Sagulung", kecamatan: "Sagulung", nomorHp: "082112340013", email: "shella.a@email.com", cabor: "Karate", statusAtlet: "ACTIVE", tingkatAtlet: "PROVINSI", pendidikan: "SMA", pekerjaan: "Pelajar" },
    { nomorIndukAtlet: "KRT-2022-003", nomorRegistrasi: "REG-KRT-003", namaLengkap: "Teguh Wibowo", nik: "2171010102020014", tempatLahir: "Batam", tanggalLahir: dateOf(2003, 10, 15), jenisKelamin: "L", alamat: "Jl. Karang No. 5, Bengkong", kecamatan: "Bengkong", nomorHp: "082112340014", email: "teguh.w@email.com", cabor: "Karate", statusAtlet: "INACTIVE", tingkatAtlet: "DAERAH", pendidikan: "SMP", pekerjaan: "Pelajar" },
    // Taekwondo
    { nomorIndukAtlet: "TKD-2021-001", nomorRegistrasi: "REG-TKD-001", namaLengkap: "Ulfa Nurdiana", nik: "2171010102000015", tempatLahir: "Batam", tanggalLahir: dateOf(2001, 4, 7), jenisKelamin: "P", alamat: "Jl. Bunga No. 12, Nongsa", kecamatan: "Nongsa", nomorHp: "082112340015", email: "ulfa.n@email.com", cabor: "Taekwondo", statusAtlet: "ACTIVE", tingkatAtlet: "NASIONAL", pendidikan: "S1", pekerjaan: "Mahasiswa" },
    { nomorIndukAtlet: "TKD-2022-002", nomorRegistrasi: "REG-TKD-002", namaLengkap: "Victor Siagian", nik: "2171010102020016", tempatLahir: "Medan", tanggalLahir: dateOf(2002, 11, 19), jenisKelamin: "L", alamat: "Jl. Pungkur No. 8, Batam Kota", kecamatan: "Batam Kota", nomorHp: "082112340016", email: "victor.s@email.com", cabor: "Taekwondo", statusAtlet: "ACTIVE", tingkatAtlet: "PROVINSI", pendidikan: "SMA", pekerjaan: "Pelajar" },
    { nomorIndukAtlet: "TKD-2023-003", nomorRegistrasi: "REG-TKD-003", namaLengkap: "Wulan Pertiwi", nik: "2171010102040017", tempatLahir: "Batam", tanggalLahir: dateOf(2004, 2, 14), jenisKelamin: "P", alamat: "Jl. Anggrek No. 6, Sekupang", kecamatan: "Sekupang", nomorHp: "082112340017", email: "wulan.p@email.com", cabor: "Taekwondo", statusAtlet: "ACTIVE", tingkatAtlet: "DAERAH", pendidikan: "SMP", pekerjaan: "Pelajar" },
    // Pencak Silat
    { nomorIndukAtlet: "PS-2020-001", nomorRegistrasi: "REG-PS-001", namaLengkap: "Xandra Kurnia", nik: "2171010102000018", tempatLahir: "Batam", tanggalLahir: dateOf(2001, 8, 23), jenisKelamin: "P", alamat: "Jl. Pahlawan No. 4, Lubuk Baja", kecamatan: "Lubuk Baja", nomorHp: "082112340018", email: "xandra.k@email.com", cabor: "Pencak Silat", statusAtlet: "ACTIVE", tingkatAtlet: "NASIONAL", pendidikan: "S1", pekerjaan: "Atlet Profesional" },
    { nomorIndukAtlet: "PS-2021-002", nomorRegistrasi: "REG-PS-002", namaLengkap: "Yahya Zulfan", nik: "2171010102020019", tempatLahir: "Batam", tanggalLahir: dateOf(2002, 5, 11), jenisKelamin: "L", alamat: "Jl. Satria No. 9, Batu Ampar", kecamatan: "Batu Ampar", nomorHp: "082112340019", email: "yahya.z@email.com", cabor: "Pencak Silat", statusAtlet: "ACTIVE", tingkatAtlet: "PROVINSI", pendidikan: "SMA", pekerjaan: "Pelajar" },
    { nomorIndukAtlet: "PS-2022-003", nomorRegistrasi: "REG-PS-003", namaLengkap: "Zara Amalia", nik: "2171010102030020", tempatLahir: "Batam", tanggalLahir: dateOf(2003, 9, 4), jenisKelamin: "P", alamat: "Jl. Pesilat No. 2, Bengkong", kecamatan: "Bengkong", nomorHp: "082112340020", email: "zara.a@email.com", cabor: "Pencak Silat", statusAtlet: "TRANSFERRED", tingkatAtlet: "DAERAH", pendidikan: "SMA", pekerjaan: "Pelajar" },
    // Bola Voli
    { nomorIndukAtlet: "VLY-2020-001", nomorRegistrasi: "REG-VLY-001", namaLengkap: "Adi Nugroho", nik: "2171010101990021", tempatLahir: "Batam", tanggalLahir: dateOf(1999, 1, 17), jenisKelamin: "L", alamat: "Jl. Voli No. 3, Batam Kota", kecamatan: "Batam Kota", nomorHp: "082112340021", email: "adi.n@email.com", cabor: "Bola Voli", statusAtlet: "ACTIVE", tingkatAtlet: "NASIONAL", pendidikan: "S1", pekerjaan: "Karyawan" },
    { nomorIndukAtlet: "VLY-2021-002", nomorRegistrasi: "REG-VLY-002", namaLengkap: "Bella Kusuma", nik: "2171010102010022", tempatLahir: "Batam", tanggalLahir: dateOf(2001, 7, 9), jenisKelamin: "P", alamat: "Jl. Smash No. 7, Bengkong", kecamatan: "Bengkong", nomorHp: "082112340022", email: "bella.k@email.com", cabor: "Bola Voli", statusAtlet: "ACTIVE", tingkatAtlet: "PROVINSI", pendidikan: "SMA", pekerjaan: "Pelajar" },
    { nomorIndukAtlet: "VLY-2022-003", nomorRegistrasi: "REG-VLY-003", namaLengkap: "Chandra Setiawan", nik: "2171010102030023", tempatLahir: "Batam", tanggalLahir: dateOf(2003, 4, 26), jenisKelamin: "L", alamat: "Jl. Spike No. 11, Sagulung", kecamatan: "Sagulung", nomorHp: "082112340023", email: "chandra.s@email.com", cabor: "Bola Voli", statusAtlet: "ACTIVE", tingkatAtlet: "DAERAH", pendidikan: "SMP", pekerjaan: "Pelajar" },
    // Sepak Bola
    { nomorIndukAtlet: "FB-2019-001", nomorRegistrasi: "REG-FB-001", namaLengkap: "Dimas Prasetyo", nik: "2171010101980024", tempatLahir: "Batam", tanggalLahir: dateOf(1998, 3, 21), jenisKelamin: "L", alamat: "Jl. Lapangan No. 1, Batam Kota", kecamatan: "Batam Kota", nomorHp: "082112340024", email: "dimas.p@email.com", cabor: "Sepak Bola", statusAtlet: "ACTIVE", tingkatAtlet: "NASIONAL", pendidikan: "S1", pekerjaan: "Atlet Profesional" },
    { nomorIndukAtlet: "FB-2020-002", nomorRegistrasi: "REG-FB-002", namaLengkap: "Eka Supriadi", nik: "2171010102000025", tempatLahir: "Batam", tanggalLahir: dateOf(2000, 10, 30), jenisKelamin: "L", alamat: "Jl. Tribun No. 5, Lubuk Baja", kecamatan: "Lubuk Baja", nomorHp: "082112340025", email: "eka.s@email.com", cabor: "Sepak Bola", statusAtlet: "ACTIVE", tingkatAtlet: "PROVINSI", pendidikan: "SMA", pekerjaan: "Pelajar" },
    { nomorIndukAtlet: "FB-2021-003", nomorRegistrasi: "REG-FB-003", namaLengkap: "Farhan Al-Rasyid", nik: "2171010102020026", tempatLahir: "Batam", tanggalLahir: dateOf(2002, 6, 16), jenisKelamin: "L", alamat: "Jl. Gawang No. 8, Nongsa", kecamatan: "Nongsa", nomorHp: "082112340026", email: "farhan.r@email.com", cabor: "Sepak Bola", statusAtlet: "ACTIVE", tingkatAtlet: "DAERAH", pendidikan: "SMA", pekerjaan: "Pelajar" },
  ];

  // Map nomorIndukAtlet → atlet id for later use
  const atletIdMap: Record<string, string> = {};

  for (const a of atletData) {
    const existing = await prisma.atlet.findUnique({
      where: { nomorIndukAtlet: a.nomorIndukAtlet },
    });
    if (!existing) {
      const created = await prisma.atlet.create({
        data: {
          nomorIndukAtlet: a.nomorIndukAtlet,
          nomorRegistrasi: a.nomorRegistrasi,
          namaLengkap: a.namaLengkap,
          nik: a.nik,
          tempatLahir: a.tempatLahir,
          tanggalLahir: a.tanggalLahir,
          jenisKelamin: a.jenisKelamin,
          alamat: a.alamat,
          kecamatan: a.kecamatan,
          nomorHp: a.nomorHp,
          email: a.email,
          cabangOlahragaId: caborMap[a.cabor],
          statusAtlet: a.statusAtlet,
          tingkatAtlet: a.tingkatAtlet,
          pendidikan: a.pendidikan,
          pekerjaan: a.pekerjaan,
        },
      });
      atletIdMap[a.nomorIndukAtlet] = created.id;
    } else {
      atletIdMap[a.nomorIndukAtlet] = existing.id;
    }
  }

  // ---------------------------------------------------------------------------
  // AtletCabor (multi-cabor)
  // ---------------------------------------------------------------------------

  console.log("Seeding atlet cabor tambahan...");

  const extraCaborEntries = atletData.filter((a) => a.extraCabor);
  for (const a of extraCaborEntries) {
    const atletId = atletIdMap[a.nomorIndukAtlet];
    const extraCaborId = caborMap[a.extraCabor!];
    if (atletId && extraCaborId) {
      const existing = await prisma.atletCabor.findUnique({
        where: { atletId_cabangOlahragaId: { atletId, cabangOlahragaId: extraCaborId } },
      });
      if (!existing) {
        await prisma.atletCabor.create({
          data: { atletId, cabangOlahragaId: extraCaborId },
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // ATLET user accounts (for a few athletes)
  // ---------------------------------------------------------------------------

  console.log("Seeding atlet user accounts...");

  const atletUsers = [
    { email: "rizky.pratama@email.com", fullName: "Rizky Pratama", nomorInduk: "ATL-2021-001" },
    { email: "oscar.f@email.com", fullName: "Oscar Firmansyah", nomorInduk: "BDM-2019-001" },
    { email: "ulfa.n@email.com", fullName: "Ulfa Nurdiana", nomorInduk: "TKD-2021-001" },
    { email: "xandra.k@email.com", fullName: "Xandra Kurnia", nomorInduk: "PS-2020-001" },
  ];

  for (const au of atletUsers) {
    const atletId = atletIdMap[au.nomorInduk];
    if (!atletId) continue;
    const existing = await prisma.user.findUnique({ where: { email: au.email } });
    if (!existing) {
      await prisma.user.create({
        data: {
          email: au.email,
          passwordHash,
          role: "ATLET",
          fullName: au.fullName,
          athleteId: atletId,
        },
      });
    } else if (!existing.athleteId) {
      await prisma.user.update({
        where: { email: au.email },
        data: { athleteId: atletId },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Prestasi
  // ---------------------------------------------------------------------------

  console.log("Seeding prestasi...");

  type PrestasiSeed = {
    nomorInduk: string;
    namaKejuaraan: string;
    tingkat: "KOTA" | "PROVINSI" | "NASIONAL" | "INTERNASIONAL";
    tahun: number;
    medali: "GOLD" | "SILVER" | "BRONZE" | "NONE";
    peringkat?: number;
  };

  const prestasiData: PrestasiSeed[] = [
    // Rizky Pratama (Atletik)
    { nomorInduk: "ATL-2021-001", namaKejuaraan: "Kejuaraan Atletik Nasional 2024", tingkat: "NASIONAL", tahun: 2024, medali: "GOLD" },
    { nomorInduk: "ATL-2021-001", namaKejuaraan: "Porprov Kepri 2023", tingkat: "PROVINSI", tahun: 2023, medali: "GOLD" },
    { nomorInduk: "ATL-2021-001", namaKejuaraan: "Pekan Olahraga Kota Batam 2022", tingkat: "KOTA", tahun: 2022, medali: "GOLD" },
    // Sari Dewi (Atletik)
    { nomorInduk: "ATL-2021-002", namaKejuaraan: "Porprov Kepri 2023", tingkat: "PROVINSI", tahun: 2023, medali: "SILVER" },
    { nomorInduk: "ATL-2021-002", namaKejuaraan: "Pekan Olahraga Kota Batam 2023", tingkat: "KOTA", tahun: 2023, medali: "GOLD" },
    // Dani Wijaksono (Atletik)
    { nomorInduk: "ATL-2022-003", namaKejuaraan: "Seleknas Atletik 2024", tingkat: "NASIONAL", tahun: 2024, medali: "NONE", peringkat: 4 },
    { nomorInduk: "ATL-2022-003", namaKejuaraan: "Porprov Kepri 2023", tingkat: "PROVINSI", tahun: 2023, medali: "BRONZE" },
    // Kevin Alamsyah (Renang)
    { nomorInduk: "REN-2020-001", namaKejuaraan: "Kejurnas Renang 2024", tingkat: "NASIONAL", tahun: 2024, medali: "SILVER" },
    { nomorInduk: "REN-2020-001", namaKejuaraan: "Porprov Kepri 2023", tingkat: "PROVINSI", tahun: 2023, medali: "GOLD" },
    { nomorInduk: "REN-2020-001", namaKejuaraan: "SEA Games 2023 (Kualifikasi)", tingkat: "INTERNASIONAL", tahun: 2023, medali: "NONE", peringkat: 6 },
    // Linda Permata Sari (Renang)
    { nomorInduk: "REN-2021-002", namaKejuaraan: "Porprov Kepri 2023", tingkat: "PROVINSI", tahun: 2023, medali: "SILVER" },
    { nomorInduk: "REN-2021-002", namaKejuaraan: "Pekan Olahraga Kota Batam 2023", tingkat: "KOTA", tahun: 2023, medali: "GOLD" },
    // Oscar Firmansyah (Bulu Tangkis)
    { nomorInduk: "BDM-2019-001", namaKejuaraan: "Indonesian Open Junior 2024", tingkat: "INTERNASIONAL", tahun: 2024, medali: "BRONZE" },
    { nomorInduk: "BDM-2019-001", namaKejuaraan: "Kejurnas Bulu Tangkis 2023", tingkat: "NASIONAL", tahun: 2023, medali: "GOLD" },
    { nomorInduk: "BDM-2019-001", namaKejuaraan: "Porprov Kepri 2023", tingkat: "PROVINSI", tahun: 2023, medali: "GOLD" },
    // Putri Melati (Bulu Tangkis)
    { nomorInduk: "BDM-2020-002", namaKejuaraan: "Kejurnas Bulu Tangkis 2024", tingkat: "NASIONAL", tahun: 2024, medali: "SILVER" },
    { nomorInduk: "BDM-2020-002", namaKejuaraan: "Porprov Kepri 2023", tingkat: "PROVINSI", tahun: 2023, medali: "GOLD" },
    // Reva Handika (Karate)
    { nomorInduk: "KRT-2020-001", namaKejuaraan: "Kejurnas Karate 2024", tingkat: "NASIONAL", tahun: 2024, medali: "GOLD" },
    { nomorInduk: "KRT-2020-001", namaKejuaraan: "Porprov Kepri 2023", tingkat: "PROVINSI", tahun: 2023, medali: "GOLD" },
    { nomorInduk: "KRT-2020-001", namaKejuaraan: "Open Karate Internasional Batam 2023", tingkat: "INTERNASIONAL", tahun: 2023, medali: "SILVER" },
    // Shella Anggraeni (Karate)
    { nomorInduk: "KRT-2021-002", namaKejuaraan: "Porprov Kepri 2023", tingkat: "PROVINSI", tahun: 2023, medali: "BRONZE" },
    { nomorInduk: "KRT-2021-002", namaKejuaraan: "Pekan Olahraga Kota Batam 2023", tingkat: "KOTA", tahun: 2023, medali: "GOLD" },
    // Ulfa Nurdiana (Taekwondo)
    { nomorInduk: "TKD-2021-001", namaKejuaraan: "Kejurnas Taekwondo 2024", tingkat: "NASIONAL", tahun: 2024, medali: "GOLD" },
    { nomorInduk: "TKD-2021-001", namaKejuaraan: "Porprov Kepri 2023", tingkat: "PROVINSI", tahun: 2023, medali: "GOLD" },
    { nomorInduk: "TKD-2021-001", namaKejuaraan: "Asian Taekwondo Championship 2023", tingkat: "INTERNASIONAL", tahun: 2023, medali: "BRONZE" },
    // Victor Siagian (Taekwondo)
    { nomorInduk: "TKD-2022-002", namaKejuaraan: "Porprov Kepri 2023", tingkat: "PROVINSI", tahun: 2023, medali: "SILVER" },
    { nomorInduk: "TKD-2022-002", namaKejuaraan: "Pekan Olahraga Kota Batam 2023", tingkat: "KOTA", tahun: 2023, medali: "GOLD" },
    // Xandra Kurnia (Pencak Silat)
    { nomorInduk: "PS-2020-001", namaKejuaraan: "Kejurnas Pencak Silat 2024", tingkat: "NASIONAL", tahun: 2024, medali: "GOLD" },
    { nomorInduk: "PS-2020-001", namaKejuaraan: "SEA Games Pencak Silat 2023", tingkat: "INTERNASIONAL", tahun: 2023, medali: "SILVER" },
    { nomorInduk: "PS-2020-001", namaKejuaraan: "Porprov Kepri 2023", tingkat: "PROVINSI", tahun: 2023, medali: "GOLD" },
    // Yahya Zulfan (Pencak Silat)
    { nomorInduk: "PS-2021-002", namaKejuaraan: "Porprov Kepri 2023", tingkat: "PROVINSI", tahun: 2023, medali: "BRONZE" },
    { nomorInduk: "PS-2021-002", namaKejuaraan: "Pekan Olahraga Kota Batam 2023", tingkat: "KOTA", tahun: 2023, medali: "GOLD" },
    // Adi Nugroho (Bola Voli)
    { nomorInduk: "VLY-2020-001", namaKejuaraan: "Proliga 2024 (Kualifikasi)", tingkat: "NASIONAL", tahun: 2024, medali: "NONE", peringkat: 5 },
    { nomorInduk: "VLY-2020-001", namaKejuaraan: "Porprov Kepri 2023", tingkat: "PROVINSI", tahun: 2023, medali: "GOLD" },
    // Bella Kusuma (Bola Voli)
    { nomorInduk: "VLY-2021-002", namaKejuaraan: "Porprov Kepri 2023", tingkat: "PROVINSI", tahun: 2023, medali: "GOLD" },
    { nomorInduk: "VLY-2021-002", namaKejuaraan: "Pekan Olahraga Kota Batam 2023", tingkat: "KOTA", tahun: 2023, medali: "GOLD" },
    // Dimas Prasetyo (Sepak Bola)
    { nomorInduk: "FB-2019-001", namaKejuaraan: "Porprov Kepri 2023 (Tim)", tingkat: "PROVINSI", tahun: 2023, medali: "GOLD" },
    { nomorInduk: "FB-2019-001", namaKejuaraan: "Liga 3 Kepri 2022", tingkat: "PROVINSI", tahun: 2022, medali: "SILVER" },
    // Eka Supriadi (Sepak Bola)
    { nomorInduk: "FB-2020-002", namaKejuaraan: "Porprov Kepri 2023 (Tim)", tingkat: "PROVINSI", tahun: 2023, medali: "GOLD" },
    { nomorInduk: "FB-2020-002", namaKejuaraan: "Pekan Olahraga Kota Batam 2022", tingkat: "KOTA", tahun: 2022, medali: "BRONZE" },
  ];

  for (const p of prestasiData) {
    const atletId = atletIdMap[p.nomorInduk];
    if (!atletId) continue;
    const existing = await prisma.prestasi.findFirst({
      where: { atletId, namaKejuaraan: p.namaKejuaraan, tahun: p.tahun },
    });
    if (!existing) {
      await prisma.prestasi.create({
        data: {
          atletId,
          namaKejuaraan: p.namaKejuaraan,
          tingkatKejuaraan: p.tingkat,
          tahun: p.tahun,
          medali: p.medali,
          peringkat: p.peringkat ?? null,
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Monitoring Events
  // ---------------------------------------------------------------------------

  console.log("Seeding monitoring events...");

  type MonitoringEventSeed = {
    nomorInduk: string;
    type: "INJURY" | "MUTATION" | "TRAINING_CAMP" | "SELECTION" | "STATUS_CHANGE";
    description: string;
    fromValue?: string;
    toValue?: string;
    eventDate: Date;
    mutationStatus?: "PENDING" | "APPROVED" | "REJECTED";
  };

  const monitoringData: MonitoringEventSeed[] = [
    { nomorInduk: "ATL-2022-003", type: "TRAINING_CAMP", description: "Pemusatan latihan persiapan Kejurnas 2025 di Jakarta", eventDate: dateOf(2025, 3, 1) },
    { nomorInduk: "REN-2023-004", type: "INJURY", description: "Cedera bahu kanan akibat latihan intensif, istirahat 6 minggu", eventDate: dateOf(2025, 2, 10) },
    { nomorInduk: "REN-2023-004", type: "STATUS_CHANGE", description: "Status diubah ke INJURED akibat cedera bahu", fromValue: "ACTIVE", toValue: "INJURED", eventDate: dateOf(2025, 2, 11) },
    { nomorInduk: "PS-2022-003", type: "MUTATION", description: "Mutasi ke Pencak Silat Batam Barat", fromValue: "Pencak Silat", toValue: "Pencak Silat Batam Barat", mutationStatus: "APPROVED", eventDate: dateOf(2024, 11, 15) },
    { nomorInduk: "PS-2022-003", type: "STATUS_CHANGE", description: "Status berubah menjadi TRANSFERRED pasca mutasi", fromValue: "ACTIVE", toValue: "TRANSFERRED", eventDate: dateOf(2024, 11, 15) },
    { nomorInduk: "KRT-2022-003", type: "STATUS_CHANGE", description: "Atlet non-aktif karena fokus ujian akademik", fromValue: "ACTIVE", toValue: "INACTIVE", eventDate: dateOf(2024, 10, 1) },
    { nomorInduk: "BDM-2019-001", type: "SELECTION", description: "Lolos seleksi Pelatnas Bulu Tangkis Junior 2025", eventDate: dateOf(2024, 12, 20) },
    { nomorInduk: "ATL-2021-001", type: "SELECTION", description: "Lolos seleksi nasional nomor lari 100m", eventDate: dateOf(2024, 9, 5) },
    { nomorInduk: "TKD-2021-001", type: "TRAINING_CAMP", description: "Pemusatan latihan persiapan PON 2024", eventDate: dateOf(2024, 7, 1) },
    { nomorInduk: "KRT-2020-001", type: "SELECTION", description: "Terpilih mewakili Indonesia di Open Karate Internasional", eventDate: dateOf(2023, 10, 10) },
    { nomorInduk: "PS-2020-001", type: "SELECTION", description: "Lolos seleksi SEA Games cabor Pencak Silat", eventDate: dateOf(2023, 4, 15) },
    { nomorInduk: "REN-2020-001", type: "TRAINING_CAMP", description: "Pemusatan latihan di Kolam Renang Nasional Senayan", eventDate: dateOf(2024, 1, 10) },
  ];

  for (const m of monitoringData) {
    const atletId = atletIdMap[m.nomorInduk];
    if (!atletId) continue;
    const existing = await prisma.monitoringEvent.findFirst({
      where: { atletId, type: m.type, description: m.description },
    });
    if (!existing) {
      await prisma.monitoringEvent.create({
        data: {
          atletId,
          type: m.type,
          description: m.description,
          fromValue: m.fromValue ?? null,
          toValue: m.toValue ?? null,
          mutationStatus: m.mutationStatus ?? null,
          eventDate: m.eventDate,
          createdById: superAdmin.id,
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Atlet Cards (for active athletes)
  // ---------------------------------------------------------------------------

  console.log("Seeding atlet cards...");

  const activeAtlets = ["ATL-2021-001", "ATL-2021-002", "REN-2020-001", "REN-2021-002", "BDM-2019-001", "KRT-2020-001", "TKD-2021-001", "PS-2020-001", "VLY-2020-001", "VLY-2021-002", "FB-2019-001"];

  for (const nomorInduk of activeAtlets) {
    const atletId = atletIdMap[nomorInduk];
    if (!atletId) continue;
    const existing = await prisma.atletCard.findFirst({
      where: { atletId, isRevoked: false },
    });
    if (!existing) {
      const cardCode = nanoid();
      await prisma.atletCard.create({
        data: {
          atletId,
          cardCode,
          qrPayloadUrl: `${CARD_VERIFY_BASE_URL}/${cardCode}`,
          expiresAt: dateOf(2026, 12, 31),
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Articles
  // ---------------------------------------------------------------------------

  console.log("Seeding articles...");

  type ArticleSeed = {
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    published: boolean;
  };

  const articleData: ArticleSeed[] = [
    {
      title: "KONI Batam Raih 12 Medali di Porprov Kepri 2023",
      slug: "koni-batam-raih-12-medali-porprov-kepri-2023",
      excerpt: "Kontingen KONI Batam berhasil meraih total 12 medali — 6 emas, 4 perak, dan 2 perunggu — dalam Pekan Olahraga Provinsi Kepulauan Riau 2023.",
      content: "<p>Kontingen KONI Batam tampil membanggakan dalam Pekan Olahraga Provinsi (Porprov) Kepulauan Riau 2023 yang berlangsung di Tanjungpinang. Dengan total perolehan 12 medali — 6 emas, 4 perak, dan 2 perunggu — Batam berhasil menempati posisi kedua dalam klasemen akhir.</p><p>Cabang olahraga Karate dan Taekwondo menjadi penyumbang medali terbanyak, masing-masing meraih 2 medali emas. Atlet andalan Reva Handika dari Karate dan Ulfa Nurdiana dari Taekwondo tampil luar biasa di babak final.</p><p>Ketua KONI Batam menyampaikan apresiasi kepada seluruh atlet, pelatih, dan pengurus cabor atas kerja keras dan dedikasi mereka selama masa persiapan.</p>",
      published: true,
    },
    {
      title: "Rizky Pratama Ukir Rekor Lari 100m di Kejurnas 2024",
      slug: "rizky-pratama-ukir-rekor-lari-100m-kejurnas-2024",
      excerpt: "Atlet Atletik KONI Batam, Rizky Pratama, berhasil memecahkan rekor nasional lari 100m putra dengan catatan waktu 10,05 detik.",
      content: "<p>Rizky Pratama, atlet lari andalan KONI Batam, mencatatkan prestasi membanggakan di Kejuaraan Nasional Atletik 2024 yang digelar di Jakarta. Dengan catatan waktu 10,05 detik, Rizky berhasil memecahkan rekor nasional lari 100m putra sekaligus merebut medali emas.</p><p>Pelatihnya, Suparman, mengungkapkan bahwa pencapaian ini merupakan hasil dari program latihan intensif selama 18 bulan terakhir. Rizky juga menjalani pemusatan latihan di Jakarta selama tiga bulan sebagai persiapan kejuaraan.</p><p>Prestasi ini membuka peluang Rizky untuk dipertimbangkan masuk Pelatnas menjelang SEA Games 2025.</p>",
      published: true,
    },
    {
      title: "Pendaftaran Seleksi Atlet Junior KONI Batam 2025 Dibuka",
      slug: "pendaftaran-seleksi-atlet-junior-koni-batam-2025",
      excerpt: "KONI Batam membuka pendaftaran seleksi atlet junior untuk persiapan Porprov Kepri 2025. Pendaftaran dibuka mulai 1 Juli 2025.",
      content: "<p>KONI Batam resmi membuka pendaftaran seleksi atlet junior dalam rangka persiapan Pekan Olahraga Provinsi (Porprov) Kepri 2025. Program ini terbuka untuk atlet berusia 13-20 tahun yang berdomisili di Kota Batam.</p><p><strong>Cabang olahraga yang diseleksi:</strong></p><ul><li>Atletik</li><li>Renang</li><li>Bulu Tangkis</li><li>Karate</li><li>Taekwondo</li><li>Pencak Silat</li><li>Bola Voli</li><li>Sepak Bola</li></ul><p>Pendaftaran dilakukan secara online melalui website resmi KONI Batam atau langsung ke sekretariat masing-masing cabang olahraga. Seleksi akan dilaksanakan pada bulan Agustus 2025.</p>",
      published: true,
    },
    {
      title: "Kevin Alamsyah Wakili Kepri di Kejurnas Renang 2024",
      slug: "kevin-alamsyah-wakili-kepri-kejurnas-renang-2024",
      excerpt: "Perenang muda Kevin Alamsyah berhasil lolos seleksi dan mewakili Kepulauan Riau di Kejuaraan Nasional Renang 2024.",
      content: "<p>Kevin Alamsyah, perenang muda asal Batam, berhasil lolos seleksi dan mewakili Provinsi Kepulauan Riau di Kejuaraan Nasional Renang 2024. Kevin akan turun di nomor 100m gaya bebas putra dan 200m gaya punggung putra.</p><p>Pelatih Halim Prasetyo mengungkapkan bahwa Kevin telah menunjukkan perkembangan luar biasa dalam 12 bulan terakhir. Program latihan dua kali sehari di kolam renang Sekupang menjadi kunci keberhasilannya.</p><p>Kevin menargetkan minimal satu medali di kejuaraan nasional ini sebagai modal persiapan menuju Porprov 2025.</p>",
      published: true,
    },
    {
      title: "KONI Batam Luncurkan Sistem Kartu Atlet Digital",
      slug: "koni-batam-luncurkan-kartu-atlet-digital",
      excerpt: "KONI Batam resmi meluncurkan sistem Kartu Atlet Digital berbasis QR Code untuk mempermudah verifikasi identitas atlet.",
      content: "<p>KONI Batam resmi meluncurkan sistem Kartu Atlet Digital pada bulan Juni 2025. Sistem ini memungkinkan setiap atlet terdaftar memiliki kartu identitas digital yang dapat diverifikasi secara real-time menggunakan QR Code.</p><p>Ketua KONI Batam menjelaskan bahwa inovasi ini bertujuan untuk meningkatkan efisiensi administrasi dan memudahkan verifikasi keaslian status atlet di berbagai kejuaraan. Kartu digital ini menggantikan kartu fisik yang selama ini mudah rusak atau hilang.</p><p>Atlet dapat mengunduh kartu mereka dalam format PDF atau PNG melalui aplikasi KONI Batam, dan kartu tersebut dapat dipindai menggunakan smartphone untuk memverifikasi keasliannya secara instan.</p>",
      published: true,
    },
    {
      title: "Program Pembinaan Atlet Muda KONI Batam 2025",
      slug: "program-pembinaan-atlet-muda-koni-batam-2025",
      excerpt: "KONI Batam meluncurkan program pembinaan atlet muda dengan alokasi anggaran lebih besar untuk mendukung regenerasi atlet berprestasi.",
      content: "<p>Sebagai upaya regenerasi atlet, KONI Batam meluncurkan Program Pembinaan Atlet Muda (PPAM) 2025 dengan alokasi anggaran yang lebih besar dibandingkan tahun-tahun sebelumnya.</p><p>Program ini mencakup pelatihan rutin, uji coba ke kejuaraan tingkat provinsi, serta pemantauan perkembangan atlet secara berkala melalui sistem monitoring digital yang baru diluncurkan.</p><p>Seluruh cabang olahraga di bawah naungan KONI Batam dapat mengajukan proposal pembinaan atlet muda mereka masing-masing. Prioritas diberikan kepada cabor yang memiliki potensi medali di Porprov Kepri 2025 dan PON 2028.</p>",
      published: false,
    },
  ];

  for (const article of articleData) {
    const existing = await prisma.article.findUnique({ where: { slug: article.slug } });
    if (!existing) {
      await prisma.article.create({
        data: {
          title: article.title,
          slug: article.slug,
          excerpt: article.excerpt,
          content: article.content,
          published: article.published,
          publishedAt: article.published ? new Date() : null,
          authorId: superAdmin.id,
        },
      });
    }
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
