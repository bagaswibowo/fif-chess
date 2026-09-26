// Runnable verification for lib/perspective-warp.ts
import assert from "node:assert/strict";
import {
  getSquareToQuadHomography,
  getUnitSquareToQuadHomography,
  projectPoint,
  type Quad,
} from "../lib/perspective-warp.ts";

// 1. Verify exact corner projection on real user_scan corners
const userScanCorners: Quad = [
  { x: 126, y: 43 },   // TL
  { x: 346, y: 44 },   // TR
  { x: 398, y: 248 },  // BR
  { x: 81, y: 248 },   // BL
];

const S = 800;
const H = getSquareToQuadHomography(userScanCorners, S);

// Test (0, 0) -> TL
const pTL = projectPoint(H, 0, 0);
assert.ok(Math.abs(pTL.x - 126) < 1e-4, `TL.x mismatch: got ${pTL.x}`);
assert.ok(Math.abs(pTL.y - 43) < 1e-4, `TL.y mismatch: got ${pTL.y}`);

// Test (800, 0) -> TR
const pTR = projectPoint(H, S, 0);
assert.ok(Math.abs(pTR.x - 346) < 1e-4, `TR.x mismatch: got ${pTR.x}`);
assert.ok(Math.abs(pTR.y - 44) < 1e-4, `TR.y mismatch: got ${pTR.y}`);

// Test (800, 800) -> BR
const pBR = projectPoint(H, S, S);
assert.ok(Math.abs(pBR.x - 398) < 1e-4, `BR.x mismatch: got ${pBR.x}`);
assert.ok(Math.abs(pBR.y - 248) < 1e-4, `BR.y mismatch: got ${pBR.y}`);

// Test (0, 800) -> BL
const pBL = projectPoint(H, 0, S);
assert.ok(Math.abs(pBL.x - 81) < 1e-4, `BL.x mismatch: got ${pBL.x}`);
assert.ok(Math.abs(pBL.y - 248) < 1e-4, `BL.y mismatch: got ${pBL.y}`);

// 2. Unit square projection for 8x8 perspective grid
const Hunit = getUnitSquareToQuadHomography(userScanCorners);
const uTL = projectPoint(Hunit, 0, 0);
assert.ok(Math.abs(uTL.x - 126) < 1e-4);
const uBR = projectPoint(Hunit, 1, 1);
assert.ok(Math.abs(uBR.x - 398) < 1e-4);

// 3. Center point projective keystone:
// In perspective, the center of the board is foreshortened (higher than midpoint y)
const center = projectPoint(Hunit, 0.5, 0.5);
// Average of corners y is (43 + 44 + 248 + 248) / 4 = 145.75
// Due to perspective keystone, true projective center is distinct from naive affine average
assert.ok(center.x > 0 && center.y > 0, "Center coordinates should be positive");
assert.ok(center.y < 145.75, `Center y ${center.y} must exhibit perspective foreshortening (< 145.75)`);

// 4. Parallelogram / Affine test
const rectCorners: Quad = [
  { x: 10, y: 10 },
  { x: 110, y: 10 },
  { x: 110, y: 110 },
  { x: 10, y: 110 },
];
const Hrect = getSquareToQuadHomography(rectCorners, 100);
const rCenter = projectPoint(Hrect, 50, 50);
assert.ok(Math.abs(rCenter.x - 60) < 1e-4);
assert.ok(Math.abs(rCenter.y - 60) < 1e-4);

console.log("All perspective warp homography tests PASSED successfully!");
