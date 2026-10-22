import { alpha } from "../pixel/color";
import type { Surface } from "../pixel/surface";
import { drawText, textWidth } from "../pixel/font";

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  age: number;
  color: string;
  size: number;
  gravity: number;
  /** Optional attractor (qi flowing into the cultivator). */
  tx?: number;
  ty?: number;
}

export interface Floater {
  text: string;
  x: number;
  y: number;
  color: string;
  age: number;
  life: number;
  scale: number;
}

/** Small particle + floating-text system, in whichever coordinate space the caller uses. */
export class Effects {
  particles: Particle[] = [];
  floaters: Floater[] = [];

  emit(p: Partial<Particle> & { x: number; y: number }): void {
    this.particles.push({ vx: 0, vy: 0, life: 1, age: 0, color: "#ffffff", size: 1, gravity: 0, ...p });
  }

  burst(x: number, y: number, n: number, colors: string[], speed = 60, opts: Partial<Particle> = {}): void {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const v = speed * (0.4 + Math.random() * 0.8);
      this.emit({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.5, color: colors[i % colors.length], size: Math.random() < 0.3 ? 2 : 1, ...opts });
    }
  }

  float(text: string, x: number, y: number, color: string, scale = 1, life = 1.1): void {
    this.floaters.push({ text, x, y, color, age: 0, life, scale });
  }

  update(dt: number): void {
    for (const p of this.particles) {
      p.age += dt;
      if (p.tx !== undefined && p.ty !== undefined) {
        p.vx += (p.tx - p.x) * dt * 6;
        p.vy += (p.ty - p.y) * dt * 6;
        p.vx *= 0.92;
        p.vy *= 0.92;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
    for (const f of this.floaters) f.age += dt;
    this.floaters = this.floaters.filter((f) => f.age < f.life);
  }

  draw(s: Surface, offsetX = 0): void {
    for (const p of this.particles) {
      const k = 1 - p.age / p.life;
      s.rect(p.x - offsetX, p.y, p.size, p.size, alpha(p.color, Math.min(1, k * 1.5)));
    }
    for (const f of this.floaters) {
      const k = f.age / f.life;
      const rise = Math.min(1, k * 3) * 14 + k * 6;
      const pop = k < 0.12 ? 1 : 0;
      const w = textWidth(f.text, f.scale + pop);
      drawText(s, f.text, f.x - offsetX - w / 2, f.y - rise, k > 0.75 ? alpha(f.color, (1 - k) * 4) : f.color, { outline: k > 0.75 ? alpha("#140c20", (1 - k) * 4) : "#140c20", scale: f.scale + pop });
    }
  }

  clear(): void {
    this.particles = [];
    this.floaters = [];
  }
}
