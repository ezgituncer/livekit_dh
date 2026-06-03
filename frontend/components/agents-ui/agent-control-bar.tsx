'use client';

import { type ComponentProps, useRef, useState } from 'react';
import { Track } from 'livekit-client';
import { Loader, MessageSquareTextIcon, SendHorizontal } from 'lucide-react';
import { useChat } from '@livekit/components-react';
import { AgentDisconnectButton } from '@/components/agents-ui/agent-disconnect-button';
import { SkipButton } from '@/components/digital-human/skip-button';
import { AgentTrackControl } from '@/components/agents-ui/agent-track-control';
import {
  AgentTrackToggle,
  agentTrackToggleVariants,
} from '@/components/agents-ui/agent-track-toggle';
import { Toggle } from '@/components/ui/toggle';
import {
  type UseInputControlsProps,
  useInputControls,
  usePublishPermissions,
} from '@/hooks/agents-ui/use-agent-control-bar';
import { cn } from '@/lib/shadcn/utils';

// Cyan-themed control buttons matching the rest of the UI.
// Mic / camera (these toggles default to a destructive "off" look — retheme it to
// a dim neutral so an unused camera/muted mic isn't alarming red). Includes the
// adjacent device-select button via the sibling selector.
const LK_TOGGLE_VARIANT_1 = [
  // inactive / muted → dim neutral
  'data-[state=off]:bg-[rgba(0,0,0,0.4)] data-[state=off]:text-white/50 data-[state=off]:border-[#00e5ff]/15',
  'data-[state=off]:hover:bg-white/5 data-[state=off]:hover:text-white/80',
  'data-[state=off]:focus:text-white/80 data-[state=off]:focus-visible:border-[#00e5ff]/40 data-[state=off]:focus-visible:ring-[#00e5ff]/30',
  'data-[state=off]:[&_~_button]:bg-[rgba(0,0,0,0.4)] data-[state=off]:[&_~_button]:text-white/50 data-[state=off]:[&_~_button]:border-[#00e5ff]/15',
  'data-[state=off]:[&_~_button]:hover:bg-white/5',
  'dark:data-[state=off]:[&_~_button]:bg-[rgba(0,0,0,0.4)] dark:data-[state=off]:[&_~_button]:hover:bg-white/5',
  // active → cyan with neon glow
  'data-[state=on]:bg-[#00e5ff]/18 data-[state=on]:text-[#00e5ff] data-[state=on]:border-[#00e5ff]/45',
  'data-[state=on]:shadow-[0_0_16px_-4px_#00e5ff]',
  'data-[state=on]:hover:bg-[#00e5ff]/25',
  'data-[state=on]:[&_~_button]:bg-[#00e5ff]/18 data-[state=on]:[&_~_button]:text-[#00e5ff]',
  'data-[state=on]:[&_~_button]:hover:bg-[#00e5ff]/25',
];

const LK_TOGGLE_VARIANT_2 = [
  // inactive → dim neutral
  'data-[state=off]:bg-[rgba(0,0,0,0.4)] data-[state=off]:text-white/60 data-[state=off]:border-[#00e5ff]/15',
  'data-[state=off]:hover:bg-white/5 data-[state=off]:hover:text-white/85',
  'data-[state=off]:focus-visible:border-[#00e5ff]/40 data-[state=off]:focus-visible:ring-[#00e5ff]/30',
  // active → cyan with neon glow
  'data-[state=on]:bg-[#00e5ff]/18 data-[state=on]:hover:bg-[#00e5ff]/25',
  'data-[state=on]:shadow-[0_0_16px_-4px_#00e5ff]',
  'data-[state=on]:border-[#00e5ff]/45 data-[state=on]:text-[#00e5ff] data-[state=on]:ring-[#00e5ff]/30',
  'data-[state=on]:focus-visible:border-[#00e5ff]/50',
  'dark:data-[state=on]:bg-[#00e5ff]/18 dark:data-[state=on]:text-[#00e5ff]',
];

interface AgentChatInputProps {
  onSend?: (message: string) => void;
  className?: string;
}

/**
 * Inline chat input: a flush textarea that grows with content plus a circular
 * gradient send button. Always visible inside the single-row control pill.
 */
