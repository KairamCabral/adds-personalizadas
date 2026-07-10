"use client";

import { useEffect, useRef } from "react";

const COLORS = ["#21add6", "#f07d00", "#ffd54a", "#ffffff", "#0b4269"];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  color: string;
  life: number;
}

/**
 * Confete em <canvas> — sem dependência. Dispara uma rajada sempre que `fireKey`
 * muda (incrementa). Cores da marca ADDS. Cobre a tela (pointer-events none).
 */
export function ConfettiCanvas({ fireKey }: { fireKey: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (fireKey <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = (canvas.width = canvas.offsetWidth);
    const h = (canvas.height = canvas.offsetHeight);

    // Duas fontes de emissão (cantos inferiores) mirando pra cima e ao centro.
    const count = 220;
    for (let i = 0; i < count; i++) {
      const fromLeft = i % 2 === 0;
      particlesRef.current.push({
        x: fromLeft ? w * 0.08 : w * 0.92,
        y: h * 0.9,
        vx: (fromLeft ? 1 : -1) * (2 + Math.random() * 6),
        vy: -(9 + Math.random() * 9),
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.4,
        size: 6 + Math.random() * 8,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        life: 1,
      });
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const gravity = 0.28;
    const drag = 0.992;

    const step = () => {
      ctx.clearRect(0, 0, w, h);
      const ps = particlesRef.current;
      for (const p of ps) {
        p.vy += gravity;
        p.vx *= drag;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        if (p.y > h * 0.72) p.life -= 0.012;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
      particlesRef.current = ps.filter((p) => p.life > 0 && p.y < h + 40);
      if (particlesRef.current.length > 0) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        ctx.clearRect(0, 0, w, h);
        rafRef.current = null;
      }
    };

    if (rafRef.current == null) rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [fireKey]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
