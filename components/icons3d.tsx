"use client";

import React, { useId, useState } from "react";

export type IconProps = {
  className?: string;
  size?: number;
};

// Helper for NeueDeutsche / Chess.com 3D asset with SVG fallback
function NeueChessIcon({
  src,
  alt,
  size,
  className = "",
  fallback,
}: {
  src: string;
  alt: string;
  size: number;
  className?: string;
  fallback: React.ReactNode;
}) {
  const [error, setError] = useState(false);
  if (error) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      onError={() => setError(true)}
      className={`inline-block object-contain shrink-0 select-none ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
      loading="lazy"
    />
  );
}

// 1. Play Button / Board (NeueDeutsche board-2x2-green)
export function IconPlay3D({ size = 24, className = "" }: IconProps) {
  const uid = useId().replace(/:/g, "_");
  const playGrad = `playGrad_${uid}`;
  const playShadow = `playShadow_${uid}`;
  const rimGrad = `rimGrad_${uid}`;

  const fallback = (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <radialGradient id={playGrad} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#a3e635" />
          <stop offset="45%" stopColor="#81b64c" />
          <stop offset="85%" stopColor="#4d7c0f" />
          <stop offset="100%" stopColor="#365314" />
        </radialGradient>
        <linearGradient id={rimGrad} x1="10" y1="10" x2="54" y2="54" gradientUnits="userSpaceOnUse">
          <stop stopColor="#bef264" />
          <stop offset="1" stopColor="#3f6212" />
        </linearGradient>
        <filter id={playShadow} x="0" y="2" width="64" height="64" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#14532d" floodOpacity="0.6" />
        </filter>
      </defs>
      <g filter={`url(#${playShadow})`}>
        <rect x="6" y="6" width="52" height="52" rx="16" fill={`url(#${rimGrad})`} />
        <rect x="8" y="8" width="48" height="48" rx="14" fill={`url(#${playGrad})`} stroke="#86efac" strokeWidth="1" />
        <polygon points="26,20 44,32 26,44" fill="#ffffff" />
      </g>
    </svg>
  );

  return <NeueChessIcon src="/icons/chess/board-2x2-green.png" alt="Bermain" size={size} className={className} fallback={fallback} />;
}

// 2. Pawn / Pieces (NeueDeutsche board-pieces)
export function IconPawn3D({ size = 28, className = "" }: IconProps) {
  const uid = useId().replace(/:/g, "_");
  const pawnHead = `pawnHead_${uid}`;
  const pawnBody = `pawnBody_${uid}`;

  const fallback = (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <defs>
        <radialGradient id={pawnHead} cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#c8f582" />
          <stop offset="35%" stopColor="#81b64c" />
          <stop offset="100%" stopColor="#2b4e24" />
        </radialGradient>
        <linearGradient id={pawnBody} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#98d659" />
          <stop offset="100%" stopColor="#3b6631" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="14" r="8" fill={`url(#${pawnHead})`} />
      <path d="M16 38 C16 28 20 22 24 22 C28 22 32 28 32 38 Z" fill={`url(#${pawnBody})`} />
    </svg>
  );

  return <NeueChessIcon src="/icons/chess/board-pieces.png" alt="Bidak" size={size} className={className} fallback={fallback} />;
}

// 3. Puzzle / Quest (NeueDeutsche puzzle-rush)
export function IconPuzzle3D({ size = 28, className = "" }: IconProps) {
  const fallback = (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <circle cx="24" cy="24" r="18" fill="#f97316" />
      <path d="M18 24 L22 28 L30 18" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );

  return <NeueChessIcon src="/icons/chess/puzzle-rush.png" alt="Teka-teki" size={size} className={className} fallback={fallback} />;
}

// 4. Target / Tactics Fork (NeueDeutsche tactics-fork)
export function IconTarget3D({ size = 28, className = "" }: IconProps) {
  const fallback = (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <circle cx="24" cy="24" r="18" fill="#ef4444" />
      <circle cx="24" cy="24" r="12" fill="#ffffff" />
      <circle cx="24" cy="24" r="6" fill="#ef4444" />
    </svg>
  );

  return <NeueChessIcon src="/icons/chess/tactics-fork.png" alt="Taktik" size={size} className={className} fallback={fallback} />;
}

export function IconVision3D(props: IconProps) {
  return <IconTarget3D {...props} />;
}

// 5. Scan / Analysis (NeueDeutsche magnifier-analysis)
export function IconScan3D({ size = 28, className = "" }: IconProps) {
  const fallback = (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <circle cx="22" cy="22" r="14" stroke="#a855f7" strokeWidth="4" fill="#1e1b4b" />
      <path d="M32 32 L42 42" stroke="#a855f7" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );

  return <NeueChessIcon src="/icons/chess/magnifier-analysis.png" alt="Scan" size={size} className={className} fallback={fallback} />;
}

// 6. Community (NeueDeutsche communication-bubbles)
export function IconCommunity3D({ size = 28, className = "" }: IconProps) {
  const fallback = (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <circle cx="20" cy="22" r="12" fill="#10b981" />
      <circle cx="32" cy="18" r="8" fill="#3b82f6" />
    </svg>
  );

  return <NeueChessIcon src="/icons/chess/communication-bubbles.png" alt="Komunitas" size={size} className={className} fallback={fallback} />;
}

// 7. Bot (NeueDeutsche device-bot)
export function IconBot3D({ size = 28, className = "" }: IconProps) {
  const fallback = (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <rect x="12" y="14" width="24" height="20" rx="6" fill="#475569" />
      <rect x="16" y="20" width="16" height="6" rx="3" fill="#22c55e" />
    </svg>
  );

  return <NeueChessIcon src="/icons/chess/device-bot.png" alt="AI Bot" size={size} className={className} fallback={fallback} />;
}

// 8. Medal / Trophy (NeueDeutsche cup-gold)
export function IconMedal3D({ size = 24, className = "" }: IconProps) {
  const fallback = (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
      <circle cx="32" cy="32" r="20" fill="#f59e0b" stroke="#d97706" strokeWidth="2" />
    </svg>
  );

  return <NeueChessIcon src="/icons/chess/cup-gold.png" alt="Medal" size={size} className={className} fallback={fallback} />;
}

export function IconTrophy3D(props: IconProps) {
  return <IconMedal3D {...props} />;
}

// 9. King White / Crown (NeueDeutsche crown-gold)
export function IconKingWhite3D({ size = 28, className = "" }: IconProps) {
  const fallback = (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M5 18L3 8L8 12L12 5L16 12L21 8L19 18H5Z" fill="#fbbf24" stroke="#d97706" strokeWidth="1.5" />
    </svg>
  );

  return <NeueChessIcon src="/icons/chess/crown-gold.png" alt="Raja Putih" size={size} className={className} fallback={fallback} />;
}

// 10. Clock (NeueDeutsche time-rapid)
export function IconClock3D({ size = 20, className = "" }: IconProps) {
  const fallback = (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="9" fill="#1e293b" stroke="#cbd5e1" strokeWidth="2" />
      <path d="M12 7V12L15 15" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );

  return <NeueChessIcon src="/icons/chess/time-rapid.png" alt="Waktu" size={size} className={className} fallback={fallback} />;
}

// 11. Globe (NeueDeutsche globe)
export function IconGlobe3D({ size = 18, className = "" }: IconProps) {
  const fallback = (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="9" stroke="#38bdf8" strokeWidth="1.5" fill="#0f172a" />
      <path d="M3.6 9H20.4M3.6 15H20.4" stroke="#38bdf8" strokeWidth="1.2" />
    </svg>
  );

  return <NeueChessIcon src="/icons/chess/globe.png" alt="Globe" size={size} className={className} fallback={fallback} />;
}

// 12. Move Badges (NeueDeutsche Move Assessment Icons)
export function IconMoveBrilliant({ size = 16, className = "" }: IconProps) {
  return <img src="/icons/chess/move-brilliant.png" alt="Brilliant" width={size} height={size} className={`inline-block object-contain ${className}`} />;
}
export function IconMoveBest({ size = 16, className = "" }: IconProps) {
  return <img src="/icons/chess/move-best.png" alt="Best Move" width={size} height={size} className={`inline-block object-contain ${className}`} />;
}
export function IconMoveExcellent({ size = 16, className = "" }: IconProps) {
  return <img src="/icons/chess/move-excellent.png" alt="Excellent" width={size} height={size} className={`inline-block object-contain ${className}`} />;
}
export function IconMoveGood({ size = 16, className = "" }: IconProps) {
  return <img src="/icons/chess/move-good.png" alt="Good" width={size} height={size} className={`inline-block object-contain ${className}`} />;
}
export function IconMoveBook({ size = 16, className = "" }: IconProps) {
  return <img src="/icons/chess/move-book.png" alt="Book" width={size} height={size} className={`inline-block object-contain ${className}`} />;
}
export function IconMoveInaccuracy({ size = 16, className = "" }: IconProps) {
  return <img src="/icons/chess/move-inaccuracy.png" alt="Inaccuracy" width={size} height={size} className={`inline-block object-contain ${className}`} />;
}
export function IconMoveMistake({ size = 16, className = "" }: IconProps) {
  return <img src="/icons/chess/move-mistake.png" alt="Mistake" width={size} height={size} className={`inline-block object-contain ${className}`} />;
}
export function IconMoveBlunder({ size = 16, className = "" }: IconProps) {
  return <img src="/icons/chess/move-blunder.png" alt="Blunder" width={size} height={size} className={`inline-block object-contain ${className}`} />;
}
export function IconMoveMissedWin({ size = 16, className = "" }: IconProps) {
  return <img src="/icons/chess/move-missed-win.png" alt="Missed Win" width={size} height={size} className={`inline-block object-contain ${className}`} />;
}

// 13. Time Mode Icons (NeueDeutsche)
export function IconTimeBullet({ size = 20, className = "" }: IconProps) {
  return <img src="/icons/chess/time-bullet.png" alt="Bullet" width={size} height={size} className={`inline-block object-contain ${className}`} />;
}
export function IconTimeBlitz({ size = 20, className = "" }: IconProps) {
  return <img src="/icons/chess/time-blitz.png" alt="Blitz" width={size} height={size} className={`inline-block object-contain ${className}`} />;
}
export function IconTimeRapid({ size = 20, className = "" }: IconProps) {
  return <img src="/icons/chess/time-rapid.png" alt="Rapid" width={size} height={size} className={`inline-block object-contain ${className}`} />;
}
export function IconTimeClassic({ size = 20, className = "" }: IconProps) {
  return <img src="/icons/chess/time-classic.png" alt="Classic" width={size} height={size} className={`inline-block object-contain ${className}`} />;
}
export function IconTimeDaily({ size = 20, className = "" }: IconProps) {
  return <img src="/icons/chess/time-daily.png" alt="Daily" width={size} height={size} className={`inline-block object-contain ${className}`} />;
}

// Utility Icons
export function IconFriends3D({ size = 22, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="9" cy="7" r="4" fill="#81b64c" />
      <path d="M3 19C3 15.7 5.7 13 9 13C12.3 13 15 15.7 15 19V20H3V19Z" fill="#81b64c" />
      <circle cx="17" cy="9" r="3" fill="#a3e635" opacity="0.85" />
      <path d="M15 19C15.3 16.5 17.5 15 20 15C21.2 15 22.3 15.4 23 16V19H15Z" fill="#a3e635" opacity="0.85" />
    </svg>
  );
}

export function IconMessages3D({ size = 22, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M20 11C20 15.4 16.4 19 12 19C10.5 19 9.1 18.6 7.9 17.8L3 19L4.4 14.5C3.5 13.5 3 12.3 3 11C3 6.6 6.6 3 12 3C16.4 3 20 6.6 20 11Z" fill="#3b82f6" />
      <circle cx="8" cy="11" r="1.5" fill="#ffffff" />
      <circle cx="12" cy="11" r="1.5" fill="#ffffff" />
      <circle cx="16" cy="11" r="1.5" fill="#ffffff" />
    </svg>
  );
}

export function IconBell3D({ size = 22, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M18 8C18 4.7 15.3 2 12 2C8.7 2 6 4.7 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" fill="#eab308" />
      <path d="M10.3 20C10.6 21.2 11.2 22 12 22C12.8 22 13.4 21.2 13.7 20H10.3Z" fill="#a16207" />
    </svg>
  );
}

export function IconSettings3D({ size = 22, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="8" fill="#94a3b8" />
      <circle cx="12" cy="12" r="3.5" fill="#1e293b" />
    </svg>
  );
}

export function IconSearch3D({ size = 18, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="11" cy="11" r="7" stroke="#81b64c" strokeWidth="2.5" fill="#1a1714" />
      <path d="M16.5 16.5L21 21" stroke="#81b64c" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function IconClose3D({ size = 18, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="10" fill="#ef4444" opacity="0.2" />
      <path d="M8 8 L16 16 M16 8 L8 16" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconCheck3D({ size = 18, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <circle cx="24" cy="24" r="20" fill="#22c55e" />
      <path d="M14 24 L21 31 L34 17" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconAlert3D({ size = 18, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <path d="M16 3 L2 27 C1.3 28.2 2.2 29.7 3.6 29.7 H28.4 C29.8 29.7 30.7 28.2 30 27 L16 3 Z" fill="#f59e0b" />
      <rect x="14.5" y="12" width="3" height="8" rx="1.5" fill="#1c1917" />
      <circle cx="16" cy="24" r="1.8" fill="#1c1917" />
    </svg>
  );
}

export function IconLightning3D({ size = 20, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="#eab308" stroke="#ca8a04" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function IconStar3D({ size = 20, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
      <polygon points="32,6 40,24 60,25 44,38 50,56 32,45 14,56 20,38 4,25 24,24" fill="#fbbf24" stroke="#d97706" strokeWidth="1" />
    </svg>
  );
}

export function IconFire3D({ size = 20, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
      <path d="M32 4C32 4 48 20 48 38C48 48 40.8 56 32 56C23.2 56 16 48 16 38C16 26 26 14 32 4Z" fill="#f97316" />
      <path d="M32 20C32 20 40 30 40 40C40 45 36.4 49 32 49C27.6 49 24 45 24 40C24 33 29 26 32 20Z" fill="#fbbf24" />
    </svg>
  );
}

export function IconKingBlack3D({ size = 28, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M5 18L3 8L8 12L12 5L16 12L21 8L19 18H5Z" fill="#475569" stroke="#1e293b" strokeWidth="1.5" />
    </svg>
  );
}

export function IconDice3D({ size = 26, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="4" fill="#81b64c" />
      <circle cx="8" cy="8" r="1.5" fill="#ffffff" />
      <circle cx="16" cy="8" r="1.5" fill="#ffffff" />
      <circle cx="12" cy="12" r="1.5" fill="#ffffff" />
      <circle cx="8" cy="16" r="1.5" fill="#ffffff" />
      <circle cx="16" cy="16" r="1.5" fill="#ffffff" />
    </svg>
  );
}

export function IconLightbulb3D({ size = 18, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="13" r="10" fill="#facc15" />
      <rect x="12" y="24" width="8" height="4" rx="1" fill="#64748b" />
    </svg>
  );
}

export function IconSwap3D({ size = 18, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L21 16M17 20L13 16" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconPencil3D({ size = 20, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M18 2L22 6L7 21H3V17L18 2Z" fill="#81b64c" stroke="#4d7c0f" strokeWidth="1.5" />
    </svg>
  );
}

export function IconPin3D({ size = 18, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M16 4L20 8L15 13L16 19L11 14L6 19L5 18L10 13L5 8L9 4L16 4Z" fill="#f59e0b" />
    </svg>
  );
}

export function IconLock3D({ size = 18, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
      <rect x="16" y="28" width="32" height="26" rx="6" fill="#f59e0b" />
      <path d="M22 28V20C22 14.5 26.5 10 32 10C37.5 10 42 14.5 42 20V28" stroke="#94a3b8" strokeWidth="6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function IconSkull3D({ size = 48, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
      <circle cx="32" cy="28" r="20" fill="#94a3b8" />
      <rect x="25" y="44" width="14" height="8" rx="2" fill="#475569" />
    </svg>
  );
}

export function IconBalance3D({ size = 48, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
      <path d="M14 16 L50 16" stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round" />
      <circle cx="32" cy="16" r="4" fill="#38bdf8" />
    </svg>
  );
}

export function IconFlag3D({ size = 48, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
      <rect x="16" y="8" width="4" height="48" rx="2" fill="#94a3b8" />
      <path d="M20 12 C28 9, 36 15, 48 11 V33 C36 37, 28 31, 20 34 Z" fill="#cbd5e1" />
    </svg>
  );
}

export function IconCoach3D({ size = 24, className = "" }: IconProps) {
  return <IconBot3D size={size} className={className} />;
}

export function IconQuote3D({ size = 18, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <circle cx="24" cy="24" r="18" fill="#3b82f6" />
    </svg>
  );
}

export function IconHistory3D({ size = 18, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <circle cx="24" cy="24" r="18" stroke="#eab308" strokeWidth="4" fill="none" />
      <path d="M24 12 V24 L32 28" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconShield3D({ size = 18, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <path d="M24 4 L8 10 V22 C8 32, 15 41, 24 44 C33 41, 40 32, 40 22 V10 Z" fill="#2563eb" />
    </svg>
  );
}

export function IconThumbsUp3D({ size = 18, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <circle cx="24" cy="24" r="18" fill="#ec4899" />
    </svg>
  );
}

export function IconAiBrain3D({ size = 20, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <circle cx="24" cy="24" r="18" fill="#9333ea" />
    </svg>
  );
}

export function IconRocket3D({ size = 18, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <circle cx="24" cy="24" r="18" fill="#ef4444" />
    </svg>
  );
}

export function IconInfinity3D({ size = 18, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <path d="M14 16 C8 16, 4 20, 4 24 C4 28, 8 32, 14 32 C20 32, 24 24, 24 24 C24 24, 28 32, 34 32 C40 32, 44 28, 44 24 C44 20, 40 16, 34 16 C28 16, 24 24, 24 24 C24 24, 20 16, 14 16 Z" stroke="#81b64c" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function IconCrossRed3D({ size = 18, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="14" fill="#ef4444" />
      <path d="M11 11 L21 21 M21 11 L11 21" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
