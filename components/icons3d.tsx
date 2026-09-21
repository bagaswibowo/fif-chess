import { useId } from "react";
import React from "react";

type IconProps = {
  className?: string;
  size?: number;
};

// 3D Emerald Play Button / Knight for "Bermain"
export function IconPlay3D({ size = 24, className = "" }: IconProps) {
  const uid = useId().replace(/:/g, "_");
  const playGrad = `playGrad_${uid}`;
  const playShadow = `playShadow_${uid}`;
  const rimGrad = `rimGrad_${uid}`;

  return (
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
        <rect x="6" y="6" width="52" height="52" rx="16" fill="url(#rimGrad)" />
        <rect x="8" y="8" width="48" height="48" rx="14" fill={`url(#${playGrad})`} stroke="#86efac" strokeWidth="1" />
        {/* Gloss highlight */}
        <ellipse cx="24" cy="16" rx="14" ry="5" fill="#ffffff" opacity="0.35" transform="rotate(-15 24 16)" />
        {/* Play Triangle Symbol with 3D Bevel */}
        <polygon points="26,20 44,32 26,44" fill="#ffffff" filter="drop-shadow(0 2px 2px rgba(0,0,0,0.3))" />
      </g>
    </svg>
  );
}

// 3D Glossy Chess Pawn
export function IconPawn3D({ size = 28, className = "" }: IconProps) {
  const uid = useId().replace(/:/g, "_");
  const pawnHead = `pawnHead_${uid}`;
  const pawnBody = `pawnBody_${uid}`;
  const pawnBase = `pawnBase_${uid}`;
  const pawnShadow = `pawnShadow_${uid}`;

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <defs>
        <radialGradient id={pawnHead} cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#c8f582" />
          <stop offset="35%" stopColor="#81b64c" />
          <stop offset="85%" stopColor="#45753c" />
          <stop offset="100%" stopColor="#2b4e24" />
        </radialGradient>
        <linearGradient id={pawnBody} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#98d659" />
          <stop offset="50%" stopColor="#6ea83d" />
          <stop offset="100%" stopColor="#3b6631" />
        </linearGradient>
        <linearGradient id={pawnBase} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#81b64c" />
          <stop offset="60%" stopColor="#4e8330" />
          <stop offset="100%" stopColor="#24401c" />
        </linearGradient>
        <filter id={pawnShadow} x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.45" />
        </filter>
      </defs>
      <g filter={`url(#${pawnShadow})`}>
        {/* Base */}
        <ellipse cx="24" cy="41" rx="14" ry="4.5" fill={`url(#${pawnBase})`} />
        <path d="M12 40 C12 37, 16 35, 24 35 C32 35, 36 37, 36 40 Z" fill={`url(#${pawnBody})`} />
        {/* Collar base */}
        <ellipse cx="24" cy="35" rx="9" ry="2.5" fill="#588f37" />
        {/* Waist & stem */}
        <path d="M18 35 C17 26, 19 22, 21 19 L27 19 C29 22, 31 26, 30 35 Z" fill={`url(#${pawnBody})`} />
        {/* Neck collar */}
        <ellipse cx="24" cy="19" rx="6.5" ry="2" fill="#9de05d" />
        <ellipse cx="24" cy="19.5" rx="6.5" ry="1.5" fill="#45753c" opacity="0.6" />
        {/* Head Ball */}
        <circle cx="24" cy="12" r="8" fill={`url(#${pawnHead})`} />
        {/* Specular highlight */}
        <ellipse cx="21" cy="9.5" rx="3" ry="1.8" fill="#ffffff" opacity="0.65" transform="rotate(-20 21 9.5)" />
      </g>
    </svg>
  );
}

