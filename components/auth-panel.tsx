"use client";

import { useState } from "react";
import type { SessionUser } from "@/lib/use-session";

type Props = {
  user: SessionUser | null;
  onLogin: (username: string, password: string) => Promise<any>;
  onRegister: (username: string, password: string, fullName: string, role: string) => Promise<any>;
  onLogout: () => Promise<void>;
  onClose: () => void;
};

type Mode = "login" | "register";

export function AuthPanel({ user, onLogin, onRegister, onLogout, onClose }: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("Mahasiswa TI Tel-U");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err" | "info"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const data =
        mode === "login"
          ? await onLogin(username.trim(), password)
          : await onRegister(username.trim(), password, fullName.trim(), role.trim());
      if (data?.error) {
        setMessage({ tone: data.pending ? "info" : "err", text: data.error });
      } else if (mode === "register") {
        setMessage({ tone: "info", text: data?.message || "Pendaftaran terkirim, tunggu persetujuan admin." });
        setMode("login");
        setPassword("");
      } else {
        onClose();
      }
    } catch {
      setMessage({ tone: "err", text: "Tidak dapat menghubungi server." });
    } finally {
      setBusy(false);
    }
  }

  if (user) {
    return (
      <div className="panel p-4 stack">
        <div className="row-between">
          <div className="min-w-0">
            <div className="font-bold text-[--text-base] truncate">{user.fullName}</div>
            <div className="prose-note truncate">
              @{user.username} · {user.role}
            </div>
          </div>
          {user.isAdmin && (
            <span className="ctl ctl-xs ctl-active shrink-0" aria-label="Peran admin">
              Admin
            </span>
          )}
        </div>
        <div className="row" style={{ gap: "0.5rem" }}>
          <span className="clock text-[--text-base]">{user.elo}</span>
          <span className="prose-note">
            {user.wins} menang · {user.draws} remis · {user.losses} kalah
          </span>
        </div>
        <button className="ctl ctl-sm" onClick={() => void onLogout()}>
          Keluar
        </button>
      </div>
    );
  }

  return (
    <div className="panel p-4 stack">
      <div className="row" role="tablist" aria-label="Mode akun">
        <button
          role="tab"
          aria-selected={mode === "login"}
          className={`ctl ctl-sm ctl-choice ${mode === "login" ? "ctl-active" : ""}`}
          onClick={() => setMode("login")}
        >
          Masuk
        </button>
        <button
          role="tab"
          aria-selected={mode === "register"}
          className={`ctl ctl-sm ctl-choice ${mode === "register" ? "ctl-active" : ""}`}
          onClick={() => setMode("register")}
        >
          Daftar
        </button>
      </div>

      <form onSubmit={submit} className="stack-tight">
        <label className="label" htmlFor="au">
          Username
        </label>
        <input
          id="au"
          className="field"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          placeholder="misal: budisantoso"
          required
        />

        {mode === "register" && (
          <>
            <label className="label" htmlFor="af">
              Nama lengkap
            </label>
            <input
              id="af"
              className="field"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              required
            />
            <label className="label" htmlFor="ar">
              Fakultas / keterangan
            </label>
            <input
              id="ar"
              className="field"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />
          </>
        )}

        <label className="label" htmlFor="ap">
          Kata sandi
        </label>
        <input
          id="ap"
          className="field"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={6}
          required
        />

        {message && (
          <p
            role="status"
            className="text-[--text-xs] leading-snug"
            style={{ color: message.tone === "err" ? "var(--destructive)" : "var(--accent)" }}
          >
            {message.text}
          </p>
        )}

        <button className="ctl ctl-primary" type="submit" disabled={busy}>
          {busy ? "Memproses…" : mode === "login" ? "Masuk" : "Kirim pendaftaran"}
        </button>
      </form>

      <p className="prose-note" style={{ fontSize: "var(--text-xs)" }}>
        Pendaftaran baru menunggu persetujuan admin (Pak Bagas Wibowo) sebelum bisa masuk. Admin masuk dengan
        username <span className="clock">bagaswibowo</span>.
      </p>
    </div>
  );
}
