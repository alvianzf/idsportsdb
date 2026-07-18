import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Button } from "../components/ui";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
    } catch {
      // Swallow errors — we never reveal whether the email exists
    } finally {
      setLoading(false);
      setSent(true);
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-neutral-50 p-4">
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-6">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <img src="/logo-koni-batam.png" alt="KONI Batam" className="h-16 w-16 object-contain" />
          <h1 className="text-lg font-semibold text-neutral-900">Lupa Kata Sandi</h1>
          <p className="text-sm text-neutral-500">
            Masukkan email Anda dan kami akan mengirimkan tautan untuk mereset kata sandi.
          </p>
        </div>

        {sent ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-neutral-700">
              Jika email Anda terdaftar, instruksi reset kata sandi akan segera dikirimkan.
              Periksa kotak masuk Anda.
            </p>
            <Link to="/login" className="text-sm font-medium text-primary hover:underline">
              Kembali ke halaman masuk
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-neutral-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="name@example.com"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Mengirim..." : "Kirim Tautan Reset"}
            </Button>

            <p className="text-center text-sm text-neutral-500">
              <Link to="/login" className="font-medium text-primary hover:underline">
                Kembali ke halaman masuk
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
