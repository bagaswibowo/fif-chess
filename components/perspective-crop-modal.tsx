"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  type Point,
  type Quad,
  getUnitSquareToQuadHomography,
  projectPoint,
  warpQuadToSquare,
} from "@/lib/perspective-warp";
import { IconClose3D, IconCheck3D } from "@/components/icons3d";

interface PerspectiveCropModalProps {
  imageUrl: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (warpedDataUrl: string) => void;
  onSkip?: (originalDataUrl: string) => void;
  lang?: "id" | "en";
}

const DEFAULT_CORNERS: Quad = [
  { x: 0.12, y: 0.12 }, // TL
  { x: 0.88, y: 0.12 }, // TR
  { x: 0.88, y: 0.88 }, // BR
  { x: 0.12, y: 0.88 }, // BL
];

const CORNER_NAMES = [
  { id: "A8", label: "TL" },
  { id: "H8", label: "TR" },
  { id: "H1", label: "BR" },
  { id: "A1", label: "BL" },
];

export function PerspectiveCropModal({
  imageUrl,
  isOpen,
  onClose,
  onConfirm,
  onSkip,
  lang = "id",
}: PerspectiveCropModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [corners, setCorners] = useState<Quad>(DEFAULT_CORNERS);
  const [activeHandle, setActiveHandle] = useState<number | null>(null);
  const [isWarping, setIsWarping] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showGrid, setShowGrid] = useState(true);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragStartRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const cornersStartRef = useRef<Quad | null>(null);

  // Load and rotate source image
  useEffect(() => {
    if (!imageUrl || !isOpen) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      setImageLoaded(true);
      setCorners(DEFAULT_CORNERS);
    };
    img.src = imageUrl;
  }, [imageUrl, isOpen]);

  // Rotasi 90 derajat
  const handleRotate = useCallback(() => {
    if (!imgRef.current) return;
    const curr = imgRef.current;
    const offCanvas = document.createElement("canvas");
    offCanvas.width = curr.naturalHeight;
    offCanvas.height = curr.naturalWidth;
    const ctx = offCanvas.getContext("2d");
    if (!ctx) return;

    ctx.translate(offCanvas.width / 2, offCanvas.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(curr, -curr.naturalWidth / 2, -curr.naturalHeight / 2);

    const rotatedData = offCanvas.toDataURL("image/jpeg", 0.92);
    const newImg = new Image();
    newImg.onload = () => {
      imgRef.current = newImg;
      setCorners(DEFAULT_CORNERS);
      renderCanvas();
    };
    newImg.src = rotatedData;
  }, []);

  const handleResetCorners = () => {
    setCorners(DEFAULT_CORNERS);
  };

  // Canvas coordinate mapping helper
  const getCanvasLayout = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return null;

    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    const scale = Math.min(cw / iw, ch / ih);
    const renderW = iw * scale;
    const renderH = ih * scale;
    const offsetX = (cw - renderW) / 2;
    const offsetY = (ch - renderH) / 2;

    return { cw, ch, iw, ih, scale, renderW, renderH, offsetX, offsetY };
  }, []);

  // Main canvas render loop
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const layout = getCanvasLayout();
    if (!layout) return;

    const { cw, ch, renderW, renderH, offsetX, offsetY, iw, ih } = layout;

    // Clear
    ctx.clearRect(0, 0, cw, ch);

    // 1. Draw base image
    ctx.drawImage(img, offsetX, offsetY, renderW, renderH);

    // Screen coordinates of 4 corners
    const screenPts: Point[] = corners.map((c) => ({
      x: offsetX + c.x * renderW,
      y: offsetY + c.y * renderH,
    }));

    // 2. Darken area outside quadrilateral (even-odd fill)
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    ctx.rect(0, 0, cw, ch);
    ctx.moveTo(screenPts[0].x, screenPts[0].y);
    ctx.lineTo(screenPts[1].x, screenPts[1].y);
    ctx.lineTo(screenPts[2].x, screenPts[2].y);
    ctx.lineTo(screenPts[3].x, screenPts[3].y);
    ctx.closePath();
    ctx.fill("evenodd");
    ctx.restore();

    // 3. Perspective 8x8 Grid overlay
    if (showGrid) {
      const screenQuad: Quad = [screenPts[0], screenPts[1], screenPts[2], screenPts[3]];
      const Hscreen = getUnitSquareToQuadHomography(screenQuad);

      ctx.save();
      ctx.lineWidth = 1;

      // Rank lines (horizontal perspective)
      for (let r = 1; r < 8; r++) {
        const t = r / 8;
        const pLeft = projectPoint(Hscreen, 0, t);
        const pRight = projectPoint(Hscreen, 1, t);
        ctx.strokeStyle = "rgba(250, 204, 21, 0.45)"; // Amber yellow
        ctx.beginPath();
        ctx.moveTo(pLeft.x, pLeft.y);
        ctx.lineTo(pRight.x, pRight.y);
        ctx.stroke();
      }

      // File lines (vertical perspective)
      for (let c = 1; c < 8; c++) {
        const s = c / 8;
        const pTop = projectPoint(Hscreen, s, 0);
        const pBottom = projectPoint(Hscreen, s, 1);
        ctx.strokeStyle = "rgba(56, 189, 248, 0.45)"; // Sky blue
        ctx.beginPath();
        ctx.moveTo(pTop.x, pTop.y);
        ctx.lineTo(pBottom.x, pBottom.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 4. Draw outer border lines
    ctx.save();
    ctx.strokeStyle = "#10b981"; // Emerald green
    ctx.lineWidth = 2.5;
    ctx.shadowColor = "rgba(16, 185, 129, 0.6)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(screenPts[0].x, screenPts[0].y);
    ctx.lineTo(screenPts[1].x, screenPts[1].y);
    ctx.lineTo(screenPts[2].x, screenPts[2].y);
    ctx.lineTo(screenPts[3].x, screenPts[3].y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // 5. Draw 4 Corner Handles
    screenPts.forEach((pt, idx) => {
      const isActive = activeHandle === idx;
      ctx.save();
      // Outer glow
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isActive ? 16 : 13, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? "#10b981" : "#ffffff";
      ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
      ctx.shadowBlur = 6;
      ctx.fill();

      // Inner ring
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isActive ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? "#ffffff" : "#059669";
      ctx.fill();

      // Corner tag
      ctx.font = "bold 10px monospace";
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = 4;
      const label = CORNER_NAMES[idx].id;
      const offsetXLabel = idx === 0 || idx === 3 ? -24 : 12;
      const offsetYLabel = idx === 0 || idx === 1 ? -10 : 18;
      ctx.fillText(label, pt.x + offsetXLabel, pt.y + offsetYLabel);
      ctx.restore();
    });

    // 6. CamScanner / Oce Loupe Magnifier
    if (activeHandle !== null && activeHandle >= 0 && activeHandle < 4) {
      const activeScreenPt = screenPts[activeHandle];
      const activeImgNorm = corners[activeHandle];

      // Loupe placement: float above touch handle, or below if near top edge
      const loupeRadius = 52;
      let loupeX = activeScreenPt.x;
      let loupeY = activeScreenPt.y - 80;

      if (loupeY - loupeRadius < 10) {
        loupeY = activeScreenPt.y + 80;
      }
      if (loupeX - loupeRadius < 10) loupeX = loupeRadius + 10;
      if (loupeX + loupeRadius > cw - 10) loupeX = cw - loupeRadius - 10;

      ctx.save();
      // Circular clip
      ctx.beginPath();
      ctx.arc(loupeX, loupeY, loupeRadius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      // Draw zoomed portion of source image
      const zoom = 2.4;
      const srcZoomW = (loupeRadius * 2) / zoom / layout.scale;
      const srcZoomH = (loupeRadius * 2) / zoom / layout.scale;
      const srcCenterX = activeImgNorm.x * iw;
      const srcCenterY = activeImgNorm.y * ih;

      ctx.drawImage(
        img,
        srcCenterX - srcZoomW / 2,
        srcCenterY - srcZoomH / 2,
        srcZoomW,
        srcZoomH,
        loupeX - loupeRadius,
        loupeY - loupeRadius,
        loupeRadius * 2,
        loupeRadius * 2
      );

      // Loupe Reticle Crosshair
      ctx.strokeStyle = "#38bdf8"; // Sky blue crosshair
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(loupeX - loupeRadius, loupeY);
      ctx.lineTo(loupeX + loupeRadius, loupeY);
      ctx.moveTo(loupeX, loupeY - loupeRadius);
      ctx.lineTo(loupeX, loupeY + loupeRadius);
      ctx.stroke();

      // Center target dot
      ctx.beginPath();
      ctx.arc(loupeX, loupeY, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#ef4444";
      ctx.fill();
      ctx.restore();

      // Loupe Border Ring & Shadow
      ctx.save();
      ctx.beginPath();
      ctx.arc(loupeX, loupeY, loupeRadius, 0, Math.PI * 2);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3.5;
      ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.restore();
    }
  }, [corners, activeHandle, showGrid, getCanvasLayout]);

  // Sync canvas size to container on resize
  useEffect(() => {
    if (!isOpen || !imageLoaded) return;
    const handleResize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      renderCanvas();
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isOpen, imageLoaded, renderCanvas]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Pointer / Touch interaction
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = canvas.width / rect.width;
    const clientX = (e.clientX - rect.left) * dpr;
    const clientY = (e.clientY - rect.top) * dpr;

    const layout = getCanvasLayout();
    if (!layout) return;

    const { renderW, renderH, offsetX, offsetY } = layout;

    // Check hit on 4 corners (hit radius 32px)
    const HIT_RADIUS = 32 * (canvas.width / rect.width);
    let hitIndex: number | null = null;

    for (let i = 0; i < 4; i++) {
      const sx = offsetX + corners[i].x * renderW;
      const sy = offsetY + corners[i].y * renderH;
      const dist = Math.hypot(clientX - sx, clientY - sy);
      if (dist <= HIT_RADIUS) {
        hitIndex = i;
        break;
      }
    }

    if (hitIndex !== null) {
      setActiveHandle(hitIndex);
      dragStartRef.current = { clientX, clientY };
      cornersStartRef.current = [...corners] as Quad;
      canvas.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeHandle === null || !dragStartRef.current || !cornersStartRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = canvas.width / rect.width;
    const clientX = (e.clientX - rect.left) * dpr;
    const clientY = (e.clientY - rect.top) * dpr;

    const layout = getCanvasLayout();
    if (!layout) return;

    const { renderW, renderH } = layout;
    const dx = (clientX - dragStartRef.current.clientX) / renderW;
    const dy = (clientY - dragStartRef.current.clientY) / renderH;

    const orig = cornersStartRef.current[activeHandle];
    const newX = Math.max(0.01, Math.min(0.99, orig.x + dx));
    const newY = Math.max(0.01, Math.min(0.99, orig.y + dy));

    setCorners((prev) => {
      const next = [...prev] as Quad;
      next[activeHandle] = { x: newX, y: newY };
      return next;
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeHandle !== null && canvasRef.current) {
      try {
        canvasRef.current.releasePointerCapture(e.pointerId);
      } catch {}
    }
    setActiveHandle(null);
    dragStartRef.current = null;
    cornersStartRef.current = null;
  };

  // Perform Perspective Warp
  const handleConfirmWarp = async () => {
    if (!imgRef.current) return;
    try {
      setIsWarping(true);
      // Small timeout to allow UI update
      setTimeout(() => {
        try {
          const warpedDataUrl = warpQuadToSquare(imgRef.current!, corners, 800, 0.90);
          onConfirm(warpedDataUrl);
        } catch {
          onConfirm(imageUrl);
        } finally {
          setIsWarping(false);
        }
      }, 50);
    } catch {
      setIsWarping(false);
      onConfirm(imageUrl);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in select-none">
      <div className="w-full max-w-xl bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center gap-2">
            <span className="text-base">📐</span>
            <div>
              <h3 className="font-bold text-white text-sm leading-none">
                {lang === "id" ? "Potong & Luruskan Papan (Oce Scanner)" : "Perspective Board Crop (Oce Scanner)"}
              </h3>
              <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5 mb-0">
                {lang === "id"
                  ? "Tarik 4 sudut (TL, TR, BR, BL) agar tepat di tepi petak catur"
                  : "Drag 4 corner handles to align with the board edges"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <IconClose3D size={18} />
          </button>
        </div>

        {/* Canvas Workspace */}
        <div
          ref={containerRef}
          className="relative flex-1 min-h-[300px] sm:min-h-[400px] max-h-[60vh] bg-neutral-950 flex items-center justify-center overflow-hidden touch-none"
        >
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="cursor-crosshair block touch-none"
          />

          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-400">
              Memuat gambar...
            </div>
          )}
        </div>

        {/* Toolbar Controls */}
        <div className="p-3 bg-[var(--surface)] border-t border-[var(--border)] space-y-3">
          <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRotate}
                className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-medium border border-neutral-700 flex items-center gap-1.5 transition-colors"
                title="Putar gambar 90 derajat searah jarum jam"
              >
                <span>🔄</span>
                <span>{lang === "id" ? "Putar 90°" : "Rotate 90°"}</span>
              </button>

              <button
                type="button"
                onClick={handleResetCorners}
                className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium border border-neutral-700 flex items-center gap-1.5 transition-colors"
                title="Kembalikan posisi sudut ke default"
              >
                <span>🎯</span>
                <span>{lang === "id" ? "Reset Sudut" : "Reset"}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowGrid(!showGrid)}
              className={`px-2.5 py-1 rounded-lg font-medium border transition-colors flex items-center gap-1.5 ${
                showGrid
                  ? "bg-emerald-950/80 border-emerald-600 text-emerald-300"
                  : "bg-neutral-800 border-neutral-700 text-neutral-400"
              }`}
            >
              <span>▦</span>
              <span>{lang === "id" ? "Kisi 8x8" : "8x8 Grid"}</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            {onSkip && (
              <button
                type="button"
                onClick={() => onSkip(imageUrl)}
                disabled={isWarping}
                className="px-3 py-2 text-xs rounded-xl bg-neutral-800 text-neutral-400 hover:text-white font-medium border border-neutral-700 transition-colors"
              >
                {lang === "id" ? "Lewati" : "Skip"}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              disabled={isWarping}
              className="flex-1 py-2 text-xs rounded-xl bg-neutral-800 text-neutral-300 hover:text-white font-medium border border-neutral-700 transition-colors"
            >
              {lang === "id" ? "Batal" : "Cancel"}
            </button>

            <button
              type="button"
              onClick={handleConfirmWarp}
              disabled={isWarping || !imageLoaded}
              className="flex-1 py-2 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isWarping ? (
                <span>{lang === "id" ? "Meluruskan..." : "Rectifying..."}</span>
              ) : (
                <>
                  <IconCheck3D size={16} />
                  <span>{lang === "id" ? "Potong & Pindai AI" : "Crop & Scan AI"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
