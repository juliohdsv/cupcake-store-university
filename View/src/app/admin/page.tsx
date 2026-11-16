"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "react-toastify";
import { useAdminAuth } from "../../context/AdminAuthContext";

export default function AdminLoginPage() {
  const router = useRouter();
  const { status, expired, login } = useAdminAuth();
  const [username, setUsername] = useState("convidado");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (status === "authenticated") router.replace("/admin/pedidos");
  }, [status, router]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(username.trim(), password);
      setPassword("");
      toast.success("Acesso administrativo autorizado.");
      router.push("/admin/pedidos");
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : "Não foi possível entrar.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="container-page min-h-[60vh] py-12">
      <div className="card mx-auto max-w-md p-6 sm:p-8">
        <p className="text-sm font-bold uppercase tracking-widest text-berry">
          Área da loja
        </p>
        <h1 className="mt-2 text-3xl font-bold">Acesso administrativo</h1>
        <p className="mt-4 text-sm text-muted">
          Painel acadêmico para acompanhar pedidos e avaliações.
        </p>
        {status === "checking" || status === "authenticated" ? (
          <p className="mt-6 text-sm text-muted" role="status">
            Verificando sessão...
          </p>
        ) : (
          <>
            {expired && (
              <p
                className="mt-5 rounded-lg bg-blush p-3 text-sm font-semibold text-berry"
                role="status"
              >
                Sua sessão de 10 minutos terminou. Informe a senha novamente.
              </p>
            )}
            <form onSubmit={(event) => void submit(event)} className="mt-7">
              <label htmlFor="username" className="block text-sm font-semibold">
                Usuário
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                required
                maxLength={100}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="input mt-2 mb-5"
              />
              <label htmlFor="password" className="block text-sm font-semibold">
                Senha administrativa
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="input mt-2"
                aria-invalid={!!error}
                aria-describedby={error ? "login-error" : undefined}
              />
              {error && (
                <p id="login-error" className="field-error" role="alert">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={busy}
                className="btn-primary mt-6 w-full"
              >
                {busy ? "Entrando..." : "Entrar"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
