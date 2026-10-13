import { useEffect, useRef } from 'react';
import { hue } from './art';

/**
 * Decorative spider web behind the hero: radial strands plus a few crawlers walking them, each
 * coloured like a real Swarmler. The web leans gently toward the pointer. It draws one still frame
 * under prefers-reduced-motion, pauses when hidden or off screen, and is aria-hidden: nothing on
 * the page depends on it.
 */
export function WebCanvas({ seedIds }: { seedIds: number[] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0;
    let running = false;
    let visible = true;
    let w = 0;
    let h = 0;
    let dpr = 1;
    const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };

    const SPOKES = 14;
    const RINGS = 8;
    // Each crawler walks one ring or spoke, parameterised by t in [0, 1).
    const crawlers = seedIds.slice(0, 6).map((id, i) => ({
      id,
      ring: i % 2 === 0 ? 2 + ((i * 2) % (RINGS - 2)) : -1,
      spoke: i % 2 === 1 ? (i * 5) % SPOKES : -1,
      t: (i * 0.37) % 1,
      speed: 0.00012 + (i % 3) * 0.00005,
      dir: i % 2 === 0 ? 1 : -1,
    }));

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const strandColor = () => getComputedStyle(canvas).getPropertyValue('--web-strand').trim() || 'rgba(242,201,76,0.35)';

    const geometry = () => {
      const cx = w * (w > 720 ? 0.74 : 0.62) + (pointer.x - 0.5) * 18;
      const cy = h * 0.5 + (pointer.y - 0.5) * 12;
      const radius = Math.max(w, h) * (w > 720 ? 0.42 : 0.7);
      return { cx, cy, radius };
    };

    const ringRadius = (ring: number, radius: number) => (radius * (ring + 1)) / RINGS;
    const spokeAngle = (spoke: number) => (spoke / SPOKES) * Math.PI * 2 - Math.PI / 2;
    // A point on ring `ring` at angle a, with a slight inward sag between spokes so strands look spun.
    const pointOn = (ring: number, a: number, cx: number, cy: number, radius: number) => {
      const r = ringRadius(ring, radius);
      const seg = ((a + Math.PI / 2) / (Math.PI * 2)) * SPOKES;
      const sag = 1 - 0.035 * Math.sin((seg % 1) * Math.PI);
      return { x: cx + Math.cos(a) * r * sag, y: cy + Math.sin(a) * r * sag };
    };

    const drawCrawler = (x: number, y: number, c: string, scale: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.strokeStyle = c;
      ctx.fillStyle = c;
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const [x1, y1, x2, y2] of [
        [-3, -2, -11, -9], [-3, 0, -13, -1], [-3, 2, -12, 7], [-2, 4, -8, 12],
        [3, -2, 11, -9], [3, 0, 13, -1], [3, 2, 12, 7], [2, 4, 8, 12],
      ]) {
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 2, 3.5, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -4, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const draw = (dt: number) => {
      ctx.clearRect(0, 0, w, h);
      if (w === 0 || h === 0) return;
      pointer.x += (pointer.tx - pointer.x) * 0.04;
      pointer.y += (pointer.ty - pointer.y) * 0.04;
      const { cx, cy, radius } = geometry();
      ctx.strokeStyle = strandColor();
      ctx.lineWidth = 1;

      // Spokes.
      ctx.beginPath();
      for (let s = 0; s < SPOKES; s++) {
        const a = spokeAngle(s);
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
      }
      ctx.stroke();

      // Rings, sagging between spokes.
      ctx.beginPath();
      for (let r = 0; r < RINGS; r++) {
        const steps = SPOKES * 6;
        for (let i = 0; i <= steps; i++) {
          const a = (i / steps) * Math.PI * 2 - Math.PI / 2;
          const p = pointOn(r, a, cx, cy, radius);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
      }
      ctx.stroke();

      // Crawlers.
      for (const c of crawlers) {
        c.t = (c.t + c.speed * dt * c.dir + 1) % 1;
        let x: number;
        let y: number;
        if (c.ring >= 0) {
          const a = c.t * Math.PI * 2 - Math.PI / 2;
          ({ x, y } = pointOn(c.ring, a, cx, cy, radius));
        } else {
          const a = spokeAngle(c.spoke);
          const r = radius * (0.15 + 0.8 * (c.t < 0.5 ? c.t * 2 : 2 - c.t * 2));
          x = cx + Math.cos(a) * r;
          y = cy + Math.sin(a) * r;
        }
        if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
        drawCrawler(x, y, `hsl(${hue(c.id)},80%,65%)`, 0.9);
      }
    };

    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      draw(dt);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (running || reduce.matches || !visible || document.hidden) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
    };
    const still = () => {
      stop();
      draw(0);
    };

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.tx = (e.clientX - rect.left) / Math.max(1, rect.width);
      pointer.ty = (e.clientY - rect.top) / Math.max(1, rect.height);
    };
    const onLeave = () => {
      pointer.tx = 0.5;
      pointer.ty = 0.5;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    const onMotion = () => (reduce.matches ? still() : start());
    const io = new IntersectionObserver((entries) => {
      visible = entries.some((en) => en.isIntersecting);
      if (visible) start();
      else stop();
    });
    const ro = new ResizeObserver(() => {
      resize();
      if (!running) draw(0);
    });

    resize();
    io.observe(canvas);
    ro.observe(canvas);
    const parent = canvas.parentElement ?? canvas;
    parent.addEventListener('pointermove', onMove);
    parent.addEventListener('pointerleave', onLeave);
    document.addEventListener('visibilitychange', onVisibility);
    reduce.addEventListener('change', onMotion);
    if (reduce.matches) still();
    else start();

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      parent.removeEventListener('pointermove', onMove);
      parent.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      reduce.removeEventListener('change', onMotion);
    };
  }, [seedIds]);

  return <canvas ref={ref} className="web-canvas" aria-hidden="true" />;
}
