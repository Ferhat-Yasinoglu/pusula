"use client";
import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "../landingMotion";

/**
 * Fixed backdrop: a slow field of gold star-dust with faint constellation
 * lines between near neighbours, a few great rings of a celestial chart, and
 * a soft light that follows the pointer. Drawn on one canvas; the loop stops
 * while the tab is hidden and is replaced by a single still frame for
 * reduced-motion visitors.
 */

type Star = { x: number; y: number; z: number; vx: number; vy: number; phase: number };

const STAR_DENSITY = 1 / 9000;
const MAX_STARS = 220;
const LINK_DISTANCE = 110;

function makeStars(width: number, height: number): Star[] {
  const count = Math.min(MAX_STARS, Math.round(width * height * STAR_DENSITY));
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    z: 0.3 + Math.random() * 0.7,
    vx: (Math.random() - 0.5) * 0.06,
    vy: -0.02 - Math.random() * 0.05,
    phase: Math.random() * Math.PI * 2,
  }));
}

export default function ChartBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let width = 0;
    let height = 0;
    let stars: Star[] = [];
    let frame = 0;
    let scroll = window.scrollY;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      stars = makeStars(width, height);
    };

    const draw = (time: number) => {
      context.clearRect(0, 0, width, height);
      const seconds = time / 1000;
      const cx = width * 0.72;
      const cy = height * 0.32 - scroll * 0.08;

      // Great rings of a chart, slowly turning.
      context.save();
      context.translate(cx, cy);
      context.rotate(seconds * 0.01);
      context.strokeStyle = "rgba(212,168,64,0.07)";
      context.lineWidth = 1;
      for (const r of [180, 300, 450, 620, 820]) {
        context.beginPath();
        context.arc(0, 0, r, 0, Math.PI * 2);
        context.stroke();
      }
      context.setLineDash([2, 10]);
      for (let i = 0; i < 12; i += 1) {
        const angle = (i / 12) * Math.PI * 2;
        context.beginPath();
        context.moveTo(Math.cos(angle) * 160, Math.sin(angle) * 160);
        context.lineTo(Math.cos(angle) * 1100, Math.sin(angle) * 1100);
        context.stroke();
      }
      context.restore();

      // Constellation links between near neighbours.
      context.setLineDash([]);
      context.lineWidth = 0.6;
      for (let i = 0; i < stars.length; i += 1) {
        const a = stars[i];
        for (let j = i + 1; j < stars.length; j += 1) {
          const b = stars[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > LINK_DISTANCE * LINK_DISTANCE) continue;
          const alpha = (1 - Math.sqrt(d2) / LINK_DISTANCE) * 0.12 * Math.min(a.z, b.z);
          context.strokeStyle = `rgba(255,211,110,${alpha.toFixed(3)})`;
          context.beginPath();
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
          context.stroke();
        }
      }

      // The dust itself, twinkling.
      for (const star of stars) {
        const twinkle = 0.55 + Math.sin(seconds * 1.3 + star.phase) * 0.45;
        context.fillStyle = `rgba(255,222,150,${(star.z * twinkle * 0.8).toFixed(3)})`;
        context.beginPath();
        context.arc(star.x, star.y, star.z * 1.3, 0, Math.PI * 2);
        context.fill();
      }
    };

    const step = (time: number) => {
      for (const star of stars) {
        star.x += star.vx * star.z * 16;
        star.y += star.vy * star.z * 16;
        if (star.y < -10) star.y = height + 10;
        if (star.x < -10) star.x = width + 10;
        if (star.x > width + 10) star.x = -10;
      }
      draw(time);
      frame = window.requestAnimationFrame(step);
    };

    const onScroll = () => {
      const delta = window.scrollY - scroll;
      scroll = window.scrollY;
      // Parallax: nearer dust drifts further as the page moves.
      for (const star of stars) {
        star.y -= delta * star.z * 0.12;
        if (star.y < -10) star.y += height + 20;
        if (star.y > height + 10) star.y -= height + 20;
      }
      if (reduced) draw(performance.now());
    };

    const onVisibility = () => {
      window.cancelAnimationFrame(frame);
      if (!document.hidden && !reduced) frame = window.requestAnimationFrame(step);
    };

    const onPointer = (event: PointerEvent) => {
      const glow = glowRef.current;
      if (!glow || event.pointerType !== "mouse") return;
      glow.style.transform = `translate3d(${event.clientX - 300}px, ${event.clientY - 300}px, 0)`;
      glow.style.opacity = "1";
    };

    resize();
    if (reduced) draw(0);
    else frame = window.requestAnimationFrame(step);

    window.addEventListener("resize", resize);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reduced]);

  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 640px at 74% 26%, rgba(212,168,64,0.14), transparent 62%), radial-gradient(700px 520px at 8% 92%, rgba(255,122,69,0.06), transparent 60%)",
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div
        ref={glowRef}
        className="absolute left-0 top-0 size-[600px] rounded-full opacity-0 transition-opacity duration-700"
        style={{
          background: "radial-gradient(closest-side, rgba(255,211,110,0.09), transparent)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(7,8,10,0) 0%, rgba(7,8,10,0) 60%, rgba(7,8,10,0.75) 100%)",
        }}
      />
    </div>
  );
}
