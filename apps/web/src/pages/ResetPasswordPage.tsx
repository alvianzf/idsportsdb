import { useState, type FormEvent } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Button, PasswordInput } from "../components/ui";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-neutral-50 p-4">
        <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-6 text-center">
          <p className="text-sm text-danger">Tautan reset tidak valid. Silakan minta ulang.</p>
          <Link to="/forgot-password" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
            Minta tautan baru
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) { setError("Kata sandi tidak cocok."); return; }
    if (password.length < 8) { setError("Kata sandi minimal 8 karakter."); return; }

    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      navigate("/login?reset=1");
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      setError(msg ?? "Tautan reset tidak valid atau sudah kedaluwarsa.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-neutral-50 p-4">
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-6">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <img src="/logo-koni-batam.png" alt="KONI Batam" className="h-16 w-16 object-contain" />
          <h1 className="text-lg font-semibold text-neutral-900">Buat Kata Sandi Baru</h1>
          <p className="text-sm text-neutral-500">Masukkan kata sandi baru Anda di bawah ini.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-neutral-700">
              Kata Sandi Baru
            </label>
            <PasswordInput
              id="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 8 karakter"
            />
          </div>
          <div>
            <label htmlFor="confirm" className="mb-1 block text-sm font-medium text-neutral-700">
              Konfirmasi Kata Sandi
            </label>
            <PasswordInput
              id="confirm"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Ulangi kata sandi baru"
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Menyimpan..." : "Simpan Kata Sandi Baru"}
          </Button>
        </form>
      </div>
    </div>
  );
}
