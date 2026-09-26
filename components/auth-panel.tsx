"use client";

import { useState } from "react";
import type { SessionUser } from "@/lib/use-session";
import { IconPawn3D } from "@/components/icons3d";

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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("Mahasiswa TI Tel-U");
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err" | "info"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (mode === "register") {
      if (password.length < 6) {
        setMessage({ tone: "err", text: "Kata sandi minimal 6 karakter." });
        return;
      }
      if (password !== confirmPassword) {
        setMessage({ tone: "err", text: "Konfirmasi kata sandi tidak cocok." });
        return;
      }
      if (!agreeTerms) {
        setMessage({ tone: "err", text: "Harap menyetujui syarat & ketentuan komunitas." });
        return;
      }
    }

    setBusy(true);
    try {
      const data =
        mode === "login"
          ? await onLogin(username.trim().toLowerCase(), password)
          : await onRegister(username.trim().toLowerCase(), password, fullName.trim(), role.trim());

      if (data?.error) {
        setMessage({ tone: data.pending ? "info" : "err", text: data.error });
      } else if (mode === "register") {
        setMessage({
          tone: "info",
          text: data?.message || "Pendaftaran berhasil dikirim! Menunggu persetujuan Admin Komunitas sebelum bisa login.",
        });
        setMode("login");
        setPassword("");
        setConfirmPassword("");
      } else {
        onClose();
      }
    } catch {
      setMessage({ tone: "err", text: "Tidak dapat menghubungi server auth." });
    } finally {
      setBusy(false);
    }
  }

  // LOGGED IN: Profile Card Modal View
  if (user) {
    const winRate =
      user.wins + user.losses + user.draws > 0
        ? Math.round((user.wins / (user.wins + user.losses + user.draws)) * 100)
        : 0;

    return (
      <div className="bg-[var(--background)] border border-[var(--border)] rounded-2xl p-5 md:p-6 w-full max-w-[420px] shadow-2xl space-y-4 text-white relative animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[var(--surface)] hover:bg-[var(--border)] text-neutral-400 hover:text-white flex items-center justify-center transition-colors text-sm font-bold"
          aria-label="Tutup"
        >
          ✕
        </button>

        {/* Profile Header */}
        <div className="flex items-center gap-3.5 pr-8">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-strong)] border-2 border-[var(--primary)] flex items-center justify-center text-base font-black text-white shadow-md shrink-0">
            {user.username.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-white truncate">{user.fullName}</h3>
              {user.isAdmin && (
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                  Admin
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400 truncate">
              @{user.username} · {user.role}
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 bg-[var(--background)] p-3 rounded-xl border border-[var(--border)] text-center">
          <div>
            <span className="block text-[10px] uppercase font-bold text-neutral-400">Rating ELO</span>
            <span className="font-mono font-black text-lg text-[var(--primary)]">{user.elo}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-neutral-400">Menang/Kalah</span>
            <span className="font-mono font-bold text-sm text-neutral-200">
              {user.wins}W / {user.losses}L
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-neutral-400">Win Rate</span>
            <span className="font-mono font-bold text-sm text-emerald-400">{winRate}%</span>
          </div>
        </div>

        {/* Admin Quick Action */}
        {user.isAdmin && (
          <div className="bg-amber-950/40 border border-amber-500/40 p-3 rounded-xl text-xs text-amber-200 flex items-center gap-2">
            <span>🛡️</span>
            <span className="font-medium">Akses Admin aktif untuk moderasi & persetujuan user.</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2.5 pt-2 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="flex-1 h-10 px-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--border)] text-neutral-200 font-bold text-sm transition-all"
          >
            Tutup
          </button>
          <button
            onClick={() => void onLogout()}
            className="flex-1 h-10 px-4 rounded-xl border border-red-500/50 bg-red-950/40 hover:bg-red-900/60 text-red-300 font-bold text-sm transition-all"
          >
            Keluar (Logout)
          </button>
        </div>
      </div>
    );
  }

  // NOT LOGGED IN: Tabbed Login / Signup Modal
  return (
    <div className="bg-[var(--background)] border border-[var(--border)] rounded-2xl p-5 md:p-6 w-full max-w-[420px] shadow-2xl space-y-4 text-white relative animate-in fade-in zoom-in-95 duration-200">
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[var(--surface)] hover:bg-[var(--border)] text-neutral-400 hover:text-white flex items-center justify-center transition-colors text-sm font-bold cursor-pointer"
        aria-label="Tutup"
      >
        ✕
      </button>

      {/* Modal Branding Header */}
      <div className="flex items-center gap-2.5 pr-8">
        <div className="w-8 h-8 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--primary)]">
          <IconPawn3D size={20} />
        </div>
        <div>
          <h2 className="text-base font-black text-white tracking-wide uppercase leading-tight">
            FIF <span className="text-[var(--primary)]">CHESS</span>
          </h2>
          <p className="text-[11px] text-neutral-400">Platform Catur Civitas Telkom University</p>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex bg-[var(--background)] p-1 rounded-xl border border-[var(--border)]">
        <button
          type="button"
          onClick={() => {
            setMode("login");
            setMessage(null);
          }}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            mode === "login"
              ? "bg-[var(--primary)] text-white shadow-md"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          Masuk (Login)
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("register");
            setMessage(null);
          }}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            mode === "register"
              ? "bg-[var(--primary)] text-white shadow-md"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          Daftar Akun Baru
        </button>
      </div>

      {/* Auth Form */}
      <form onSubmit={submit} className="space-y-3.5">
        {/* Username Field */}
        <div>
          <label
            className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5"
            htmlFor="auth-username"
          >
            Username
          </label>
          <input
            id="auth-username"
            className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--background)] text-white placeholder:text-neutral-600 focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] text-sm transition-all"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            placeholder="misal: master_catur"
            required
          />
          {mode === "register" && (
            <span className="block text-[10px] text-neutral-400 mt-1">
              3-20 karakter, huruf kecil, angka, atau garis bawah.
            </span>
          )}
        </div>

        {/* Additional Register Fields */}
        {mode === "register" && (
          <>
            <div>
              <label
                className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5"
                htmlFor="auth-fullname"
              >
                Nama Lengkap
              </label>
              <input
                id="auth-fullname"
                className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--background)] text-white placeholder:text-neutral-600 focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] text-sm transition-all"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                placeholder="misal: Admin Komunitas / Budi Santoso"
                required
              />
            </div>

            <div>
              <label
                className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5"
                htmlFor="auth-role"
              >
                Peran / Civitas Tel-U
              </label>
              <select
                id="auth-role"
                className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--background)] text-white focus:outline-none focus:border-[var(--primary)] text-sm transition-all cursor-pointer"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="Mahasiswa TI Tel-U">Mahasiswa Teknik Informatika Tel-U</option>
                <option value="Mahasiswa Sistem Informasi Tel-U">Mahasiswa Sistem Informasi Tel-U</option>
                <option value="Mahasiswa Tel-U (Umum)">Mahasiswa Telkom University (Lainnya)</option>
                <option value="Dosen Telkom University">Dosen Telkom University</option>
                <option value="UKM Catur Telkom University">Anggota UKM Catur Tel-U</option>
                <option value="Alumni Telkom University">Alumni Telkom University</option>
                <option value="Umum / Tamu">Umum / Komunitas Catur</option>
              </select>
            </div>
          </>
        )}

        {/* Password Field */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              className="block text-xs font-bold text-neutral-300 uppercase tracking-wider"
              htmlFor="auth-password"
            >
              Kata Sandi
            </label>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-[11px] text-[var(--primary)] hover:underline cursor-pointer"
            >
              {showPassword ? "Sembunyikan" : "Lihat Sandi"}
            </button>
          </div>
          <input
            id="auth-password"
            className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--background)] text-white placeholder:text-neutral-600 focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] text-sm transition-all"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder="••••••••"
            minLength={6}
            required
          />
        </div>

        {/* Confirm Password (Register Only) */}
        {mode === "register" && (
          <div>
            <label
              className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5"
              htmlFor="auth-confirm-password"
            >
              Konfirmasi Kata Sandi
            </label>
            <input
              id="auth-confirm-password"
              className="w-full h-11 px-3.5 rounded-xl border border-[var(--border)] bg-[var(--background)] text-white placeholder:text-neutral-600 focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] text-sm transition-all"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>
        )}

        {/* Terms Agreement Checkbox (Register Only) */}
        {mode === "register" && (
          <label className="flex items-start gap-2.5 text-xs text-neutral-300 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded bg-[var(--background)] border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)] accent-[var(--primary)]"
              required
            />
            <span>Saya menyetujui aturan fair-play dan ketentuan komunitas catur Telkom University.</span>
          </label>
        )}

        {/* Message Banner */}
        {message && (
          <div
            role="status"
            className={`p-3 rounded-xl text-xs leading-relaxed border ${
              message.tone === "err"
                ? "bg-red-950/50 border-red-500/50 text-red-200"
                : message.tone === "info"
                ? "bg-[var(--primary)]/15 border-[var(--primary)]/40 text-[var(--primary)]"
                : "bg-emerald-950/50 border-emerald-500/50 text-emerald-200"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Submit Button */}
        <button
          className="w-full h-11 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:translate-y-[1px] text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          type="submit"
          disabled={busy}
        >
          {busy ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Memproses...</span>
            </span>
          ) : mode === "login" ? (
            "Masuk ke Arena"
          ) : (
            "Kirim Pendaftaran Akun"
          )}
        </button>
      </form>

      {/* Info Footnote */}
      <div className="pt-2 border-t border-[var(--border)] text-[11px] text-neutral-400 space-y-1 text-center">
        {mode === "login" ? (
          <p>
            Belum punya akun?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setMessage(null);
              }}
              className="text-[var(--primary)] font-bold hover:underline cursor-pointer"
            >
              Daftar di sini
            </button>
          </p>
        ) : (
          <p className="text-neutral-400 leading-normal">
            ℹ️ Akun baru diverifikasi dan disetujui oleh{" "}
            <strong className="text-white">Admin Komunitas</strong> sebelum dapat login.
          </p>
        )}
      </div>
    </div>
  );
}
