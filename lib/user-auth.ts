export type UserStatus = "pending" | "approved" | "rejected";

export type UserProfile = {
  id: string;
  username: string;
  fullName: string;
  role: string;
  status: UserStatus;
  isAdmin: boolean;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  createdAt?: string;
};

export const ADMIN_USER: UserProfile = {
  id: "admin-bagas",
  username: "bagaswibowo",
  fullName: "Pak Bagas Wibowo",
  role: "Dosen TI Tel-U (KK SEAL) dan Admin Komunitas",
  status: "approved",
  isAdmin: true,
  elo: 1650,
  wins: 28,
  losses: 4,
  draws: 6,
  createdAt: "2026-09-01T08:00:00Z",
};

export const INITIAL_MEMBERS: UserProfile[] = [
  ADMIN_USER,
  {
    id: "user-hasan",
    username: "hasan_seal",
    fullName: "Hasan Bisri",
    role: "Mahasiswa TI Tel-U (Lab SEAL)",
    status: "approved",
    isAdmin: false,
    elo: 1420,
    wins: 15,
    losses: 8,
    draws: 2,
    createdAt: "2026-09-10T10:00:00Z",
  },
  {
    id: "user-siti",
    username: "siti_ai",
    fullName: "Siti Rahmawati",
    role: "Mahasiswa Sistem Informasi Tel-U",
    status: "approved",
    isAdmin: false,
    elo: 1380,
    wins: 12,
    losses: 9,
    draws: 4,
    createdAt: "2026-09-12T14:30:00Z",
  },
  {
    id: "user-dimas",
    username: "dimas_catur",
    fullName: "Dimas Aditya",
    role: "UKM Catur Telkom University",
    status: "approved",
    isAdmin: false,
    elo: 1510,
    wins: 22,
    losses: 11,
    draws: 5,
    createdAt: "2026-09-15T09:15:00Z",
  },
  {
    id: "user-budi",
    username: "budi_santoso",
    fullName: "Budi Santoso",
    role: "Alumni Teknik Informatika Tel-U",
    status: "pending",
    isAdmin: false,
    elo: 1200,
    wins: 0,
    losses: 0,
    draws: 0,
    createdAt: "2026-09-24T11:20:00Z",
  },
  {
    id: "user-anisa",
    username: "anisa_w",
    fullName: "Anisa Wardani",
    role: "Mahasiswa DKV Tel-U",
    status: "pending",
    isAdmin: false,
    elo: 1200,
    wins: 0,
    losses: 0,
    draws: 0,
    createdAt: "2026-09-25T07:45:00Z",
  },
];

export function getStoredUser(): UserProfile {
  if (typeof window === "undefined") return ADMIN_USER;
  try {
    const saved = localStorage.getItem("fif_chess_active_user");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed.username === "string") {
        return parsed;
      }
    }
  } catch {}
  return ADMIN_USER;
}

export function saveStoredUser(user: UserProfile) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("fif_chess_active_user", JSON.stringify(user));
  } catch {}
}

export function clearStoredUser() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("fif_chess_active_user");
  } catch {}
}

export function getAllUsers(): UserProfile[] {
  if (typeof window === "undefined") return INITIAL_MEMBERS;
  try {
    const saved = localStorage.getItem("fif_chess_all_users");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return INITIAL_MEMBERS;
}

export function saveAllUsers(users: UserProfile[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("fif_chess_all_users", JSON.stringify(users));
  } catch {}
}

export function registerUser(username: string, fullName: string, role: string): UserProfile {
  const all = getAllUsers();
  const existing = all.find((u) => u.username.toLowerCase() === username.toLowerCase());
  if (existing) {
    saveStoredUser(existing);
    return existing;
  }

  const newUser: UserProfile = {
    id: "user-" + Date.now(),
    username: username.toLowerCase().trim(),
    fullName: fullName.trim(),
    role: role.trim() || "Civitas Telkom University",
    status: "pending",
    isAdmin: false,
    elo: 1200,
    wins: 0,
    losses: 0,
    draws: 0,
    createdAt: new Date().toISOString(),
  };

  const updated = [...all, newUser];
  saveAllUsers(updated);
  saveStoredUser(newUser);
  return newUser;
}
