// Zero-dependency Authentic Web Audio API Sound Engine (Chess.com Acoustic Sound Profile)
class ChessSoundEngine {
  private ctx: AudioContext | null = null;
  private unlocked = false;

  constructor() {
    if (typeof window !== "undefined") {
      const unlock = () => {
        this.init();
        if (this.ctx && this.ctx.state === "suspended") {
          void this.ctx.resume();
        }
        this.unlocked = true;
        window.removeEventListener("click", unlock);
        window.removeEventListener("keydown", unlock);
        window.removeEventListener("touchstart", unlock);
      };
      window.addEventListener("click", unlock, { once: true, passive: true });
      window.addEventListener("keydown", unlock, { once: true, passive: true });
      window.addEventListener("touchstart", unlock, { once: true, passive: true });
    }
  }

  private init(): boolean {
    if (typeof window === "undefined") return false;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return Boolean(this.ctx);
  }

  playMove() {
    if (!this.init()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(280, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.11);

    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.12);
  }

  playCapture() {
    if (!this.init()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;

    const oscClick = ctx.createOscillator();
    const gainClick = ctx.createGain();
    oscClick.type = "triangle";
    oscClick.frequency.setValueAtTime(620, t);
    oscClick.frequency.exponentialRampToValueAtTime(140, t + 0.06);
    gainClick.gain.setValueAtTime(0.8, t);
    gainClick.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    oscClick.connect(gainClick);
    gainClick.connect(ctx.destination);
    oscClick.start(t);
    oscClick.stop(t + 0.07);

    const oscThud = ctx.createOscillator();
    const gainThud = ctx.createGain();
    oscThud.type = "sine";
    oscThud.frequency.setValueAtTime(220, t + 0.01);
    oscThud.frequency.exponentialRampToValueAtTime(50, t + 0.14);
    gainThud.gain.setValueAtTime(0.9, t + 0.01);
    gainThud.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    oscThud.connect(gainThud);
    gainThud.connect(ctx.destination);
    oscThud.start(t + 0.01);
    oscThud.stop(t + 0.15);
  }

  playCheck() {
    if (!this.init()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;

    [659.25, 987.77].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = t + idx * 0.03;
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.5, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.23);
    });
  }

  playCastle() {
    if (!this.init()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;

    [0, 0.09].forEach((delay, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = t + delay;
      osc.type = "sine";
      osc.frequency.setValueAtTime(idx === 0 ? 260 : 210, start);
      osc.frequency.exponentialRampToValueAtTime(70, start + 0.09);
      gain.gain.setValueAtTime(0.7, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.1);
    });
  }

  playGameEnd(won: boolean) {
    if (!this.init()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;

    const notes = won
      ? [523.25, 659.25, 783.99, 1046.5]
      : [392.0, 349.23, 311.13, 261.63];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = t + idx * 0.1;
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.4, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.26);
    });
  }
}

export const chessSound = new ChessSoundEngine();
