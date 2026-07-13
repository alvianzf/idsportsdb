import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import { Button, PasswordInput } from "../components/ui";

export function LoginPage() {
  const user = useAuthStore((state) => state.user);
  const setSession = useAuthStore((state) => state.setSession);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resetSuccess = searchParams.get("reset") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to={user.role === "ATLET" ? "/me" : "/dashboard"} replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setSession(data.accessToken, data.user);
      navigate(data.user.role === "ATLET" ? "/me" : "/dashboard");
    } catch {
      setError("Email atau kata sandi salah.");
    } finally {
      setLoading(false);
    }
  }

  return (
    // Revisi 2026-07-12: split login — left half red 50% opacity with the KONI
    // logo centered (20% viewport height), right half the centered form.
    <div className="flex min-h-svh bg-neutral-50">
      <div className="hidden w-1/2 items-center justify-center bg-primary/50 md:flex">
        <img src="/logo-koni-batam.png" alt="KONI Batam" className="h-[20svh] object-contain" />
      </div>

      <div className="flex w-full items-center justify-center p-4 md:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <img src="/logo-koni-batam.png" alt="KONI Batam" className="h-16 w-16 object-contain md:hidden" />
            <h1 className="text-lg font-semibold text-neutral-900">KONI Batam</h1>
            <p className="text-sm text-neutral-500">Sistem Informasi Manajemen Atlet</p>
          </div>

          {resetSuccess && (
          <p className="mb-4 rounded-md bg-success-light px-3 py-2 text-sm text-success">
            Kata sandi berhasil diubah. Silakan masuk dengan kata sandi baru Anda.
          </p>
        )}

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
              placeholder="nama@koni-batam.go.id"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-neutral-700">
              Kata Sandi
            </label>
            <PasswordInput
              id="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex items-center justify-between">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Memproses..." : "Masuk"}
            </Button>
          </div>

          <p className="text-center text-sm">
            <Link to="/forgot-password" className="text-neutral-500 hover:text-primary hover:underline">
              Lupa kata sandi?
            </Link>
          </p>
          </form>
        </div>
      </div>
    </div>
  );
}
