'use client';

import { DESIGN_META } from '@/lib/design/design';
import { useDesign } from '@/lib/design/design-context';
import { cn } from '@/lib/shadcn/utils';

/**
 * Runtime theme switcher: one color swatch per design. Clicking a swatch
 * switches the whole UI palette (persisted), overriding the env default.
 */
export function DesignSwitcher({ className }: { className?: string }) {
  const { design, setDesign, designs } = useDesign();

  return (
    <div
      role="group"
      aria-label="Theme"
      className={cn(
        'flex items-center gap-2 rounded-full border border-(--glass-line) bg-(--surface)/55 px-2.5 py-2 backdrop-blur-md',
        className
      )}
    >
      {designs.map((d) => {
        const isActive = d === design;
        const { label, swatch } = DESIGN_META[d];
        return (
          <button
            key={d}
            type="button"
            onClick={() => setDesign(d)}
            aria-label={label}
            aria-pressed={isActive}
            title={label}
            className={cn(
              'size-5 rounded-full ring-2 ring-offset-1 ring-offset-transparent transition-transform',
              isActive
                ? 'scale-110 ring-(--aqua)'
                : 'ring-white/20 hover:scale-105 hover:ring-white/45'
            )}
            style={{ backgroundColor: swatch }}
          />
        );
      })}
    </div>
  );
}
