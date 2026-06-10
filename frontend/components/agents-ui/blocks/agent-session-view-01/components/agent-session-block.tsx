'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, type MotionProps, motion } from 'motion/react';
import {
  useAgent,
  useRoomContext,
  useSessionContext,
  useSessionMessages,
  useVoiceAssistant,
} from '@livekit/components-react';
import { AgentChatTranscript } from '@/components/agents-ui/agent-chat-transcript';
import {
  AgentControlBar,
  type AgentControlBarControls,
} from '@/components/agents-ui/agent-control-bar';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { SuggestedQuestions } from '@/components/app/suggested-questions';
import { TypewriterText } from '@/components/app/typewriter-text';
import { useAvatarStatus } from '@/lib/digital-human/use-avatar';
import { cn } from '@/lib/shadcn/utils';
import { TileLayout } from './tile-view';

const MotionMessage = motion.create(Shimmer);

const BOTTOM_VIEW_MOTION_PROPS: MotionProps = {
  variants: {
    visible: {
      opacity: 1,
      translateY: '0%',
    },
    hidden: {
      opacity: 0,
      translateY: '100%',
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
  transition: {
    duration: 0.3,
    delay: 0.5,
    ease: 'easeOut',
  },
};

const CHAT_MOTION_PROPS: MotionProps = {
  variants: {
    hidden: {
      opacity: 0,
      transition: {
        ease: 'easeOut',
        duration: 0.3,
      },
    },
    visible: {
      opacity: 1,
      transition: {
        delay: 0.2,
        ease: 'easeOut',
        duration: 0.3,
      },
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
};

const SHIMMER_MOTION_PROPS: MotionProps = {
  variants: {
    visible: {
      opacity: 1,
      transition: {
        ease: 'easeIn',
        duration: 0.5,
        delay: 0.8,
      },
    },
    hidden: {
      opacity: 0,
      transition: {
        ease: 'easeIn',
        duration: 0.5,
        delay: 0,
      },
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
};

interface FadeProps {
  top?: boolean;
  bottom?: boolean;
  className?: string;
}

export function Fade({ top = false, bottom = false, className }: FadeProps) {
  return (
    <div
      className={cn(
        'from-background pointer-events-none h-4 bg-linear-to-b to-transparent',
        top && 'bg-linear-to-b',
        bottom && 'bg-linear-to-t',
        className
      )}
    />
  );
}

export interface AgentSessionView_01Props {
  /**
   * Headline shown above the avatar on the idle/suggestions screen. Hidden once
   * a conversation starts (chat open) so it doesn't overlap the transcript.
   */
  headline?: string;
  /**
   * Message shown above the controls before the first chat message is sent.
   *
   * @default 'Agent is listening, ask it a question'
   */
  preConnectMessage?: string;
  /**
   * Enables or disables the chat toggle and transcript input controls.
   *
   * @default true
   */
  supportsChatInput?: boolean;
  /**
   * Enables or disables camera controls in the bottom control bar.
   *
   * @default true
   */
  supportsVideoInput?: boolean;
  /**
   * Enables or disables screen sharing controls in the bottom control bar.
   *
   * @default true
   */
  supportsScreenShare?: boolean;
  /**
   * Shows a pre-connect buffer state with a shimmer message before messages appear.
   *
   * @default true
   */
  isPreConnectBufferEnabled?: boolean;

  /** Selects the visualizer style rendered in the main tile area. */
  audioVisualizerType?: 'bar' | 'wave' | 'grid' | 'radial' | 'aura';
  /** Primary hex color used by supported audio visualizer variants. */
  audioVisualizerColor?: `#${string}`;
  /** Hue shift intensity used by certain visualizers. */
  audioVisualizerColorShift?: number;
  /** Number of bars to render when `audioVisualizerType` is `bar`. */
  audioVisualizerBarCount?: number;
  /** Number of rows in the visualizer when `audioVisualizerType` is `grid`. */
  audioVisualizerGridRowCount?: number;
  /** Number of columns in the visualizer when `audioVisualizerType` is `grid`. */
  audioVisualizerGridColumnCount?: number;
  /** Number of radial bars when `audioVisualizerType` is `radial`. */
  audioVisualizerRadialBarCount?: number;
  /** Base radius of the radial visualizer when `audioVisualizerType` is `radial`. */
  audioVisualizerRadialRadius?: number;
  /** Stroke width of the wave path when `audioVisualizerType` is `wave`. */
  audioVisualizerWaveLineWidth?: number;
  /** Optional class name merged onto the outer `<section>` container. */
  className?: string;
}

export function AgentSessionView_01({
  headline,
  preConnectMessage = 'Agent is listening, ask it a question',
  supportsChatInput = true,
  supportsVideoInput = true,
  supportsScreenShare = true,
  isPreConnectBufferEnabled = true,

  audioVisualizerType,
  audioVisualizerColor,
  audioVisualizerColorShift,
  audioVisualizerBarCount,
  audioVisualizerGridRowCount,
  audioVisualizerGridColumnCount,
  audioVisualizerRadialBarCount,
  audioVisualizerRadialRadius,
  audioVisualizerWaveLineWidth,
  ref,
  className,
  ...props
}: React.ComponentProps<'section'> & AgentSessionView_01Props) {
  const session = useSessionContext();
  const { messages } = useSessionMessages(session);
  const [chatOpen, setChatOpen] = useState(false);
  // Messages before this timestamp are hidden — set on "end call" so each new
  // conversation starts with a clean transcript.
  const [clearedAt, setClearedAt] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { state: agentState } = useAgent();
  const room = useRoomContext();
  const { agent } = useVoiceAssistant();
  // Hide the suggestions until the avatar has finished loading (show on error
  // too, so a failed avatar doesn't hide them forever).
  const avatarStatus = useAvatarStatus();
  const avatarReady = avatarStatus === 'ready' || avatarStatus === 'error';

  // End call: stop the agent mid-utterance (same "skip" RPC the Skip button
  // uses → session.interrupt), clear the transcript, and return to suggestions.
  const handleEndCall = () => {
    if (agent) {
      void room.localParticipant
        .performRpc({ destinationIdentity: agent.identity, method: 'skip', payload: '' })
        .catch((e) => console.error('[end-call] skip RPC failed:', e));
    }
    setChatOpen(false);
    setClearedAt(Date.now());
  };

  const visibleMessages = useMemo(
    () => messages.filter((m) => new Date(m.timestamp).getTime() > clearedAt),
    [messages, clearedAt]
  );

  const controls: AgentControlBarControls = {
    // "End call" shows only during a conversation (chatOpen); clicking it
    // returns to the suggestions screen (see onDisconnect below).
    leave: chatOpen,
    microphone: true,
    chat: supportsChatInput,
    // Camera and screen share are intentionally disabled for this digital-human UI.
    camera: false,
    screenShare: false,
  };

  useEffect(() => {
    const lastMessage = visibleMessages.at(-1);
    const lastMessageIsLocal = lastMessage?.from?.isLocal === true;

    if (scrollAreaRef.current && lastMessageIsLocal) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [visibleMessages]);

  return (
    <section
      ref={ref}
      className={cn('relative z-10 h-full w-full overflow-hidden', className)}
      {...props}
    >
      <Fade top className="absolute inset-x-4 top-0 z-10 h-40" />
      {/* transcript */}

      <div className="absolute inset-x-0 top-1/2 bottom-[135px] z-40 flex flex-col md:top-0 md:right-0 md:bottom-[170px] md:left-1/2">
        <AnimatePresence>
          {chatOpen && (
            <motion.div
              {...CHAT_MOTION_PROPS}
              className="flex h-full w-full flex-col gap-4 space-y-3 transition-opacity duration-300 ease-out"
            >
              <AgentChatTranscript
                agentState={agentState}
                messages={visibleMessages}
                className="mx-auto w-full max-w-2xl px-2 [&>div>div]:px-4 [&>div>div]:pt-6 md:[&>div>div]:px-6 md:[&>div>div]:pt-16"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Tile layout */}
      <TileLayout
        chatOpen={chatOpen}
        audioVisualizerType={audioVisualizerType}
        audioVisualizerColor={audioVisualizerColor}
        audioVisualizerColorShift={audioVisualizerColorShift}
        audioVisualizerBarCount={audioVisualizerBarCount}
        audioVisualizerRadialBarCount={audioVisualizerRadialBarCount}
        audioVisualizerRadialRadius={audioVisualizerRadialRadius}
        audioVisualizerGridRowCount={audioVisualizerGridRowCount}
        audioVisualizerGridColumnCount={audioVisualizerGridColumnCount}
        audioVisualizerWaveLineWidth={audioVisualizerWaveLineWidth}
      />
      {/* Suggested questions — category tabs + the selected category's
          questions, anchored just above the control deck so the digital human
          stays visible. Hidden while the transcript is open. */}
      {/* Headline above the avatar — only on the idle screen (hidden once a
          conversation starts so it doesn't overlap the transcript). */}
      {!chatOpen && headline && (
        <div className="pointer-events-none fixed inset-x-0 top-[7vh] z-40 flex justify-center px-6 text-center">
          <TypewriterText text={headline} className="max-w-prose" />
        </div>
      )}
      {!chatOpen && avatarReady && (
        <div className="absolute inset-x-3 bottom-28 z-50 flex justify-center md:inset-x-12 md:bottom-36">
          {/* Picking a question switches to the conversation view (transcript +
              end-call) by opening the chat. */}
          <SuggestedQuestions onAsk={() => setChatOpen(true)} />
        </div>
      )}
      {/* Bottom */}
      <motion.div
        {...BOTTOM_VIEW_MOTION_PROPS}
        className="absolute inset-x-3 bottom-0 z-50 md:inset-x-12"
      >
        {/* Pre-connect message */}
        {isPreConnectBufferEnabled && (
          <AnimatePresence>
            {visibleMessages.length === 0 && (
              <MotionMessage
                key="pre-connect-message"
                duration={2}
                aria-hidden={visibleMessages.length > 0}
                {...SHIMMER_MOTION_PROPS}
                className="pointer-events-none mx-auto block w-full max-w-2xl pb-4 text-center text-sm font-semibold"
              >
                {preConnectMessage}
              </MotionMessage>
            )}
          </AnimatePresence>
        )}
        <div className="relative mx-auto max-w-2xl pb-3 md:pb-12">
          <AgentControlBar
            variant="livekit"
            controls={controls}
            isChatOpen={chatOpen}
            isConnected={session.isConnected}
            // "End call" stops the agent (interrupt), clears the transcript, and
            // returns to the suggestions screen. The session stays alive.
            onDisconnect={handleEndCall}
            onIsChatOpenChange={setChatOpen}
          />
        </div>
      </motion.div>
    </section>
  );
}