// 3D Puzzle Piece
export function IconPuzzle3D({ size = 28, className = "" }: IconProps) {
  const uid = useId().replace(/:/g, "_");
  const puzGrad = `puzGrad_${uid}`;
  const puzShad = `puzShad_${uid}`;

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <defs>
        <radialGradient id={puzGrad} cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#fca5a5" />
          <stop offset="40%" stopColor="#f97316" />
          <stop offset="90%" stopColor="#c2410c" />
          <stop offset="100%" stopColor="#7c2d12" />
        </radialGradient>
        <filter id={puzShad} x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.4" />
        </filter>
      </defs>
      <g filter={`url(#${puzShad})`}>
        <path
          d="M12 16 H18 C18 13, 21 11, 24 11 C27 11, 30 13, 30 16 H36 V22 C39 22, 41 25, 41 28 C41 31, 39 34, 36 34 V40 H30 C30 37, 27 35, 24 35 C21 35, 18 37, 18 40 H12 V34 C9 34, 7 31, 7 28 C7 25, 9 22, 12 22 Z"
          fill={`url(#${puzGrad})`}
          stroke="#ea580c"
          strokeWidth="1.2"
        />
        <ellipse cx="22" cy="18" rx="4" ry="2" fill="#ffffff" opacity="0.45" transform="rotate(-15 22 18)" />
      </g>
    </svg>
  );
}

// 3D Target Bullseye for Vision / Learning
export function IconVision3D({ size = 28, className = "" }: IconProps) {
  const uid = useId().replace(/:/g, "_");
  const visRing1 = `visRing1_${uid}`;
  const visRing2 = `visRing2_${uid}`;
  const visCenter = `visCenter_${uid}`;
  const visShad = `visShad_${uid}`;

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <defs>
        <linearGradient id={visRing1} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <radialGradient id={visRing2} cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#fed7aa" />
          <stop offset="100%" stopColor="#ea580c" />
        </radialGradient>
        <radialGradient id={visCenter} cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#eab308" />
        </radialGradient>
        <filter id={visShad} x="-15%" y="-15%" width="130%" height="130%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.4" />
        </filter>
      </defs>
      <g filter={`url(#${visShad})`}>
        <circle cx="24" cy="24" r="18" fill={`url(#${visRing1})`} />
        <circle cx="24" cy="24" r="13" fill="#ffffff" />
        <circle cx="24" cy="24" r="9" fill={`url(#${visRing2})`} />
        <circle cx="24" cy="24" r="4.5" fill={`url(#${visCenter})`} />
        <ellipse cx="20" cy="16" rx="3.5" ry="1.5" fill="#ffffff" opacity="0.6" transform="rotate(-25 20 16)" />
      </g>
    </svg>
  );
}

// 3D Camera for Scan OTB
export function IconScan3D({ size = 28, className = "" }: IconProps) {
  const uid = useId().replace(/:/g, "_");
  const camBody = `camBody_${uid}`;
  const camLens = `camLens_${uid}`;
  const camShad = `camShad_${uid}`;

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <defs>
        <linearGradient id={camBody} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="50%" stopColor="#9333ea" />
          <stop offset="100%" stopColor="#581c87" />
        </linearGradient>
        <radialGradient id={camLens} cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="40%" stopColor="#06b6d4" />
          <stop offset="90%" stopColor="#0e7490" />
          <stop offset="100%" stopColor="#164e63" />
        </radialGradient>
        <filter id={camShad} x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.4" />
        </filter>
      </defs>
      <g filter={`url(#${camShad})`}>
        <path d="M16 14 L20 10 H28 L32 14 H38 C40 14 41 15 41 17 V35 C41 37 40 38 38 38 H10 C8 38 7 37 7 35 V17 C7 15 8 14 10 14 Z" fill={`url(#${camBody})`} />
        <circle cx="24" cy="26" r="9" fill="#1e1b4b" stroke="#a855f7" strokeWidth="1.5" />
        <circle cx="24" cy="26" r="6.5" fill={`url(#${camLens})`} />
        <ellipse cx="22" cy="23.5" rx="2" ry="1.2" fill="#ffffff" opacity="0.75" transform="rotate(-30 22 23.5)" />
      </g>
    </svg>
  );
}

