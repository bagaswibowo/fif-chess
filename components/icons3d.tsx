import { useId } from "react";
import React from "react";

type IconProps = {
  className?: string;
  size?: number;
};

// 3D Glossy Chess Pawn
export function IconPawn3D({ size = 28, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <defs>
        <radialGradient id="pawnHead" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#c8f582" />
          <stop offset="35%" stopColor="#81b64c" />
          <stop offset="85%" stopColor="#45753c" />
          <stop offset="100%" stopColor="#2b4e24" />
        </radialGradient>
        <linearGradient id="pawnBody" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#98d659" />
          <stop offset="50%" stopColor="#6ea83d" />
          <stop offset="100%" stopColor="#3b6631" />
        </linearGradient>
        <linearGradient id="pawnBase" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#81b64c" />
          <stop offset="60%" stopColor="#4e8330" />
          <stop offset="100%" stopColor="#24401c" />
        </linearGradient>
        <filter id="pawnShadow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.45" />
        </filter>
      </defs>
      <g filter="url(#pawnShadow)">
        {/* Base */}
        <ellipse cx="24" cy="41" rx="14" ry="4.5" fill="url(#pawnBase)" />
        <path d="M12 40 C12 37, 16 35, 24 35 C32 35, 36 37, 36 40 Z" fill="url(#pawnBody)" />
        {/* Collar base */}
        <ellipse cx="24" cy="35" rx="9" ry="2.5" fill="#588f37" />
        {/* Waist & stem */}
        <path d="M18 35 C17 26, 19 22, 21 19 L27 19 C29 22, 31 26, 30 35 Z" fill="url(#pawnBody)" />
        {/* Neck collar */}
        <ellipse cx="24" cy="19" rx="6.5" ry="2" fill="#9de05d" />
        <ellipse cx="24" cy="19.5" rx="6.5" ry="1.5" fill="#45753c" opacity="0.6" />
        {/* Head Ball */}
        <circle cx="24" cy="12" r="8" fill="url(#pawnHead)" />
        {/* Specular highlight */}
        <ellipse cx="21" cy="9.5" rx="3" ry="1.8" fill="#ffffff" opacity="0.65" transform="rotate(-20 21 9.5)" />
      </g>
    </svg>
  );
}

// 3D Isometric Puzzle Piece
export function IconPuzzle3D({ size = 28, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <defs>
        <linearGradient id="puzTop" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffb84d" />
          <stop offset="60%" stopColor="#f58220" />
          <stop offset="100%" stopColor="#d9650b" />
        </linearGradient>
        <linearGradient id="puzSide" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#b85004" />
          <stop offset="100%" stopColor="#6e2d00" />
        </linearGradient>
        <filter id="puzShadow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.4" />
        </filter>
      </defs>
      <g filter="url(#puzShadow)">
        {/* Extrusion thickness */}
        <path
          d="M9 13 L9 39 C9 41 11 43 13 43 L37 43 C39 43 41 41 41 39 L41 35 L41 13 Z"
          fill="url(#puzSide)"
        />
        {/* Front Face */}
        <path
          d="M10 12 C10 10 12 8 14 8 L20 8 C20 5 22 4 24 4 C26 4 28 5 28 8 L34 8 C36 8 38 10 38 12 L38 18 C41 18 42 20 42 22 C42 24 41 26 38 26 L38 34 C38 36 36 38 34 38 L28 38 C28 36 26 35 24 35 C22 35 20 36 20 38 L14 38 C12 38 10 36 10 34 L10 26 C12 26 13 24 13 22 C13 20 12 18 10 18 Z"
          fill="url(#puzTop)"
        />
        {/* Specular Edge */}
        <path
          d="M14 9 L20 9 C20.5 6 22 5 24 5 C26 5 27.5 6 28 9 L34 9"
          stroke="#ffe6b3"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.8"
        />
        <circle cx="16" cy="15" r="2.5" fill="#ffffff" opacity="0.4" />
      </g>
    </svg>
  );
}

