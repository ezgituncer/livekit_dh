'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSession } from '@livekit/components-react';
import { Room } from 'livekit-client';
import { WarningIcon } from '@phosphor-icons/react/dist/ssr';
import { type AppConfig, DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from '@/app-config';
import { AgentSessionProvider } from '@/components/agents-ui/agent-session-provider';
import { StartAudioButton } from '@/components/agents-ui/start-audio-button';
import { Toaster } from '@/components/ui/sonner';
import { useAgentErrors } from '@/hooks/useAgentErrors';
import { useDebugMode } from '@/hooks/useDebug';
import { I18nProvider } from '@/lib/i18n/i18n';
import { getDir, tFor } from '@/lib/i18n/translations';
import { getAgentTokenSource, getSandboxTokenSource } from '@/lib/utils';

// The in-call view depends on a live LiveKit room and Radix components whose
// useId-based ids can't match between SSR and the client, so render it
// client-only (no SSR) to avoid hydration mismatches.
const ViewController = dynamic(
  () => import('@/components/app/view-controller').then((m) => m.ViewController),
  { ssr: false }
);

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
  const [selectedLanguage, setSelectedLanguage] = useState<string | undefined>(DEFAULT_LANGUAGE);
  // True while we tear down and re-establish the session after an in-call
  // language change, so the view can show a "switching" overlay instead of
  // flashing back to the welcome screen.
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Keep a ref so the (memoized) token source reads the latest selection without
  // being recreated — recreating it would reset the session.
  const languageRef = useRef(selectedLanguage);
  languageRef.current = selectedLanguage;

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
      return {
        agentName: appConfig.agentName,
        language: languageRef.current,
      };
    };
    return typeof process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT === 'string'
      ? getSandboxTokenSource(appConfig, getSelection)
      : getAgentTokenSource(getSelection);
  }, [appConfig]);

  // Capture the mic with browser echo cancellation + noise suppression + auto-gain
  // so ambient office noise is reduced at the source. This cleans the audio once,
  // benefiting both the live conversation and the displayed transcript. Created
  // once and reused across reconnects (e.g. language change).
  const [room] = useState(
    () =>
      new Room({
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
  );

  const session = useSession(tokenSource, { room });

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
          // Reconnect with the mic off too — the user taps to start listening.
          await session.start({ tracks: { microphone: { enabled: false } } });
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
            selectedLanguage={selectedLanguage}
            onLanguageChange={handleLanguageChange}
            isReconnecting={isReconnecting}
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
