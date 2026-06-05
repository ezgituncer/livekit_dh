'use client';

import { type ComponentProps, useEffect, useState } from 'react';
import { Track } from 'livekit-client';
import {
  Loader,
  MessageSquareTextIcon,
  MicOffIcon,
  PhoneOffIcon,
  SendHorizontal,
} from 'lucide-react';
import { type TrackReference, useChat, useMultibandTrackVolume } from '@livekit/components-react';
import { SkipButton } from '@/components/digital-human/skip-button';
import {
  type UseInputControlsProps,
  useInputControls,
  usePublishPermissions,
} from '@/hooks/agents-ui/use-agent-control-bar';
import { cn } from '@/lib/shadcn/utils';

// Shared shapes for the single-row "deck": circular action buttons and pill chips.
const CIRCLE = 'grid size-11 flex-none place-items-center rounded-full transition-colors';
const CHIP =
  'grid size-9 flex-none place-items-center rounded-full text-white/55 transition-colors hover:bg-white/8 hover:text-white';

/**
 * Live microphone-level indicator. The four equalizer bars track the mic's
 * real audio across frequency bands, so they only move while sound is coming
 * in and stay flat during silence. Pulsing rings appear only while the user is
 * actually speaking (level above a small threshold).
 */
function MicLevelBars({ trackRef }: { trackRef?: TrackReference }) {
  const bands = useMultibandTrackVolume(trackRef, { bands: 4, updateInterval: 100 });
  const level = bands.length ? Math.max(...bands) : 0;
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (level > 0.06) {
      setSpeaking(true);
      return;
    }
    // Linger briefly so the rings don't flicker between syllables.
    const t = setTimeout(() => setSpeaking(false), 280);
    return () => clearTimeout(t);
  }, [level]);

  return (
    <>
      {speaking && (
        <>
          <span className="mic-ring" aria-hidden="true" />
          <span className="mic-ring delayed" aria-hidden="true" />
        </>
      )}
      <span className="mic-eq" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => {
          const v = bands[i] ?? 0;
          // Map the band magnitude to a 4–18px bar height (clamped).
          const height = 4 + Math.min(14, v * 48);
          return <i key={i} style={{ height: `${height}px` }} />;
        })}
      </span>
    </>
  );
}

/** Configuration for which controls to display in the AgentControlBar. */
export interface AgentControlBarControls {
  /**
   * Whether to show the leave/disconnect button.
   *
   * @defaultValue true
   */
  leave?: boolean;
  /**
   * Whether to show the camera toggle control.
   *
   * @defaultValue true (if camera publish permission is granted)
   */
  camera?: boolean;
  /**
   * Whether to show the microphone toggle control.
   *
   * @defaultValue true (if microphone publish permission is granted)
   */
  microphone?: boolean;
  /**
   * Whether to show the screen share toggle control.
   *
   * @defaultValue true (if screen share publish permission is granted)
   */
  screenShare?: boolean;
  /**
   * Whether to show the chat toggle control.
   *
   * @defaultValue true (if data publish permission is granted)
   */
  chat?: boolean;
}

export interface AgentControlBarProps extends UseInputControlsProps {
  /**
   * The visual style of the control bar. Kept for API compatibility; the bar
   * always renders as a single-row glass "deck".
   *
   * @default 'default'
   */
  variant?: 'default' | 'outline' | 'livekit';
  /**
   * This takes an object with the following keys: `leave`, `microphone`, `screenShare`, `camera`,
   * `chat`. Each key maps to a boolean value that determines whether the control is displayed.
   */
  controls?: AgentControlBarControls;
  /**
   * Whether to save user choices.
   *
   * @default true
   */
  saveUserChoices?: boolean;
  /**
   * Whether the agent is connected to a session.
   *
   * @default false
   */
  isConnected?: boolean;
  /**
   * Whether the chat input interface is open.
   *
   * @default false
   */
  isChatOpen?: boolean;
  /** The callback for when the user disconnects. */
  onDisconnect?: () => void;
  /** The callback for when the chat is opened or closed. */
  onIsChatOpenChange?: (open: boolean) => void;
  /** The callback for when a device error occurs. */
  onDeviceError?: (error: { source: Track.Source; error: Error }) => void;
}

/**
 * A compact, single-row control "deck" for the voice-assistant UI: a microphone
 * toggle, an inline text field, a transcript toggle, a send button and a
 * disconnect button — all on one line inside a glass pill.
 *
 * @example
 *
 * ```tsx
 * <AgentControlBar
 *   isConnected={true}
 *   onDisconnect={() => handleDisconnect()}
 *   controls={{ microphone: true, chat: true, leave: true }}
 * />;
 * ```
 */