// 3D Target & Vision Drills
export function IconVision3D({ size = 28, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <defs>
        <radialGradient id="visOuter" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="60%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#1e40af" />
        </radialGradient>
        <radialGradient id="visCenter" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#fca5a5" />
          <stop offset="55%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#991b1b" />
        </radialGradient>
        <filter id="visShadow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.45" />
        </filter>
      </defs>
      <g filter="url(#visShadow)">
        {/* Outer Ring 3D */}
        <circle cx="24" cy="24" r="19" fill="url(#visOuter)" />
        <ellipse cx="24" cy="24" r="14" fill="#1e293b" />
        {/* Mid Ring */}
        <circle cx="24" cy="24" r="12" fill="#ffffff" />
        {/* Bullseye Core */}
        <circle cx="24" cy="24" r="7" fill="url(#visCenter)" />
        {/* Crosshair 3D pins */}
        <path d="M24 2 L24 8 M24 40 L24 46 M2 24 L8 24 M40 24 L46 24" stroke="#93c5fd" strokeWidth="2.5" strokeLinecap="round" />
        {/* Gloss highlight */}
        <ellipse cx="18" cy="14" rx="4" ry="2" fill="#ffffff" opacity="0.6" transform="rotate(-30 18 14)" />
      </g>
    </svg>
  );
}

// 3D Camera / OTB Scan
export function IconScan3D({ size = 28, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <defs>
        <linearGradient id="camBody" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="60%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#4c1d95" />
        </linearGradient>
        <radialGradient id="camLens" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="40%" stopColor="#0284c7" />
          <stop offset="85%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#020617" />
        </radialGradient>
        <filter id="camShadow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.45" />
        </filter>
      </defs>
      <g filter="url(#camShadow)">
        {/* Top flash protrusion */}
        <rect x="18" y="7" width="12" height="5" rx="2" fill="#6d28d9" />
        {/* Flash bulb */}
        <circle cx="34" cy="16" r="2.5" fill="#fde047" />
        {/* Main Body */}
        <rect x="6" y="11" width="36" height="28" rx="7" fill="url(#camBody)" />
        {/* Lens Rim Outer */}
        <circle cx="24" cy="25" r="11" fill="#312e2b" />
        <circle cx="24" cy="25" r="9.5" fill="url(#camLens)" />
        {/* Lens reflection */}
        <ellipse cx="21" cy="21" rx="3" ry="1.5" fill="#ffffff" opacity="0.65" transform="rotate(-35 21 21)" />
      </g>
    </svg>
  );
}

// 3D Community / Club Users
export function IconCommunity3D({ size = 28, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <defs>
        <linearGradient id="userGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="70%" stopColor="#059669" />
          <stop offset="100%" stopColor="#064e3b" />
        </linearGradient>
        <linearGradient id="userBack" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6ee7b7" />
          <stop offset="70%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
        <filter id="commShadow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.45" />
        </filter>
      </defs>
      <g filter="url(#commShadow)">
        {/* Back User */}
        <circle cx="32" cy="16" r="6" fill="url(#userBack)" opacity="0.85" />
        <path d="M24 36 C24 30, 27 26, 33 26 C39 26, 42 30, 42 36 Z" fill="url(#userBack)" opacity="0.85" />

        {/* Front User */}
        <circle cx="18" cy="18" r="7.5" fill="url(#userGrad)" />
        <ellipse cx="15.5" cy="15.5" rx="2.5" ry="1.5" fill="#ffffff" opacity="0.5" transform="rotate(-30 15.5 15.5)" />
        <path d="M8 40 C8 32, 12 28, 19 28 C26 28, 30 32, 30 40 Z" fill="url(#userGrad)" />
      </g>
    </svg>
  );
}

