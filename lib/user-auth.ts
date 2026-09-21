export type UserProfile = {
  id: string;
  username: string;
  fullName: string;
  role: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
};

const DEFAULT_USER: UserProfile = {
  id: "bagas-01",
  username: "bagaswibowo",
  fullName: "Pak Bagas Wibowo",
  role: "Dosen TI Tel-U (KK SEAL)",
  elo: 1500,
  wins: 14,
  losses: 2,
  draws: 3,
};

export function getStoredUser(): UserProfile {
  if (typeof window === "undefined") return DEFAULT_USER;
  try {
    const saved = localStorage.getItem("fif_chess_active_user");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed.username === "string") {
        return parsed;
      }
    }
  } catch {}
  return DEFAULT_USER;
}

export function saveStoredUser(user: UserProfile) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("fif_chess_active_user", JSON.stringify(user));
  } catch {}
}

export function getAllUsers(): UserProfile[] {
  if (typeof window === "undefined") return [DEFAULT_USER];
  try {
    const saved = localStorage.getItem("fif_chess_all_users");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [DEFAULT_USER];
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
    elo: 1200, // standard starting rating
    wins: 0,
    losses: 0,
    draws: 0,
  };

  const updated = [...all, newUser];
  try {
    localStorage.setItem("fif_chess_all_users", JSON.stringify(updated));
    saveStoredUser(newUser);
  } catch {}

  return newUser;
}