// 3D Community / Group of Users
export function IconCommunity3D({ size = 28, className = "" }: IconProps) {
  const uid = useId().replace(/:/g, "_");
  const commGrad = `commGrad_${uid}`;
  const commShad = `commShad_${uid}`;

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <defs>
        <radialGradient id={commGrad} cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#6ee7b7" />
          <stop offset="50%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#047857" />
        </radialGradient>
        <filter id={commShad} x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.4" />
        </filter>
      </defs>
      <g filter={`url(#${commShad})`}>
        {/* Background avatars */}
        <circle cx="16" cy="18" r="5" fill="#047857" opacity="0.8" />
        <path d="M9 33 C9 28, 12 26, 16 26 C20 26, 23 28, 23 33 Z" fill="#047857" opacity="0.8" />
        <circle cx="32" cy="18" r="5" fill="#047857" opacity="0.8" />
        <path d="M25 33 C25 28, 28 26, 32 26 C36 26, 39 28, 39 33 Z" fill="#047857" opacity="0.8" />
        {/* Main avatar */}
        <circle cx="24" cy="16" r="6.5" fill={`url(#${commGrad})`} stroke="#a7f3d0" strokeWidth="1" />
        <path d="M15 35 C15 29, 19 27, 24 27 C29 27, 33 29, 33 35 Z" fill={`url(#${commGrad})`} stroke="#a7f3d0" strokeWidth="1" />
        <ellipse cx="22" cy="13.5" rx="2.5" ry="1.2" fill="#ffffff" opacity="0.65" transform="rotate(-20 22 13.5)" />
      </g>
    </svg>
  );
}

// 3D Bot / Stockfish Visor
export function IconBot3D({ size = 28, className = "" }: IconProps) {
  const uid = useId().replace(/:/g, "_");
  const botHead = `botHead_${uid}`;
  const botVisor = `botVisor_${uid}`;
  const botShad = `botShad_${uid}`;

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <defs>
        <linearGradient id={botHead} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#94a3b8" />
          <stop offset="50%" stopColor="#475569" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>
        <linearGradient id={botVisor} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="50%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#22c55e" />
        </linearGradient>
        <filter id={botShad} x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.4" />
        </filter>
      </defs>
      <g filter={`url(#${botShad})`}>
        {/* Antenna */}
        <circle cx="24" cy="9" r="2.5" fill="#ef4444" />
        <rect x="23" y="10" width="2" height="4" fill="#94a3b8" />
        {/* Head */}
        <rect x="11" y="14" width="26" height="22" rx="7" fill={`url(#${botHead})`} stroke="#64748b" strokeWidth="1.5" />
        {/* Visor */}
        <rect x="15" y="20" width="18" height="7" rx="3.5" fill="#052e16" />
        <rect x="16" y="21" width="16" height="5" rx="2.5" fill={`url(#${botVisor})`} />
        {/* Specular */}
        <ellipse cx="18" cy="17" rx="3" ry="1.2" fill="#ffffff" opacity="0.5" />
      </g>
    </svg>
  );
}

