import { useEffect, useRef } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import "./HoloCardPreview.css";

type HoloCardPreviewProps = {
  src: string;
  alt: string;
  glowColor?: string;
  onClick?: () => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function HoloCardPreview({ src, alt, glowColor = "#d9b35e", onClick }: HoloCardPreviewProps) {
  const cardRef = useRef<HTMLButtonElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<{ x: number; y: number } | null>(null);

  const applyPointer = (x: number, y: number) => {
    const el = cardRef.current;
    if (!el) return;

    const cx = (x - 50) / 50;
    const cy = (y - 50) / 50;
    const distance = clamp(Math.hypot(cx, cy), 0, 1);

    el.style.setProperty("--holo-pointer-x", `${x}%`);
    el.style.setProperty("--holo-pointer-y", `${y}%`);
    el.style.setProperty("--holo-rotate-x", `${-cy * 5}deg`);
    el.style.setProperty("--holo-rotate-y", `${cx * 6}deg`);
    el.style.setProperty("--holo-bg-x", `${50 - cx * 10}%`);
    el.style.setProperty("--holo-bg-y", `${50 - cy * 12}%`);
    el.style.setProperty("--holo-distance", distance.toFixed(3));
    el.style.setProperty("--holo-opacity", "1");
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
    const y = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100);

    pendingRef.current = { x, y };
    if (rafRef.current != null) return;

    rafRef.current = requestAnimationFrame(() => {
      if (pendingRef.current) applyPointer(pendingRef.current.x, pendingRef.current.y);
      pendingRef.current = null;
      rafRef.current = null;
    });
  };

  const reset = () => {
    const el = cardRef.current;
    if (!el) return;
    el.style.setProperty("--holo-pointer-x", "50%");
    el.style.setProperty("--holo-pointer-y", "50%");
    el.style.setProperty("--holo-rotate-x", "0deg");
    el.style.setProperty("--holo-rotate-y", "0deg");
    el.style.setProperty("--holo-bg-x", "50%");
    el.style.setProperty("--holo-bg-y", "50%");
    el.style.setProperty("--holo-distance", "0");
    el.style.setProperty("--holo-opacity", "0.18");
  };

  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div
      className="holo-card-preview"
      style={{ "--holo-glow": glowColor } as CSSProperties}
    >
      <button
        ref={cardRef}
        type="button"
        className="holo-card-preview__tilt"
        aria-label={`${alt} · 点击查看原图`}
        onPointerMove={onPointerMove}
        onPointerLeave={reset}
        onPointerCancel={reset}
        onBlur={reset}
        onClick={onClick}
      >
        <span className="holo-card-preview__face">
          <img className="holo-card-preview__image" src={src} alt={alt} draggable={false} />
          <span className="holo-card-preview__shine" aria-hidden="true" />
          <span className="holo-card-preview__glare" aria-hidden="true" />
        </span>
      </button>
    </div>
  );
}