// 3D Robot / Engine Head
export function IconBot3D({ size = 28, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <defs>
        <linearGradient id="botMetal" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#cbd5e1" />
          <stop offset="50%" stopColor="#64748b" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>
        <linearGradient id="botVisor" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="50%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#15803d" />
        </linearGradient>
        <filter id="botShadow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.45" />
        </filter>
      </defs>
      <g filter="url(#botShadow)">
        {/* Antenna */}
        <rect x="22.5" y="4" width="3" height="6" rx="1.5" fill="#94a3b8" />
        <circle cx="24" cy="4" r="3" fill="#ef4444" />
        {/* Ears */}
        <rect x="5" y="21" width="4" height="8" rx="2" fill="#475569" />
        <rect x="39" y="21" width="4" height="8" rx="2" fill="#475569" />
        {/* Head Box */}
        <rect x="8" y="10" width="32" height="30" rx="8" fill="url(#botMetal)" />
        {/* Visor Screen */}
        <rect x="12" y="17" width="24" height="11" rx="4" fill="#0f172a" />
        <rect x="14" y="19" width="20" height="7" rx="2" fill="url(#botVisor)" />
        {/* Speaker / Grid */}
        <rect x="17" y="32" width="14" height="3" rx="1.5" fill="#1e293b" />
      </g>
    </svg>
  );
}

