'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { useSessionContext } from '@livekit/components-react';
import { type AppConfig, SUPPORTED_LANGUAGES } from '@/app-config';
import { AgentSessionView_01 } from '@/components/agents-ui/blocks/agent-session-view-01';
import { DesignSwitcher } from '@/components/app/design-switcher';
import { LanguageSelect } from '@/components/app/language-select';
import { DESIGN_ACCENT } from '@/lib/design/design';
import { useDesign } from '@/lib/design/design-context';
import { useI18n } from '@/lib/i18n/i18n';
import { cn } from '@/lib/shadcn/utils';

const MotionSessionView = motion.create(AgentSessionView_01);

const VIEW_MOTION_PROPS = {
  variants: {
    visible: {
      opacity: 1,
    },
    hidden: {
      opacity: 0,
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
  transition: {
    duration: 0.5,
    ease: 'linear',
  },
};

interface ViewControllerProps {
  appConfig: AppConfig;
  selectedStt: string | undefined;
  onSttChange: (id: string) => void;
  selectedTts: string | undefined;
  onTtsChange: (id: string) => void;
  selectedDetector: string | undefined;
  onDetectorChange: (id: string) => void;
  selectedLanguage: string | undefined;
  onLanguageChange: (code: string | undefined) => void;
  isReconnecting: boolean;
  selectedVoice: string | undefined;
  onVoiceChange: (id: string) => void;
  customVoiceId: string;
  onCustomVoiceIdChange: (id: string) => void;
}

export function ViewController({
  appConfig,
  selectedLanguage,
  onLanguageChange,
  isReconnecting,
}: ViewControllerProps) {
  const { start } = useSessionContext();
  const { t, dir } = useI18n();

  // No "Start call" button: connect automatically as soon as the page opens so
  // the avatar loads immediately. The microphone starts OFF — the agent only
  // begins listening once the user taps the mic button. Guarded so it only
  // fires once.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void start({ tracks: { microphone: { enabled: false } } }).catch((err) =>
      console.error('Auto-start failed', err)
    );
  }, [start]);

  // The audio visualizer needs a concrete accent color (not a CSS var); derive
  // it from the active design so it updates live when the theme is switched.
  const { design } = useDesign();
  const visualizerColor = DESIGN_ACCENT[design];

  return (
    <>
      {/* Session view is always mounted, so the avatar starts loading (with its
          own loading animation) the moment the page opens. */}
      <MotionSessionView
        key="session-view"
        {...VIEW_MOTION_PROPS}
        headline={t.welcomeHeadline}
        preConnectMessage={t.agentListening}
        supportsChatInput={appConfig.supportsChatInput}
        supportsVideoInput={appConfig.supportsVideoInput}
        supportsScreenShare={appConfig.supportsScreenShare}
        isPreConnectBufferEnabled={appConfig.isPreConnectBufferEnabled}
        audioVisualizerType={appConfig.audioVisualizerType}
        audioVisualizerColor={visualizerColor}
        audioVisualizerColorShift={appConfig.audioVisualizerColorShift}
        audioVisualizerBarCount={appConfig.audioVisualizerBarCount}
        audioVisualizerGridRowCount={appConfig.audioVisualizerGridRowCount}
        audioVisualizerGridColumnCount={appConfig.audioVisualizerGridColumnCount}
        audioVisualizerRadialBarCount={appConfig.audioVisualizerRadialBarCount}
        audioVisualizerRadialRadius={appConfig.audioVisualizerRadialRadius}
        audioVisualizerWaveLineWidth={appConfig.audioVisualizerWaveLineWidth}
        className="fixed inset-0"
      />

      {/* Top-right controls: theme switcher + language picker. */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <DesignSwitcher />
        <LanguageSelect
          languages={SUPPORTED_LANGUAGES}
          value={selectedLanguage}
          onChange={onLanguageChange}
          disabled={isReconnecting}
        />
      </div>

      {/* Reconnect overlay shown while the session is torn down and re-started
          for the newly selected language. No spinner — a soft pulse. */}
      {isReconnecting && (
        <div className="fixed inset-0 z-60 flex flex-col items-center justify-center gap-4 bg-(--scene-to)/75 backdrop-blur-md">
          <span className="size-2.5 animate-pulse rounded-full bg-(--aqua) shadow-[0_0_16px_var(--aqua)]" />
          <p
            className={cn(
              'font-mono text-xs tracking-widest text-(--aqua) uppercase',
              dir === 'rtl' && 'tracking-normal normal-case'
            )}
          >
            {t.switchingLanguage}
          </p>
        </div>
      )}
    </>
  );
}
