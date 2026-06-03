'use client';

import { useState } from 'react';
import { useRoomContext, useVoiceAssistant } from '@livekit/components-react';
import { SkipForwardIcon } from 'lucide-react';
import { cn } from '@/lib/shadcn/utils';

/**
 * Shows a "Skip" pill while the agent is speaking. Clicking it asks the agent to
 * interrupt its current utterance via the "skip" RPC (see the Python agent), which
 * calls session.interrupt(). The audio stops, so lip-sync and gestures stop too.
 */
export function SkipButton({ className }: { className?: string }) {
  const { state, agent } = useVoiceAssistant();
  const room = useRoomContext();
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
      aria-label="Skip"
      title="Skip"
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full text-[#00e5ff]',
        'transition-colors hover:bg-[#00e5ff]/15 hover:text-[#7cf7ff]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
    >
      <SkipForwardIcon className="size-[18px]" />
    </button>
  );
}
