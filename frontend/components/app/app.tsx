'use client';

import { useMemo, useRef, useState } from 'react';
import { useSession } from '@livekit/components-react';
import { WarningIcon } from '@phosphor-icons/react/dist/ssr';
import { DEFAULT_LANGUAGE, type AppConfig } from '@/app-config';
import { AgentSessionProvider } from '@/components/agents-ui/agent-session-provider';
import { StartAudioButton } from '@/components/agents-ui/start-audio-button';
import { ViewController } from '@/components/app/view-controller';
import { Toaster } from '@/components/ui/sonner';
import { useAgentErrors } from '@/hooks/useAgentErrors';
import { useDebugMode } from '@/hooks/useDebug';
import {
  loadAdvancedSettings,
  loadAdvancedTurnHandlingSettings,
} from '@/lib/advanced-settings';
import { getAgentTokenSource, getSandboxTokenSource } from '@/lib/utils';

const IN_DEVELOPMENT = process.env.NODE_ENV !== 'production';

function AppSetup() {
  useDebugMode({ enabled: IN_DEVELOPMENT });
  useAgentErrors();

  return null;
}

interface AppProps {
  appConfig: AppConfig;
}

export function App({ appConfig }: AppProps) {
  const [selectedStt, setSelectedStt] = useState<string | undefined>(appConfig.stts[0]?.id);
  const [selectedTts, setSelectedTts] = useState<string | undefined>(appConfig.ttss[0]?.id);
  const [selectedDetector, setSelectedDetector] = useState<string | undefined>(
    appConfig.detectors[0]?.id
  );
  const [selectedLanguage, setSelectedLanguage] = useState<string | undefined>(DEFAULT_LANGUAGE);
  const [selectedVoice, setSelectedVoice] = useState<string | undefined>(appConfig.voices[0]?.id);
  const [customVoiceId, setCustomVoiceId] = useState<string>('');

  // Keep refs so the (memoized) token source reads the latest selection without
  // being recreated — recreating it would reset the session.
  const sttRef = useRef(selectedStt);
  sttRef.current = selectedStt;
  const ttsRef = useRef(selectedTts);
  ttsRef.current = selectedTts;
  const detectorRef = useRef(selectedDetector);
  detectorRef.current = selectedDetector;
  const languageRef = useRef(selectedLanguage);
  languageRef.current = selectedLanguage;
  const voiceRef = useRef(selectedVoice);
  voiceRef.current = selectedVoice;
  const customVoiceRef = useRef(customVoiceId);
  customVoiceRef.current = customVoiceId;

  const tokenSource = useMemo(() => {
    const getSelection = () => {
      const stt = appConfig.stts.find((s) => s.id === sttRef.current);
      const voiceId =
        voiceRef.current === '__custom__'
          ? customVoiceRef.current.trim() || undefined
          : voiceRef.current;
      // Advanced VAD knobs are only meaningful for the realtime ElevenLabs STT.
      const serverVad =
        sttRef.current === 'elevenlabs-scribe-v2-realtime' ? loadAdvancedSettings() : undefined;
      // Turn handling applies to every session.
      const turnHandling = loadAdvancedTurnHandlingSettings();
      return {
        agentName: appConfig.agentName,
        stt: sttRef.current,
        tts: ttsRef.current,
        detector: detectorRef.current,
        // Only send language when the selected STT can use it. TTS will fall
        // back to "en" on the agent side if this is undefined.
        language: stt?.supportsLanguage ? languageRef.current : undefined,
        voiceId,
        serverVad,
        turnHandling,
      };
    };
    return typeof process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT === 'string'
      ? getSandboxTokenSource(appConfig, getSelection)
      : getAgentTokenSource(getSelection);
  }, [appConfig]);

  const session = useSession(tokenSource);

  return (
    <AgentSessionProvider session={session}>
      <AppSetup />
      <main className="grid h-svh grid-cols-1 place-content-center">
        <ViewController
          appConfig={appConfig}
          selectedStt={selectedStt}
          onSttChange={setSelectedStt}
          selectedTts={selectedTts}
          onTtsChange={setSelectedTts}
          selectedDetector={selectedDetector}
          onDetectorChange={setSelectedDetector}
          selectedLanguage={selectedLanguage}
          onLanguageChange={setSelectedLanguage}
          selectedVoice={selectedVoice}
          onVoiceChange={setSelectedVoice}
          customVoiceId={customVoiceId}
          onCustomVoiceIdChange={setCustomVoiceId}
        />
      </main>
      <StartAudioButton label="Start Audio" />
      <Toaster
        icons={{
          warning: <WarningIcon weight="bold" />,
        }}
        position="top-center"
        className="toaster group"
        style={
          {
            '--normal-bg': 'var(--popover)',
            '--normal-text': 'var(--popover-foreground)',
            '--normal-border': 'var(--border)',
          } as React.CSSProperties
        }
      />
    </AgentSessionProvider>
  );
}