// 3D Fire / Streak
export function IconFire3D({ size = 24, className = "" }: IconProps) {
  const uid = useId().replace(/:/g, "_");
  const fireOuter = `fireOuter_${uid}`;
  const fireInner = `fireInner_${uid}`;
  const fireGlow = `fireGlow_${uid}`;

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <radialGradient id={fireOuter} cx="40%" cy="40%" r="60%">
          <stop stopColor="#fbbf24" />
          <stop offset="0.5" stopColor="#f97316" />
          <stop offset="1" stopColor="#dc2626" />
        </radialGradient>
        <radialGradient id={fireInner} cx="45%" cy="35%" r="50%">
          <stop stopColor="#fef08a" />
          <stop offset="0.7" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#ea580c" />
        </radialGradient>
        <filter id={fireGlow} x="0" y="0" width="64" height="64" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#ea580c" floodOpacity="0.5" />
        </filter>
      </defs>
      <g filter={`url(#${fireGlow})`}>
        <path d="M32 4C32 4 48 20 48 38C48 48 40.8 56 32 56C23.2 56 16 48 16 38C16 26 26 14 32 4Z" fill={`url(#${fireOuter})`} />
        <path d="M32 20C32 20 40 30 40 40C40 45 36.4 49 32 49C27.6 49 24 45 24 40C24 33 29 26 32 20Z" fill={`url(#${fireInner})`} />
      </g>
    </svg>
  );
}

// 3D Gold Star
export function IconStar3D({ size = 24, className = "" }: IconProps) {
  const uid = useId().replace(/:/g, "_");
  const starGrad = `starGrad_${uid}`;
  const starShadow = `starShadow_${uid}`;

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id={starGrad} x1="10" y1="10" x2="54" y2="54" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fef08a" />
          <stop offset="0.4" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#d97706" />
        </linearGradient>
        <filter id={starShadow} x="4" y="4" width="56" height="56" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#b45309" floodOpacity="0.4" />
        </filter>
      </defs>
      <g filter={`url(#${starShadow})`}>
        <polygon points="32,6 40,24 60,25 44,38 50,56 32,45 14,56 20,38 4,25 24,24" fill={`url(#${starGrad})`} stroke="#f59e0b" strokeWidth="1" />
      </g>
    </svg>
  );
}

// 3D Medal Badge
export function IconMedal3D({ size = 24, className = "" }: IconProps) {
  const uid = useId().replace(/:/g, "_");
  const medalDisc = `medalDisc_${uid}`;

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id={medalDisc} x1="16" y1="24" x2="48" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fde68a" />
          <stop offset="0.5" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#b45309" />
        </linearGradient>
      </defs>
      <polygon points="22,6 32,24 16,24" fill="#3b82f6" />
      <polygon points="42,6 48,24 32,24" fill="#ef4444" />
      <circle cx="32" cy="40" r="16" fill={`url(#${medalDisc})`} stroke="#d97706" strokeWidth="1.5" />
      <circle cx="32" cy="40" r="11" fill="none" stroke="#fef3c7" strokeWidth="1.5" strokeDasharray="3 2" />
    </svg>
  );
}

// 3D Lock
export function IconLock3D({ size = 20, className = "" }: IconProps) {
  const uid = useId().replace(/:/g, "_");
  const shackleGrad = `shackleGrad_${uid}`;
  const lockBody = `lockBody_${uid}`;

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id={shackleGrad} x1="20" y1="12" x2="44" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#94a3b8" />
          <stop offset="1" stopColor="#475569" />
        </linearGradient>
        <linearGradient id={lockBody} x1="16" y1="28" x2="48" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f59e0b" />
          <stop offset="1" stopColor="#b45309" />
        </linearGradient>
      </defs>
      <path d="M22 30V20C22 14.5 26.5 10 32 10C37.5 10 42 14.5 42 20V30" stroke={`url(#${shackleGrad})`} strokeWidth="6" strokeLinecap="round" fill="none" />
      <rect x="16" y="28" width="32" height="26" rx="6" fill={`url(#${lockBody})`} stroke="#92400e" strokeWidth="1.5" />
      <circle cx="32" cy="40" r="3.5" fill="#78350f" />
    </svg>
  );
}

