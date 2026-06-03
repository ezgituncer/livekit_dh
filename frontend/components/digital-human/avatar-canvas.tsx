'use client';

import { useEffect, useReducer, useRef } from 'react';
import { type AvatarSingleton, getAvatarSingleton } from '@/lib/digital-human/use-avatar';
import { cn } from '@/lib/shadcn/utils';

export interface AvatarCanvasProps {
  className?: string;
}

/**
 * Renders the FaceUnity (FURenderKit) 3D avatar.
 *
 * The actual <canvas> and WebGL renderer are a module-level singleton (see
 * use-avatar.ts); this component just attaches that canvas into its container
 * and reflects the load status. Idle (breathing) animation plays once ready.
 * Lip-sync is wired up in a later phase.
 */
export function AvatarCanvas({ className }: AvatarCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const singletonRef = useRef<AvatarSingleton | null>(null);
  const [, force] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const s = getAvatarSingleton();
    singletonRef.current = s;

    const container = containerRef.current;
    if (container && s.canvas.parentElement !== container) {
      container.appendChild(s.canvas);
    }

    s.listeners.add(force);
    force();

    return () => {
      s.listeners.delete(force);
      // Intentionally keep the singleton (and its canvas) alive across unmounts.
    };
  }, []);

  const status = singletonRef.current?.status ?? 'loading';
  const error = singletonRef.current?.error ?? null;

  return (
    <div ref={containerRef} className={cn('relative h-full w-full overflow-hidden', className)}>
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
          {/* Neon HUD spinner: a dim track, a spinning cyan/purple arc, and a pulsing core. */}
          <div className="relative size-16">
            <span className="absolute inset-0 rounded-full border-2 border-[#00e5ff]/15" />
            <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[#00e5ff] border-r-[#b026ff] [animation-duration:0.9s] drop-shadow-[0_0_10px_#00e5ff]" />
            <span className="absolute inset-[30%] rounded-full bg-[#00e5ff]/20 blur-[1px] glow-pulse" />
          </div>
          <span className="neon-text animate-pulse font-mono text-[11px] tracking-[0.32em] text-[#7cf7ff]/85 uppercase">
            Loading avatar
          </span>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center p-4 text-center font-mono text-sm tracking-wide text-[#ff2d55] drop-shadow-[0_0_10px_rgba(255,45,85,0.6)]">
          Avatar failed to load: {error}
        </div>
      )}
    </div>
  );
}