export function AgentControlBar({
  controls,
  isChatOpen = false,
  isConnected = false,
  saveUserChoices = true,
  onDisconnect,
  onDeviceError,
  onIsChatOpenChange,
  className,
  variant: _variant,
  ...props
}: AgentControlBarProps & ComponentProps<'div'>) {
  const { send } = useChat();
  const publishPermissions = usePublishPermissions();
  const [isChatOpenUncontrolled, setIsChatOpenUncontrolled] = useState(isChatOpen);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { microphoneToggle, microphoneTrack } = useInputControls({
    onDeviceError,
    saveUserChoices,
  });

  const visibleControls = {
    leave: controls?.leave ?? true,
    microphone: controls?.microphone ?? publishPermissions.microphone,
    chat: controls?.chat ?? publishPermissions.data,
  };

  const chatOpen = onIsChatOpenChange ? isChatOpen : isChatOpenUncontrolled;
  const micOn = microphoneToggle.enabled;
  const canSend = message.trim().length > 0 && !isSending;

  const handleSend = async () => {
    if (!canSend) return;
    try {
      setIsSending(true);
      await send(message.trim());
      setMessage('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleChat = () => {
    if (onIsChatOpenChange) onIsChatOpenChange(!isChatOpen);
    else setIsChatOpenUncontrolled((v) => !v);
  };

  return (
    <div
      aria-label="Voice assistant controls"
      className={cn('deck-glow flex items-center gap-2 rounded-full border p-2', className)}
      {...props}
    >
      {/* Microphone */}
      {visibleControls.microphone && (
        <button
          type="button"
          aria-label="Toggle microphone"
          title={micOn ? 'Mute microphone' : 'Unmute microphone'}
          disabled={microphoneToggle.pending}
          onClick={() => microphoneToggle.toggle()}
          className={cn(
            CIRCLE,
            'relative',
            micOn
              ? 'border border-[#2fe6c0]/45 bg-[#2fe6c0]/20 text-[#2fe6c0] shadow-[0_0_18px_rgba(47,230,192,0.35)] hover:bg-[#2fe6c0]/28'
              : 'border border-[#2fe6c0]/15 bg-black/30 text-white/55 hover:bg-white/8 hover:text-white/85'
          )}
        >
          {microphoneToggle.pending ? (
            <Loader className="size-[18px] animate-spin" />
          ) : micOn ? (
            // Equalizer bars driven by the live mic level — they move while
            // sound comes in and stay flat during silence.
            <MicLevelBars trackRef={microphoneTrack} />
          ) : (
            <MicOffIcon className="size-[18px]" />
          )}
        </button>
      )}

      {/* Inline text field */}
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message or tap the mic to speak…"
        autoComplete="off"
        className="font-chakra min-w-0 flex-1 bg-transparent px-1 text-[15px] text-white placeholder:text-white/40 focus:outline-none"
      />

      {/* Skip — only visible while the agent is speaking */}
      <SkipButton className="h-8 px-3 text-[11px]" />

      {/* Transcript toggle */}
      {visibleControls.chat && (
        <button
          type="button"
          aria-label="Toggle transcript"
          title="Transcript"
          onClick={toggleChat}
          className={cn(CHIP, chatOpen && 'bg-[#2fe6c0]/15 text-[#2fe6c0] hover:bg-[#2fe6c0]/22')}
        >
          <MessageSquareTextIcon className="size-[18px]" />
        </button>
      )}

      {/* Send */}
      <button
        type="button"
        aria-label="Send message"
        title={isSending ? 'Sending…' : 'Send'}
        disabled={!canSend}
        onClick={handleSend}
        className={cn(
          CIRCLE,
          'bg-gradient-to-br from-[#7dffe0] via-[#2fe6c0] to-[#22d3ee] text-[#04221d]',
          'shadow-[0_4px_16px_rgba(47,230,192,0.35)] hover:brightness-110 active:scale-95',
          'disabled:cursor-not-allowed disabled:opacity-35 disabled:shadow-none disabled:hover:brightness-100'
        )}
      >
        {isSending ? (
          <Loader className="size-[18px] animate-spin" />
        ) : (
          <SendHorizontal className="size-[18px]" />
        )}
      </button>

      {/* Disconnect */}
      {visibleControls.leave && (
        <>
          <span className="mx-0.5 h-7 w-px flex-none bg-[rgba(94,234,212,0.18)]" />
          <button
            type="button"
            aria-label="End call"
            title="End call"
            disabled={!isConnected}
            onClick={onDisconnect}
            className={cn(
              CIRCLE,
              'border border-[#ff6b7a]/35 bg-[#ff6b7a]/10 text-[#ff6b7a] hover:bg-[#ff6b7a]/22 hover:shadow-[0_0_18px_rgba(255,107,122,0.3)]',
              'disabled:cursor-not-allowed disabled:opacity-40'
            )}
          >
            <PhoneOffIcon className="size-[18px]" />
          </button>
        </>
      )}
    </div>
  );
}