// 3D Lightning
export function IconLightning3D({ size = 20, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="#eab308" stroke="#ca8a04" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// 3D Clock
export function IconClock3D({ size = 20, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="9" fill="#1e293b" stroke="#cbd5e1" strokeWidth="2" />
      <path d="M12 7V12L15 15" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// 3D Trophy
export function IconTrophy3D({ size = 20, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M6 9V4H18V9C18 12.3 15.3 15 12 15C8.7 15 6 12.3 6 9Z" fill="#eab308" stroke="#ca8a04" strokeWidth="1.5" />
      <path d="M6 6H3V8C3 10.2 4.8 12 7 12" stroke="#eab308" strokeWidth="1.5" />
      <path d="M18 6H21V8C21 10.2 19.2 12 17 12" stroke="#eab308" strokeWidth="1.5" />
      <path d="M12 15V19M8 19H16" stroke="#ca8a04" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// 3D Swap
export function IconSwap3D({ size = 18, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L21 16M17 20L13 16" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// 3D Globe
export function IconGlobe3D({ size = 18, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="9" stroke="#38bdf8" strokeWidth="1.5" fill="#0f172a" />
      <path d="M3.6 9H20.4M3.6 15H20.4M12 3C14.5 6 15.5 9 15.5 12C15.5 15 14.5 18 12 21C9.5 18 8.5 15 8.5 12C8.5 9 9.5 6 12 3Z" stroke="#38bdf8" strokeWidth="1.2" />
    </svg>
  );
}

// 3D Skull
export function IconSkull3D({ size = 48, className = "" }: IconProps) {
  const uid = useId().replace(/:/g, "_");
  const skullGrad = `skullGrad_${uid}`;

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <radialGradient id={skullGrad} cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#f1f5f9" />
          <stop offset="60%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#475569" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="28" r="20" fill={`url(#${skullGrad})`} />
      <path d="M22 38 H42 V50 H22 Z" fill={`url(#${skullGrad})`} />
      <ellipse cx="24" cy="27" rx="5" ry="6" fill="#0f172a" />
      <ellipse cx="40" cy="27" rx="5" ry="6" fill="#0f172a" />
      <circle cx="24" cy="27" r="2" fill="#ef4444" />
      <circle cx="40" cy="27" r="2" fill="#ef4444" />
      <path d="M30 35 L32 31 L34 35 Z" fill="#0f172a" />
      <rect x="25" y="44" width="2.5" height="6" rx="1" fill="#0f172a" />
      <rect x="30.75" y="44" width="2.5" height="6" rx="1" fill="#0f172a" />
      <rect x="36.5" y="44" width="2.5" height="6" rx="1" fill="#0f172a" />
    </svg>
  );
}

// 3D Balance Scale
export function IconBalance3D({ size = 48, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="30" y="10" width="4" height="42" rx="2" fill="#94a3b8" />
      <rect x="18" y="50" width="28" height="6" rx="3" fill="#64748b" />
      <path d="M14 16 L50 16" stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round" />
      <circle cx="32" cy="16" r="4" fill="#38bdf8" />
      <path d="M14 16 L8 34 H20 Z" fill="#475569" stroke="#94a3b8" strokeWidth="1.5" />
      <path d="M50 16 L44 34 H56 Z" fill="#475569" stroke="#94a3b8" strokeWidth="1.5" />
    </svg>
  );
}

// 3D White Flag (Surrender / Resign)
export function IconFlag3D({ size = 48, className = "" }: IconProps) {
  const uid = useId().replace(/:/g, "_");
  const flagCloth = `flagCloth_${uid}`;

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id={flagCloth} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="50%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>
      </defs>
      <rect x="16" y="8" width="4" height="48" rx="2" fill="#94a3b8" />
      <circle cx="18" cy="8" r="3" fill="#e2e8f0" />
      <path
        d="M20 12 C28 9, 36 15, 48 11 V33 C36 37, 28 31, 20 34 Z"
        fill={`url(#${flagCloth})`}
        stroke="#94a3b8"
        strokeWidth="1.5"
      />
      <rect x="12" y="54" width="12" height="4" rx="2" fill="#64748b" />
    </svg>
  );
}
