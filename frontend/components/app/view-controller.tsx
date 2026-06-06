'use client';

import { useTheme } from 'next-themes';
import { AnimatePresence, motion } from 'motion/react';
import { useSessionContext } from '@livekit/components-react';
import { type AppConfig, SUPPORTED_LANGUAGES } from '@/app-config';
import { AgentSessionView_01 } from '@/components/agents-ui/blocks/agent-session-view-01';
import { LanguageSelect } from '@/components/app/language-select';
import { WelcomeView } from '@/components/app/welcome-view';
import { useI18n } from '@/lib/i18n/i18n';
import { cn } from '@/lib/shadcn/utils';

const MotionWelcomeView = motion.create(WelcomeView);
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
  selectedStt,
  onSttChange,
  selectedTts,
  onTtsChange,
  selectedDetector,
  onDetectorChange,
  selectedLanguage,
  onLanguageChange,
  isReconnecting,
  selectedVoice,
  onVoiceChange,
  customVoiceId,
  onCustomVoiceIdChange,
}: ViewControllerProps) {
  const { isConnected, start } = useSessionContext();
  const { resolvedTheme } = useTheme();
  const { t, dir } = useI18n();

  // Keep the session view mounted while reconnecting (after an in-call language
  // change) so the UI doesn't flash back to the welcome screen.
  const showSession = isConnected || isReconnecting;

  return (
    <>
      <AnimatePresence mode="wait">
        {/* Welcome view */}
        {!showSession && (
          <MotionWelcomeView
            key="welcome"
            {...VIEW_MOTION_PROPS}
            startButtonText={appConfig.startButtonText}
            onStartCall={start}
            stts={appConfig.stts}
            selectedStt={selectedStt}
            onSttChange={onSttChange}
            ttss={appConfig.ttss}
            selectedTts={selectedTts}
            onTtsChange={onTtsChange}
            detectors={appConfig.detectors}
            selectedDetector={selectedDetector}
            onDetectorChange={onDetectorChange}
            languages={SUPPORTED_LANGUAGES}
            selectedLanguage={selectedLanguage}
            onLanguageChange={onLanguageChange}
            voices={appConfig.voices}
            selectedVoice={selectedVoice}
            onVoiceChange={onVoiceChange}
            customVoiceId={customVoiceId}
            onCustomVoiceIdChange={onCustomVoiceIdChange}
          />
        )}
        {/* Session view */}
        {showSession && (
          <MotionSessionView
            key="session-view"
            {...VIEW_MOTION_PROPS}
            preConnectMessage={t.agentListening}
            supportsChatInput={appConfig.supportsChatInput}
            supportsVideoInput={appConfig.supportsVideoInput}
            supportsScreenShare={appConfig.supportsScreenShare}
            isPreConnectBufferEnabled={appConfig.isPreConnectBufferEnabled}
            audioVisualizerType={appConfig.audioVisualizerType}
            audioVisualizerColor={
              resolvedTheme === 'dark'
                ? appConfig.audioVisualizerColorDark
                : appConfig.audioVisualizerColor
            }
            audioVisualizerColorShift={appConfig.audioVisualizerColorShift}
            audioVisualizerBarCount={appConfig.audioVisualizerBarCount}
            audioVisualizerGridRowCount={appConfig.audioVisualizerGridRowCount}
            audioVisualizerGridColumnCount={appConfig.audioVisualizerGridColumnCount}
            audioVisualizerRadialBarCount={appConfig.audioVisualizerRadialBarCount}
            audioVisualizerRadialRadius={appConfig.audioVisualizerRadialRadius}
            audioVisualizerWaveLineWidth={appConfig.audioVisualizerWaveLineWidth}
            className="fixed inset-0"
          />
        )}
      </AnimatePresence>

      {/* In-call language picker — lives on the avatar/session screen. Changing
          it reconnects the session with the new language. */}
      {showSession && (
        <div className="fixed top-4 right-4 z-50">
          <LanguageSelect
            languages={SUPPORTED_LANGUAGES}
            value={selectedLanguage}
            onChange={onLanguageChange}
            disabled={isReconnecting}
          />
        </div>
      )}

      {/* Reconnect overlay shown while the session is torn down and re-started
          for the newly selected language. No spinner — a soft pulse. */}
      {isReconnecting && (
        <div className="fixed inset-0 z-60 flex flex-col items-center justify-center gap-4 bg-[rgb(1,6,5)]/70 backdrop-blur-md">
          <span className="size-2.5 animate-pulse rounded-full bg-[#2fe6c0] shadow-[0_0_16px_#2fe6c0]" />
          <p
            className={cn(
              'font-mono text-xs tracking-widest text-[#7dffe0] uppercase',
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
