'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/shadcn/utils';

interface TypewriterTextProps {
  /** The full text to stream out, one character at a time. */
  text: string;
  /** Per-character delay in ms. */
  speed?: number;
  className?: string;
}

/**
 * Streams text out character-by-character (terminal/typewriter style) with a
 * blinking caret — used for the landing headline to give it a "live" feel.
 */
export function TypewriterText({ text, speed = 45, className }: TypewriterTextProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setCount(i);
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);

  return (
    <span className={cn('welcome-headline inline-block', className)}>
      {text.slice(0, count)}
      <span className="typed-caret" aria-hidden="true">
        ▍
      </span>
    </span>
  );
}
