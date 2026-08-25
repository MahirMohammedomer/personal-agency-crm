"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button, Input, Label } from "@/components/ui/primitives";
import { apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [mode, setMode] = useState<"login" | "forgot" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { ownerEmail?: string | null }) => {
        if (d.ownerEmail) setEmail((v) => v || d.ownerEmail!);
      })
      .catch(() => undefined);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      if (mode === "login") {
        await apiPost("/api/auth", { action: "login", email, password, remember });
        router.replace(next);
        router.refresh();
        return;
      }
      if (mode === "forgot") {
        const res = await apiPost<{ token?: string }>("/api/auth", {
          action: "request-reset",
          email,
        });
        setMode("reset");
        setInfo(
          res.token
            ? `Reset code: ${res.token.slice(0, 12)}…  (copied below — personal app, no email needed)`
            : "If that address matches the owner account, a reset code was created.",
        );
        if (res.token) setToken(res.token);
        return;
      }
      await apiPost("/api/auth", { action: "reset", token, newPassword });
      setMode("login");
      setPassword("");
      setInfo("Password updated. Sign in with your new password.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 overflow-hidden"
        style={{
          background:
            "radial-gradient(60rem 40rem at 20% -10%, rgb(var(--accent)/0.12), transparent 60%), radial-gradient(50rem 35rem at 100% 110%, rgb(var(--accent)/0.10), transparent 60%)",
        }}
      />
      <div className="animate-pop-in relative w-full max-w-[380px]">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-lg font-bold text-white shadow-lg">
            M
          </div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Meda CRM</h1>
          <p className="mt-1 text-[13px] text-muted">
            {mode === "login"
              ? "Sign in to your command center"
              : mode === "forgot"
                ? "Reset your password"
                : "Choose a new password"}
          </p>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-6">
          {mode !== "reset" ? (
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                autoComplete="username"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@agency.et"
                required
              />
            </div>
          ) : null}

          {mode === "login" ? (
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          ) : null}

          {mode === "reset" ? (
            <>
              <div>
                <Label>Reset code</Label>
                <Input value={token} onChange={(e) => setToken(e.target.value)} required />
              </div>
              <div>
                <Label>New password</Label>
                <Input
                  type="password"
                  value={newPassword}
                  autoComplete="new-password"
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
            </>
          ) : null}

          {mode === "login" ? (
            <label className="flex items-center gap-2 text-[13px] text-muted">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 accent-[rgb(var(--accent))]"
              />
              Keep me signed in
            </label>
          ) : null}

          {error ? (
            <div className="rounded-xl bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-600 dark:text-rose-300">
              {error}
            </div>
          ) : null}
          {info ? (
            <div className="rounded-xl bg-emerald-500/10 px-3 py-2 text-[12.5px] break-all text-emerald-600 dark:text-emerald-300">
              {info}
            </div>
          ) : null}

          <Button
            type="submit"
            variant="primary"
            size="md"
            className={cn("w-full")}
            disabled={busy}
          >
            {busy
              ? "Please wait…"
              : mode === "login"
                ? "Sign In"
                : mode === "forgot"
                  ? "Create reset code"
                  : "Set new password"}
          </Button>

          <div className="text-center text-[12.5px]">
            {mode === "login" ? (
              <button
                type="button"
                onClick={() => {
                  setMode("forgot");
                  setError("");
                }}
                className="text-subtle hover:text-accent"
              >
                Forgot password?
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                  setInfo("");
                }}
                className="text-subtle hover:text-accent"
              >
                ← Back to sign in
              </button>
            )}
          </div>
        </form>

        <p className="mt-5 text-center text-[11.5px] text-subtle">
          Private application · single owner account · no public signup
        </p>
      </div>
    </div>
  );
}