// 3D Lightning / Blitz
export function IconLightning3D({ size = 20, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id="boltGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="40%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#a16207" />
        </linearGradient>
      </defs>
      <path
        d="M13 2 L4 14 L11 14 L9 22 L20 10 L13 10 Z"
        fill="url(#boltGrad)"
        stroke="#ca8a04"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// 3D Stopwatch / Timer
export function IconClock3D({ size = 20, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id="clockGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="50%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="13" r="9" fill="url(#clockGrad)" stroke="#1e40af" strokeWidth="1" />
      <rect x="10.5" y="1" width="3" height="3" rx="1" fill="#cbd5e1" />
      <circle cx="12" cy="13" r="7" fill="#0f172a" />
      <path d="M12 9 L12 13 L15 15" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// 3D Trophy / Turnamen
export function IconTrophy3D({ size = 20, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id="trophyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="50%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#854d0e" />
        </linearGradient>
      </defs>
      <path d="M7 3 L17 3 L17 9 C17 12 14.5 14.5 12 14.5 C9.5 14.5 7 12 7 9 Z" fill="url(#trophyGrad)" />
      <path d="M7 5 L4 5 C3 5 2.5 6 3 7 L4 9 C5 11 7 11 7 11" stroke="#eab308" strokeWidth="1.5" fill="none" />
      <path d="M17 5 L20 5 C21 5 21.5 6 21 7 L20 9 C19 11 17 11 17 11" stroke="#eab308" strokeWidth="1.5" fill="none" />
      <rect x="10.5" y="14.5" width="3" height="4" fill="#ca8a04" />
      <rect x="7" y="18.5" width="10" height="3" rx="1" fill="#713f12" />
    </svg>
  );
}

// 3D Reset / Swap Arrows
export function IconSwap3D({ size = 18, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id="swapGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e2e8f0" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>
      </defs>
      <path
        d="M4 8 L16 8 M16 8 L12 4 M16 8 L12 12 M20 16 L8 16 M8 16 L12 12 M8 16 L12 20"
        stroke="url(#swapGrad)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// 3D Globe / Language
export function IconGlobe3D({ size = 18, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <radialGradient id="globeGrad" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#6ee7b7" />
          <stop offset="60%" stopColor="#059669" />
          <stop offset="100%" stopColor="#064e3b" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="9" fill="url(#globeGrad)" />
      <ellipse cx="12" cy="12" rx="4" ry="9" stroke="#ffffff" strokeWidth="1" fill="none" opacity="0.6" />
      <line x1="3" y1="12" x2="21" y2="12" stroke="#ffffff" strokeWidth="1" opacity="0.6" />
    </svg>
  );
}

// 3D Skull / Defeat / Raja Tumbang
export function IconSkull3D({ size = 48, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <defs>
        <radialGradient id="skullBone" cx="40%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="40%" stopColor="#e2e8f0" />
          <stop offset="75%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#475569" />
        </radialGradient>
        <radialGradient id="eyeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="70%" stopColor="#b91c1c" />
          <stop offset="100%" stopColor="#450a0a" />
        </radialGradient>
        <filter id="skullShadow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#ef4444" floodOpacity="0.4" />
        </filter>
      </defs>
      <g filter="url(#skullShadow)">
        {/* Cranium */}
        <path
          d="M12 22 C12 11, 16 6, 24 6 C32 6, 36 11, 36 22 C36 26, 34 29, 32 31 L32 38 C32 39.5, 30.5 41, 29 41 L19 41 C17.5 41, 16 39.5, 16 38 L16 31 C14 29, 12 26, 12 22 Z"
          fill="url(#skullBone)"
        />
        {/* Eye Sockets */}
        <ellipse cx="19" cy="22" rx="4" ry="4.5" fill="#0f172a" />
        <ellipse cx="29" cy="22" rx="4" ry="4.5" fill="#0f172a" />
        <circle cx="19" cy="22" r="2.2" fill="url(#eyeGlow)" />
        <circle cx="29" cy="22" r="2.2" fill="url(#eyeGlow)" />
        {/* Nose cavity */}
        <polygon points="24,27 22,31 26,31" fill="#1e293b" />
        {/* Teeth / Jaw vertical slits */}
        <rect x="20" y="35" width="1.8" height="4" rx="0.8" fill="#334155" />
        <rect x="23.1" y="35" width="1.8" height="4" rx="0.8" fill="#334155" />
        <rect x="26.2" y="35" width="1.8" height="4" rx="0.8" fill="#334155" />
      </g>
    </svg>
  );
}

// 3D Balance Scales / Remis
export function IconBalance3D({ size = 48, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <defs>
        <linearGradient id="metalSilver" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="50%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>
        <linearGradient id="goldPlate" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#854d0e" />
        </linearGradient>
      </defs>
      {/* Central Pillar */}
      <rect x="22.5" y="8" width="3" height="32" rx="1.5" fill="url(#metalSilver)" />
      <ellipse cx="24" cy="40" rx="11" ry="3.5" fill="url(#metalSilver)" />
      <circle cx="24" cy="8" r="3.5" fill="url(#goldPlate)" />
      {/* Beam */}
      <rect x="8" y="11" width="32" height="3" rx="1.5" fill="url(#metalSilver)" />
      {/* Left Pan */}
      <line x1="12" y1="13" x2="8" y2="25" stroke="#94a3b8" strokeWidth="1.2" />
      <line x1="12" y1="13" x2="16" y2="25" stroke="#94a3b8" strokeWidth="1.2" />
      <ellipse cx="12" cy="25" rx="6.5" ry="2.5" fill="url(#goldPlate)" />
      {/* Right Pan */}
      <line x1="36" y1="13" x2="32" y2="25" stroke="#94a3b8" strokeWidth="1.2" />
      <line x1="36" y1="13" x2="40" y2="25" stroke="#94a3b8" strokeWidth="1.2" />
      <ellipse cx="36" cy="25" rx="6.5" ry="2.5" fill="url(#goldPlate)" />
    </svg>
  );
}

// 3D White Surrender Flag for Resignation
export function IconFlag3D({ size = 48, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="flagPole" x1="16" y1="8" x2="22" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e2e8f0" />
          <stop offset="0.5" stopColor="#94a3b8" />
          <stop offset="1" stopColor="#475569" />
        </linearGradient>
        <linearGradient id="flagCloth" x1="20" y1="12" x2="54" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="0.6" stopColor="#f1f5f9" />
          <stop offset="1" stopColor="#cbd5e1" />
        </linearGradient>
        <filter id="flagShadow" x="12" y="8" width="46" height="54" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.4" />
        </filter>
      </defs>
      <g filter="url(#flagShadow)">
        {/* Pole */}
        <rect x="18" y="10" width="4" height="46" rx="2" fill="url(#flagPole)" />
        <circle cx="20" cy="10" r="3.5" fill="#f59e0b" />
        {/* Waving Cloth */}
        <path
          d="M22 13C28 11 34 16 40 14C46 12 50 14 52 15V35C46 33 42 36 36 34C30 32 26 36 22 35V13Z"
          fill="url(#flagCloth)"
          stroke="#94a3b8"
          strokeWidth="0.75"
        />
      </g>
    </svg>
  );
}

// 3D Fire / Streak
export function IconFire3D({ size = 24, className = "" }: IconProps) {
  const uid = useId().replace(/:/g, "_");
  const fireOuter = "fireOuter_" + uid;
  const fireInner = "fireInner_" + uid;
  const fireGlow = "fireGlow_" + uid;

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
      <g filter={"url(#" + fireGlow + ")"}>
        <path d="M32 4C32 4 48 20 48 38C48 48 40.8 56 32 56C23.2 56 16 48 16 38C16 26 26 14 32 4Z" fill={"url(#" + fireOuter + ")"} />
        <path d="M32 20C32 20 40 30 40 40C40 45 36.4 49 32 49C27.6 49 24 45 24 40C24 33 29 26 32 20Z" fill={"url(#" + fireInner + ")"} />
      </g>
    </svg>
  );
}

// 3D Gold Star
export function IconStar3D({ size = 24, className = "" }: IconProps) {
  const uid = useId().replace(/:/g, "_");
  const starGrad = "starGrad_" + uid;
  const starShadow = "starShadow_" + uid;

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
      <g filter={"url(#" + starShadow + ")"}>
        <polygon points="32,6 40,24 60,25 44,38 50,56 32,45 14,56 20,38 4,25 24,24" fill={"url(#" + starGrad + ")"} stroke="#f59e0b" strokeWidth="1" />
      </g>
    </svg>
  );
}

// 3D Medal Badge
export function IconMedal3D({ size = 24, className = "" }: IconProps) {
  const uid = useId().replace(/:/g, "_");
  const medalDisc = "medalDisc_" + uid;

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id={medalDisc} x1="16" y1="24" x2="48" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fde68a" />
          <stop offset="0.5" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#b45309" />
        </linearGradient>
      </defs>
      {/* Ribbons */}
      <polygon points="22,6 32,24 16,24" fill="#3b82f6" />
      <polygon points="42,6 48,24 32,24" fill="#ef4444" />
      {/* Medal Body */}
      <circle cx="32" cy="40" r="16" fill={"url(#" + medalDisc + ")"} stroke="#d97706" strokeWidth="1.5" />
      <circle cx="32" cy="40" r="11" fill="none" stroke="#fef3c7" strokeWidth="1.5" strokeDasharray="3 2" />
    </svg>
  );
}

// 3D Lock
export function IconLock3D({ size = 20, className = "" }: IconProps) {
  const uid = useId().replace(/:/g, "_");
  const shackleGrad = "shackleGrad_" + uid;
  const lockBody = "lockBody_" + uid;

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
      <path d="M22 30V20C22 14.5 26.5 10 32 10C37.5 10 42 14.5 42 20V30" stroke={"url(#" + shackleGrad + ")"} strokeWidth="6" strokeLinecap="round" fill="none" />
      <rect x="16" y="28" width="32" height="26" rx="6" fill={"url(#" + lockBody + ")"} stroke="#92400e" strokeWidth="1.5" />
      <circle cx="32" cy="40" r="3.5" fill="#78350f" />
    </svg>
  );
}
