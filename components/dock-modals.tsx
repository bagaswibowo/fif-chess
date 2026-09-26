"use client";

import { useState, useEffect } from "react";
import type { SessionUser } from "@/lib/use-session";
import { IconCommunity3D, IconPawn3D, IconMedal3D } from "@/components/icons3d";

export type DockModalType = "friends" | "messages" | "notifications" | "settings" | null;

type Props = {
  activeModal: DockModalType;
  onClose: () => void;
  user: SessionUser | null;
  onChallengePlayer?: (username: string) => void;
  onLogout?: () => void;
};

export type PlayerItem = {
  username: string;
  fullName: string;
  role: string;
  elo: number;
  online: boolean;
};

export type MessageItem = {
  id: string;
  sender: string;
  senderName: string;
  text: string;
  createdAt: string;
};

export type NotificationItem = {
  id: string;
  type: "invite" | "approval" | "system";
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
};

export function DockModals({
  activeModal,
  onClose,
  user,
  onChallengePlayer,
  onLogout,
}: Props) {
  const [players, setPlayers] = useState<PlayerItem[]>([]);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeChatUser, setActiveChatUser] = useState<string | null>(null);
  const [chatText, setChatText] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [boardTheme, setBoardTheme] = useState("walnut");

  useEffect(() => {
    if (!activeModal) return;

    // Load players for Friends tab
    fetch("/api/pvp?directory=1")
      .then((res) => res.json())
      .then((data) => {
        if (data.players) {
          setPlayers(
            data.players.map((p: any) => ({
              username: p.username,
              fullName: p.fullName,
              role: p.role || "Anggota",
              elo: p.elo || 1500,
              online: Boolean(p.online),
            }))
          );
        }
      })
      .catch(() => {});

    // Demo / initial messages
    setMessages([
      {
        id: "m1",
        sender: "bagaswibowo",
        senderName: "Pak Bagas Wibowo",
        text: "Selamat datang di Arena Catur FIF Telkom University!",
        createdAt: "10 mnt lalu",
      },
    ]);

    // Demo notifications
    setNotifications([
      {
        id: "n1",
        type: "system",
        title: "Pembaruan Platform",
        message: "Bank teka-teki taktis 50 posisi telah aktif.",
        createdAt: "1 jam lalu",
        read: false,
      },
    ]);
  }, [activeModal]);

  if (!activeModal) return null;

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatText.trim() || !user) return;
    const newMsg: MessageItem = {
      id: "msg-" + Date.now(),
      sender: user.username,
      senderName: user.fullName,
      text: chatText.trim(),
      createdAt: "Baru saja",
    };
    setMessages((prev) => [...prev, newMsg]);
    setChatText("");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-[#211f1d] border border-[#3d3a34] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden text-[#ffffff] flex flex-col max-h-[85vh]">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#312e2b] bg-[#262421]">
          <div className="flex items-center gap-2.5">
            {activeModal === "friends" && (
              <>
                <span className="text-xl">👥</span>
                <span className="font-bold text-base">Teman & Civitas Tel-U</span>
              </>
            )}
            {activeModal === "messages" && (
              <>
                <span className="text-xl">✉️</span>
                <span className="font-bold text-base">Pesan & Kotak Masuk</span>
              </>
            )}
            {activeModal === "notifications" && (
              <>
                <span className="text-xl">🔔</span>
                <span className="font-bold text-base">Pemberitahuan</span>
              </>
            )}
            {activeModal === "settings" && (
              <>
                <span className="text-xl">⚙️</span>
                <span className="font-bold text-base">Pengaturan Akun & Papan</span>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#302e2b] hover:bg-[#3d3a34] text-neutral-400 hover:text-white flex items-center justify-center transition-all cursor-pointer font-bold"
          >
            ✕
          </button>
        </div>

        {/* Body Modal */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* TAB: TEMAN */}
          {activeModal === "friends" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-neutral-400 font-semibold">
                <span>ANGGOTA TERDAFTAR ({players.length})</span>
                <span className="text-[#81b64c]">● {players.filter((p) => p.online).length} Siap Bertanding</span>
              </div>
              <div className="space-y-2">
                {players.length === 0 ? (
                  <p className="text-center text-sm text-neutral-400 py-6">Belum ada pemain lain yang terhubung.</p>
                ) : (
                  players.map((p) => (
                    <div
                      key={p.username}
                      className="p-3 rounded-xl bg-[#262421] border border-[#312e2b] flex items-center justify-between gap-3 hover:border-neutral-500 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#81b64c] to-[#457524] flex items-center justify-center font-bold text-sm text-white shrink-0">
                          {p.fullName.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold truncate">{p.fullName}</div>
                          <div className="text-xs text-neutral-400 flex items-center gap-1.5">
                            <span>@{p.username}</span>
                            <span>•</span>
                            <span className="text-amber-400 font-mono font-bold">{p.elo} Elo</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {p.online && (
                          <span className="w-2.5 h-2.5 rounded-full bg-[#81b64c] ring-2 ring-[#81b64c]/20" title="Online" />
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (onChallengePlayer) {
                              onChallengePlayer(p.username);
                              onClose();
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#81b64c] hover:bg-[#72a342] text-white text-xs font-bold transition-all shadow cursor-pointer flex items-center gap-1"
                        >
                          <span>⚡</span>
                          <span>Tantang</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB: PESAN */}
          {activeModal === "messages" && (
            <div className="space-y-3 flex flex-col h-[380px]">
              <div className="flex-1 overflow-y-auto space-y-2.5 p-3 rounded-xl bg-[#1a1714] border border-[#312e2b]">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`p-3 rounded-xl max-w-[85%] text-xs space-y-1 ${
                      m.sender === user?.username
                        ? "ml-auto bg-[#273815] border border-[#81b64c]/30 text-neutral-100"
                        : "bg-[#262421] border border-[#383530] text-neutral-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 font-bold text-[11px] text-neutral-400">
                      <span>{m.senderName}</span>
                      <span className="text-[10px]">{m.createdAt}</span>
                    </div>
                    <p className="text-sm leading-relaxed">{m.text}</p>
                  </div>
                ))}
              </div>
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ketik pesan untuk komunitas..."
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#1a1714] border border-[#3d3a34] text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#81b64c]"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-[#81b64c] hover:bg-[#72a342] text-white text-sm font-bold transition-all cursor-pointer"
                >
                  Kirim
                </button>
              </form>
            </div>
          )}

          {/* TAB: PEMBERITAHUAN */}
          {activeModal === "notifications" && (
            <div className="space-y-2.5">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className="p-3.5 rounded-xl bg-[#262421] border border-[#312e2b] flex items-start gap-3"
                >
                  <span className="text-2xl mt-0.5">🔔</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold text-white">{n.title}</div>
                      <div className="text-[11px] text-neutral-400">{n.createdAt}</div>
                    </div>
                    <p className="text-xs text-neutral-300 mt-1 leading-relaxed">{n.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB: PENGATURAN */}
          {activeModal === "settings" && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[#262421] border border-[#312e2b] space-y-3">
                <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                  Preferensi Papan & Permainan
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-white">Efek Suara Langkah</div>
                    <div className="text-xs text-neutral-400">Bunyi ketukan bidak saat melangkah</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={soundEnabled}
                    onChange={(e) => setSoundEnabled(e.target.checked)}
                    className="w-5 h-5 accent-[#81b64c] rounded cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-[#312e2b]">
                  <div>
                    <div className="text-sm font-bold text-white">Tema Warna Papan</div>
                    <div className="text-xs text-neutral-400">Kayu Turnamen Walnut & Maple</div>
                  </div>
                  <select
                    value={boardTheme}
                    onChange={(e) => setBoardTheme(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-[#1a1714] border border-[#3d3a34] text-xs text-white"
                  >
                    <option value="walnut">Kayu Klasik (Walnut)</option>
                    <option value="emerald">Hijau Turnamen (Emerald)</option>
                    <option value="dark">Dark Charcoal</option>
                  </select>
                </div>
              </div>

              {user && (
                <div className="p-3.5 rounded-xl bg-[#262421] border border-[#312e2b] space-y-2">
                  <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Informasi Akun</div>
                  <div className="text-sm">
                    <span className="text-neutral-400">Nama: </span>
                    <span className="font-bold text-white">{user.fullName}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-neutral-400">Username: </span>
                    <span className="font-bold text-[#81b64c]">@{user.username}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-neutral-400">Peran: </span>
                    <span className="font-bold text-white">{user.role}</span>
                  </div>
                  {onLogout && (
                    <button
                      type="button"
                      onClick={() => {
                        onLogout();
                        onClose();
                      }}
                      className="w-full mt-3 py-2.5 rounded-xl bg-red-950/40 border border-red-800/50 hover:bg-red-900/60 text-red-300 text-xs font-bold transition-all cursor-pointer"
                    >
                      Keluar dari Akun (Logout)
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
