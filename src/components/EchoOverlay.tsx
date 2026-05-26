import React, { useRef, useEffect } from 'react';

interface EchoOverlayProps {
  visPanelRef: React.RefObject<HTMLDivElement>;
  wet: number;       // 0–1: controls number of ghost copies
  delayMs: number;   // controls spatial distance between copies
}

const FEEDBACK = 0.45;
const MAX_COPIES = 5;

export const EchoOverlay: React.FC<EchoOverlayProps> = ({ visPanelRef, wet, delayMs }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const overlay = canvasRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    let rafId = 0;

    const tick = () => {
      const container = visPanelRef.current;
      // Find the p5 canvas — it is the first canvas in the container
      const sources = container?.querySelectorAll('canvas');
      // The first canvas is the p5 scene; the second (if any) is this overlay
      const source = sources && sources.length >= 1 ? (sources[0] as HTMLCanvasElement) : null;

      if (!source || wet < 0.01) {
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        rafId = requestAnimationFrame(tick);
        return;
      }

      const W = source.width;
      const H = source.height;

      if (overlay.width !== W || overlay.height !== H) {
        overlay.width = W;
        overlay.height = H;
      }

      ctx.clearRect(0, 0, W, H);

      const numCopies = Math.max(1, Math.round(wet * MAX_COPIES));

      // Spatial step: delayMs 50→800 maps to 4px→48px per copy step
      const stepPx = 4 + (delayMs / 800) * 44;
      const angle  = Math.PI * 0.25; // 45° diagonal (down-right)
      const stepX  = Math.cos(angle) * stepPx;
      const stepY  = Math.sin(angle) * stepPx;

      // Render from furthest (most faded) to closest (least faded)
      for (let i = numCopies; i >= 1; i--) {
        // Furthest copy (i = numCopies) has lowest opacity
        const opacity = Math.pow(FEEDBACK, i) * wet;
        const dx = i * stepX;
        const dy = i * stepY;
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(source, dx, dy, W, H);
        ctx.restore();
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [visPanelRef, wet, delayMs]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 5 }}
    />
  );
};
