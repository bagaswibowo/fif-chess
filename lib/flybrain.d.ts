// Type declarations for FlyBrain native JS modules (JEV-013: replace // @ts-ignore)
declare module "./loader.js" {
  export function parseArrays(header: any, buffer: ArrayBuffer): any;
}
declare module "./flybrain.js" {
  export class FlyBrain {
    constructor(opts: { header: any; arrays: any });
    forward(planes: any): { policy: Float32Array; value: number; activity: any; retinaDrive: any };
  }
}
declare module "./encoding.js" {
  export function encodeBoard(chess: any): any;
  export function legalMoveIndices(chess: any): number[] | null;
  export function indexToMove(index: number, chess: any): string;
  export * as enc from "./encoding.js";
}
