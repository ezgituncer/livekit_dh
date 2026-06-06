'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '@livekit/components-react';
import { WarningIcon } from '@phosphor-icons/react/dist/ssr';
import { type AppConfig, DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from '@/app-config';
import { AgentSessionProvider } from '@/components/agents-ui/agent-session-provider';
import { StartAudioButton } from '@/components/agents-ui/start-audio-button';
import { ViewController } from '@/components/app/view-controller';
import { Toaster } from '@/components/ui/sonner';
import { useAgentErrors } from '@/hooks/useAgentErrors';
import { useDebugMode } from '@/hooks/useDebug';
import { loadAdvancedSettings, loadAdvancedTurnHandlingSettings } from '@/lib/advanced-settings';
import { I18nProvider } from '@/lib/i18n/i18n';
import { getDir, tFor } from '@/lib/i18n/translations';
import { getAgentTokenSource, getSandboxTokenSource } from '@/lib/utils';

const LANGUAGE_STORAGE_KEY = 'voice-agent.language';
const SUPPORTED_LANGUAGE_CODES = new Set(SUPPORTED_LANGUAGES.map((l) => l.code));

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
  // True while we tear down and re-establish the session after an in-call
  // language change, so the view can show a "switching" overlay instead of
  // flashing back to the welcome screen.
  const [isReconnecting, setIsReconnecting] = useState(false);

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

  // Restore the last chosen UI/conversation language on mount (client-only, so
  // it can't cause a hydration mismatch — we start from DEFAULT_LANGUAGE and
  // adopt the stored value after the first paint).
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (stored && SUPPORTED_LANGUAGE_CODES.has(stored)) {
        languageRef.current = stored;
        setSelectedLanguage(stored);
      }
    } catch {
      // localStorage unavailable (private mode / SSR) — keep the default.
    }
  }, []);

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

  // The conversation language is baked into the participant token at connect
  // time and the realtime model can't swap languages on a live session, so an
  // in-call change reconnects: end the current session and start a fresh one,
  // which re-fetches a token carrying the new language.
  const handleLanguageChange = useCallback(
    (code: string | undefined) => {
      if (code === languageRef.current) return;
      languageRef.current = code;
      setSelectedLanguage(code);
      try {
        if (code) window.localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
      } catch {
        // Ignore persistence failures (private mode, etc.).
      }
      if (!session.isConnected) return;
      setIsReconnecting(true);
      void (async () => {
        try {
          await session.end();
          await session.start();
        } catch (err) {
          console.error('Failed to reconnect after language change', err);
        } finally {
          setIsReconnecting(false);
        }
      })();
    },
    [session]
  );

  return (
    <I18nProvider lang={selectedLanguage}>
      <AgentSessionProvider session={session}>
        <AppSetup />
        <main
          dir={getDir(selectedLanguage)}
          lang={selectedLanguage}
          className="grid h-svh grid-cols-1 place-content-center"
        >
          <ViewController
            appConfig={appConfig}
            selectedStt={selectedStt}
            onSttChange={setSelectedStt}
            selectedTts={selectedTts}
            onTtsChange={setSelectedTts}
            selectedDetector={selectedDetector}
            onDetectorChange={setSelectedDetector}
            selectedLanguage={selectedLanguage}
            onLanguageChange={handleLanguageChange}
            isReconnecting={isReconnecting}
            selectedVoice={selectedVoice}
            onVoiceChange={setSelectedVoice}
            customVoiceId={customVoiceId}
            onCustomVoiceIdChange={setCustomVoiceId}
          />
        </main>
        <StartAudioButton label={tFor(selectedLanguage).startAudio} />
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
    </I18nProvider>
  );
}