function AgentChatInput({ onSend = async () => {}, className }: AgentChatInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string>('');
  const isDisabled = isSending || message.trim().length === 0;

  const handleSend = async () => {
    if (isDisabled) {
      return;
    }

    try {
      setIsSending(true);
      await onSend(message.trim());
      setMessage('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={cn('flex flex-1 items-center gap-2', className)}>
      <textarea
        ref={inputRef}
        rows={1}
        value={message}
        disabled={isSending}
        placeholder="Type something…"
        onKeyDown={handleKeyDown}
        onChange={(e) => setMessage(e.target.value)}
        className="field-sizing-content max-h-20 min-h-9 flex-1 resize-none bg-transparent py-2 text-[15px] text-white [scrollbar-width:thin] placeholder:text-white/35 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      />
      <button
        type="button"
        disabled={isDisabled}
        title={isSending ? 'Sending…' : 'Send'}
        onClick={handleSend}
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full transition-colors duration-200',
          isDisabled ? 'text-white/25' : 'text-[#00e5ff] hover:text-[#7cf7ff]'
        )}
      >
        {isSending ? (
          <Loader className="size-[18px] animate-spin" />
        ) : (
          <SendHorizontal className="size-[18px]" />
        )}
      </button>
    </div>
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
   * The visual style of the control bar.
   *
   * @default 'default'
   */
  variant?: 'default' | 'outline' | 'livekit';
  /**
   * This takes an object with the following keys: `leave`, `microphone`, `screenShare`, `camera`,
   * `chat`. Each key maps to a boolean value that determines whether the control is displayed.
   *
   * @default
   * {
   *   leave: true,
   *   microphone: true,
   *   screenShare: true,
   *   camera: true,
   *   chat: true,
   * }
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
 * A control bar specifically designed for voice assistant interfaces. Provides controls for
 * microphone, camera, screen share, chat, and disconnect. Includes an expandable chat input for
 * text-based interaction with the agent.
 *
 * @example
 *
 * ```tsx
 * <AgentControlBar
 *   variant="livekit"
 *   isConnected={true}
 *   onDisconnect={() => handleDisconnect()}
 *   controls={{
 *     microphone: true,
 *     camera: true,
 *     screenShare: false,
 *     chat: true,
 *     leave: true,
 *   }}
 * />;
 * ```
 *
 * @extends ComponentProps<'div'>
 */
export function AgentControlBar({
  variant = 'default',
  controls,
  isChatOpen = false,
  isConnected = false,
  saveUserChoices = true,
  onDisconnect,
  onDeviceError,
  onIsChatOpenChange,
  className,
  ...props
}: AgentControlBarProps & ComponentProps<'div'>) {
  const { send } = useChat();
  const publishPermissions = usePublishPermissions();
  const [isChatOpenUncontrolled, setIsChatOpenUncontrolled] = useState(isChatOpen);
  const {
    cameraToggle,
    microphoneToggle,
    screenShareToggle,
    handleVideoDeviceChange,
    handleCameraDeviceSelectError,
  } = useInputControls({ onDeviceError, saveUserChoices });

  const handleSendMessage = async (message: string) => {
    await send(message);
  };

  const visibleControls = {
    leave: controls?.leave ?? true,
    microphone: controls?.microphone ?? publishPermissions.microphone,
    screenShare: controls?.screenShare ?? publishPermissions.screenShare,
    camera: controls?.camera ?? publishPermissions.camera,
    chat: controls?.chat ?? publishPermissions.data,
  };

  const isEmpty = Object.values(visibleControls).every((value) => !value);

  if (isEmpty) {
    console.warn('AgentControlBar: `visibleControls` contains only false values.');
    return null;
  }

  const isLivekit = variant === 'livekit';

  // Open the transcript when the user sends a message so they can see the reply.
  const handleSend = async (message: string) => {
    await handleSendMessage(message);
    if (!isChatOpen && !isChatOpenUncontrolled) {
      if (!onIsChatOpenChange) setIsChatOpenUncontrolled(true);
      else onIsChatOpenChange(true);
    }
  };

  return (
    <div
      aria-label="Voice assistant controls"
      className={cn(
        isLivekit
          ? 'animated-border rounded-full p-px shadow-[0_0_55px_-14px_rgba(176,38,255,0.55)]'
          : 'bg-background border-input/50 dark:border-muted flex flex-col rounded-lg border p-3 drop-shadow-md/3',
        className
      )}
      {...props}
    >
      <div
        className={cn(
          'flex items-center gap-2',
          isLivekit && 'rounded-full bg-[rgba(7,6,15,0.92)] py-2 pr-2 pl-3 backdrop-blur-xl'
        )}
      >
        {/* Toggle Microphone — plain icon toggle (no level bars / device select) */}
        {visibleControls.microphone && (
          <AgentTrackToggle
            variant={variant === 'outline' ? 'outline' : 'default'}
            aria-label="Toggle microphone"
            source={Track.Source.Microphone}
            pressed={microphoneToggle.enabled}
            disabled={microphoneToggle.pending}
            onPressedChange={microphoneToggle.toggle}
            className={cn(isLivekit && [LK_TOGGLE_VARIANT_2, 'size-10 rounded-full'])}
          />
        )}

        {/* Toggle Camera */}
        {visibleControls.camera && (
          <AgentTrackControl
            variant={variant === 'outline' ? 'outline' : 'default'}
            kind="videoinput"
            aria-label="Toggle camera"
            source={Track.Source.Camera}
            pressed={cameraToggle.enabled}
            pending={cameraToggle.pending}
            disabled={cameraToggle.pending}
            onPressedChange={cameraToggle.toggle}
            onMediaDeviceError={handleCameraDeviceSelectError}
            onActiveDeviceChange={handleVideoDeviceChange}
            className={cn(
              isLivekit && [
                LK_TOGGLE_VARIANT_1,
                'rounded-full [&_button:first-child]:rounded-l-full [&_button:last-child]:rounded-r-full',
              ]
            )}
          />
        )}

        {/* Toggle Screen Share */}
        {visibleControls.screenShare && (
          <AgentTrackToggle
            variant={variant === 'outline' ? 'outline' : 'default'}
            aria-label="Toggle screen share"
            source={Track.Source.ScreenShare}
            pressed={screenShareToggle.enabled}
            disabled={screenShareToggle.pending}
            onPressedChange={screenShareToggle.toggle}
            className={cn(isLivekit && [LK_TOGGLE_VARIANT_2, 'rounded-full'])}
          />
        )}

        {/* Inline chat input — always visible, grows to fill the row. */}
        {visibleControls.chat ? (
          <AgentChatInput onSend={handleSend} />
        ) : (
          <div className="flex-1" />
        )}

        {/* Toggle Transcript */}
        {visibleControls.chat && (
          <Toggle
            variant={variant === 'outline' ? 'outline' : 'default'}
            pressed={isChatOpen || isChatOpenUncontrolled}
            aria-label="Toggle transcript"
            onPressedChange={(state) => {
              if (!onIsChatOpenChange) setIsChatOpenUncontrolled(state);
              else onIsChatOpenChange(state);
            }}
            className={agentTrackToggleVariants({
              variant: variant === 'outline' ? 'outline' : 'default',
              className: cn(isLivekit && [LK_TOGGLE_VARIANT_2, 'size-10 rounded-full']),
            })}
          >
            <MessageSquareTextIcon />
          </Toggle>
        )}

        {/* Skip — interrupts the agent while it is speaking */}
        <SkipButton />

        {/* Divider + Disconnect (icon only) */}
        {visibleControls.leave && (
          <>
            {isLivekit && <div className="mx-0.5 h-7 w-px bg-white/10" />}
            <AgentDisconnectButton
              size="icon"
              onClick={onDisconnect}
              disabled={!isConnected}
              aria-label="End call"
              className={cn(
                isLivekit &&
                  'size-11 rounded-full border border-[#ff2d55]/40 bg-[#ff2d55]/10 text-[#ff5c79] shadow-[0_0_16px_-6px_#ff2d55] transition-all duration-300 hover:bg-[#ff2d55]/20 hover:text-[#ff5c79] hover:shadow-[0_0_26px_-4px_#ff2d55] [&_svg]:size-[18px]'
              )}
            />
          </>
        )}
      </div>
    </div>
  );
}
