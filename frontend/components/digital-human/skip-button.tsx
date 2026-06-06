'use client';

import { useState } from 'react';
import { SkipForwardIcon } from 'lucide-react';
import { useRoomContext, useVoiceAssistant } from '@livekit/components-react';
import { useI18n } from '@/lib/i18n/i18n';
import { cn } from '@/lib/shadcn/utils';

/**
 * Shows a "Skip" pill while the agent is speaking. Clicking it asks the agent to
 * interrupt its current utterance via the "skip" RPC (see the Python agent), which
 * calls session.interrupt(). The audio stops, so lip-sync and gestures stop too.
 */
export function SkipButton({ className }: { className?: string }) {
  const { state, agent } = useVoiceAssistant();
  const room = useRoomContext();
  const { t, dir } = useI18n();
  const [busy, setBusy] = useState(false);

  if (state !== 'speaking' || !agent) return null;

  const onSkip = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await room.localParticipant.performRpc({
        destinationIdentity: agent.identity,
        method: 'skip',
        payload: '',
      });
    } catch (e) {
      console.error('[skip] RPC failed:', e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onSkip}
      disabled={busy}
      aria-label={t.skip}
      className={cn(
        'flex h-9 items-center gap-1.5 rounded-full px-4 font-mono text-xs font-bold tracking-wider uppercase',
        'border border-[#2fe6c0]/40 bg-[rgba(0,0,0,0.55)] text-[#2fe6c0]',
        'shadow-[0_0_10px_-3.6px_#2fe6c0_inset] transition-colors hover:bg-[#2fe6c0]/15',
        'disabled:cursor-not-allowed disabled:opacity-50',
        dir === 'rtl' && 'tracking-normal normal-case',
        className
      )}
    >
      <SkipForwardIcon className="size-3.5" />
      {t.skip}
    </button>
  );
}
