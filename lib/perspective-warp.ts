// Homography & Perspective Warping for Chessboard Scanning (Oce / CamScanner style)
// Implements Heckbert 2D Projective Mapping with Bilinear Interpolation.

export interface Point {
  x: number;
  y: number;
}

export type Quad = [Point, Point, Point, Point]; // Ordered: [TL, TR, BR, BL]

export interface Matrix3x3 {
  m00: number; m01: number; m02: number;
  m10: number; m11: number; m12: number;
  m20: number; m21: number; m22: number;
}

/**
 * Computes Heckbert 3x3 Homography Matrix mapping target square [0, size]x[0, size]
 * to an arbitrary source quadrilateral (TL, TR, BR, BL).
 * This matrix is used for inverse mapping during raster image warping.
 */
export function getSquareToQuadHomography(quad: Quad, size: number): Matrix3x3 {
  const [p0, p1, p2, p3] = quad;
  const x0 = p0.x, y0 = p0.y;
  const x1 = p1.x, y1 = p1.y;
  const x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y;

  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;

  const det = dx1 * dy2 - dx2 * dy1;
  let a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number;

  if (Math.abs(det) < 1e-7) {
    // Parallelogram / Affine fallback
    g = 0;
    h = 0;
    a = x1 - x0;
    b = x2 - x1;
    c = x0;
    d = y1 - y0;
    e = y2 - y1;
    f = y0;
  } else {
    g = (dx3 * dy2 - dx2 * dy3) / det;
    h = (dx1 * dy3 - dx3 * dy1) / det;
    a = x1 - x0 + g * x1;
    b = x3 - x0 + h * x3;
    c = x0;
    d = y1 - y0 + g * y1;
    e = y3 - y0 + h * y3;
    f = y0;
  }

  const S = size;
  return {
    m00: a / S,
    m01: b / S,
    m02: c,
    m10: d / S,
    m11: e / S,
    m12: f,
    m20: g / S,
    m21: h / S,
    m22: 1.0,
  };
}

/**
 * Computes Heckbert 3x3 Homography Matrix mapping unit square [0, 1]x[0, 1]
 * to arbitrary screen/image quad. Used for drawing 8x8 perspective grid guidelines.
 */
export function getUnitSquareToQuadHomography(quad: Quad): Matrix3x3 {
  return getSquareToQuadHomography(quad, 1.0);
}

/**
 * Projects a point (x, y) through a 3x3 homography matrix.
 */
export function projectPoint(M: Matrix3x3, x: number, y: number): Point {
  const w = x * M.m20 + y * M.m21 + M.m22;
  const invW = Math.abs(w) > 1e-9 ? 1.0 / w : 1.0;
  return {
    x: (x * M.m00 + y * M.m01 + M.m02) * invW,
    y: (x * M.m10 + y * M.m11 + M.m12) * invW,
  };
}

/**
 * Warps a quad region from an HTMLImageElement or Canvas to an unskewed 800x800 square image.
 * Uses high-performance bilinear interpolation (~25ms CPU execution).
 */
export function warpQuadToSquare(
  source: HTMLImageElement | HTMLCanvasElement,
  normalizedQuad: Quad, // Coordinates in [0..1] relative to source dimensions
  outputSize = 800,
  quality = 0.90
): string {
  if (typeof window === "undefined") return "";

  const srcW = "naturalWidth" in source ? source.naturalWidth : source.width;
  const srcH = "naturalHeight" in source ? source.naturalHeight : source.height;

  if (!srcW || !srcH) throw new Error("Invalid source image dimensions");

  // Read source pixel buffer
  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = srcW;
  srcCanvas.height = srcH;
  const srcCtx = srcCanvas.getContext("2d", { willReadFrequently: true });
  if (!srcCtx) throw new Error("Canvas 2D context unavailable");

  srcCtx.drawImage(source, 0, 0);
  const srcImageData = srcCtx.getImageData(0, 0, srcW, srcH);
  const srcData = srcImageData.data;

  // Convert normalized [0..1] corners to pixel coordinates
  const pixelQuad: Quad = [
    { x: normalizedQuad[0].x * srcW, y: normalizedQuad[0].y * srcH },
    { x: normalizedQuad[1].x * srcW, y: normalizedQuad[1].y * srcH },
    { x: normalizedQuad[2].x * srcW, y: normalizedQuad[2].y * srcH },
    { x: normalizedQuad[3].x * srcW, y: normalizedQuad[3].y * srcH },
  ];

  const H = getSquareToQuadHomography(pixelQuad, outputSize);

  // Allocate destination canvas and pixel buffer
  const dstCanvas = document.createElement("canvas");
  dstCanvas.width = outputSize;
  dstCanvas.height = outputSize;
  const dstCtx = dstCanvas.getContext("2d");
  if (!dstCtx) throw new Error("Canvas 2D context unavailable");

  const dstImageData = dstCtx.createImageData(outputSize, outputSize);
  const dstData = dstImageData.data;

  const m00 = H.m00, m01 = H.m01, m02 = H.m02;
  const m10 = H.m10, m11 = H.m11, m12 = H.m12;
  const m20 = H.m20, m21 = H.m21;

  let dstIdx = 0;
  for (let y = 0; y < outputSize; y++) {
    const y_m01 = y * m01 + m02;
    const y_m11 = y * m11 + m12;
    const y_m21 = y * m21 + 1.0;

    for (let x = 0; x < outputSize; x++) {
      const w = x * m20 + y_m21;
      const invW = 1.0 / w;
      const u = (x * m00 + y_m01) * invW;
      const v = (x * m10 + y_m11) * invW;

      const u0 = Math.floor(u);
      const v0 = Math.floor(v);

      if (u0 >= 0 && u0 < srcW - 1 && v0 >= 0 && v0 < srcH - 1) {
        const fu = u - u0;
        const fv = v - v0;

        const i00 = (v0 * srcW + u0) * 4;
        const i10 = i00 + 4;
        const i01 = i00 + srcW * 4;
        const i11 = i01 + 4;

        const w00 = (1.0 - fu) * (1.0 - fv);
        const w10 = fu * (1.0 - fv);
        const w01 = (1.0 - fu) * fv;
        const w11 = fu * fv;

        dstData[dstIdx] = (srcData[i00] * w00 + srcData[i10] * w10 + srcData[i01] * w01 + srcData[i11] * w11) | 0;
        dstData[dstIdx + 1] = (srcData[i00 + 1] * w00 + srcData[i10 + 1] * w10 + srcData[i01 + 1] * w01 + srcData[i11 + 1] * w11) | 0;
        dstData[dstIdx + 2] = (srcData[i00 + 2] * w00 + srcData[i10 + 2] * w10 + srcData[i01 + 2] * w01 + srcData[i11 + 2] * w11) | 0;
        dstData[dstIdx + 3] = 255;
      } else {
        // Border / out-of-bounds padding: subtle dark frame
        dstData[dstIdx] = 24;
        dstData[dstIdx + 1] = 24;
        dstData[dstIdx + 2] = 24;
        dstData[dstIdx + 3] = 255;
      }
      dstIdx += 4;
    }
  }

  dstCtx.putImageData(dstImageData, 0, 0);
  return dstCanvas.toDataURL("image/jpeg", quality);
}
