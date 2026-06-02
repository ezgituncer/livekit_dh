import { cache } from 'react';
import { TokenSource } from 'livekit-client';
import { APP_CONFIG_DEFAULTS } from '@/app-config';
import type {
  AdvancedSttSettings,
  AdvancedTurnHandlingSettings,
  AppConfig,
} from '@/app-config';

export const CONFIG_ENDPOINT = process.env.NEXT_PUBLIC_APP_CONFIG_ENDPOINT;
export const SANDBOX_ID = process.env.SANDBOX_ID;

export interface SandboxConfig {
  [key: string]:
    | { type: 'string'; value: string }
    | { type: 'number'; value: number }
    | { type: 'boolean'; value: boolean }
    | null;
}

export interface AgentSelection {
  agentName: string | undefined;
  stt: string | undefined;
  tts: string | undefined;
  detector: string | undefined;
  language: string | undefined;
  voiceId: string | undefined;
  serverVad: AdvancedSttSettings | undefined;
  turnHandling: AdvancedTurnHandlingSettings | undefined;
}

/**
 * Get the app configuration
 * @param headers - The headers of the request
 * @returns The app configuration
 *
 * @note React will invalidate the cache for all memoized functions for each server request.
 * https://react.dev/reference/react/cache#caveats
 */
export const getAppConfig = cache(async (headers: Headers): Promise<AppConfig> => {
  if (CONFIG_ENDPOINT) {
    const sandboxId = SANDBOX_ID ?? headers.get('x-sandbox-id') ?? '';

    try {
      if (!sandboxId) {
        throw new Error('Sandbox ID is required');
      }

      const response = await fetch(CONFIG_ENDPOINT, {
        cache: 'no-store',
        headers: { 'X-Sandbox-ID': sandboxId },
      });

      if (response.ok) {
        const remoteConfig: SandboxConfig = await response.json();

        const config: AppConfig = { ...APP_CONFIG_DEFAULTS, sandboxId };

        for (const [key, entry] of Object.entries(remoteConfig)) {
          if (entry === null) continue;
          // Only include app config entries that are declared in defaults and, if set,
          // share the same primitive type as the default value.
          if (
            (key in APP_CONFIG_DEFAULTS &&
              APP_CONFIG_DEFAULTS[key as keyof AppConfig] === undefined) ||
            (typeof config[key as keyof AppConfig] === entry.type &&
              typeof config[key as keyof AppConfig] === typeof entry.value)
          ) {
            // @ts-expect-error I'm not sure quite how to appease TypeScript, but we've thoroughly checked types above
            config[key as keyof AppConfig] = entry.value as AppConfig[keyof AppConfig];
          }
        }

        return config;
      } else {
        console.error(
          `ERROR: querying config endpoint failed with status ${response.status}: ${response.statusText}`
        );
      }
    } catch (error) {
      console.error('ERROR: getAppConfig() - lib/utils.ts', error);
    }
  }

  return APP_CONFIG_DEFAULTS;
});

/**
 * Get styles for the app
 * @param appConfig - The app configuration
 * @returns A string of styles
 */
export function getStyles(appConfig: AppConfig) {
  const { accent, accentDark } = appConfig;

  return [
    accent
      ? `:root { --primary: ${accent}; --primary-hover: color-mix(in srgb, ${accent} 80%, #000); }`
      : '',
    accentDark
      ? `.dark { --primary: ${accentDark}; --primary-hover: color-mix(in srgb, ${accentDark} 80%, #000); }`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Get a token source for the local /api/token route that dispatches the
 * selected agent via the access token's RoomConfiguration.
 */
export function getAgentTokenSource(getSelection: () => AgentSelection) {
  // Use `literal` (not `custom`) so the fetcher is invoked on every
  // start() — `TokenSource.custom` caches the first response and returns
  // it on subsequent fetches when the fetch options differ, which would
  // pin us to whichever agent was selected at mount time.
  return TokenSource.literal(async () => {
    const sel = getSelection();
    const res = await fetch('/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_name: sel.agentName,
        stt: sel.stt,
        tts: sel.tts,
        detector: sel.detector,
        language: sel.language,
        voice_id: sel.voiceId,
        server_vad: sel.serverVad,
        turn_handling: sel.turnHandling,
      }),
    });
    if (!res.ok) {
      throw new Error(`Token request failed: ${res.status} ${res.statusText}`);
    }
    return await res.json();
  });
}

/**
 * Get a token source for a sandboxed LiveKit session
 * @param appConfig - The app configuration
 * @returns A token source for a sandboxed LiveKit session
 */
export function getSandboxTokenSource(
  appConfig: AppConfig,
  getSelection: () => AgentSelection
) {
  return TokenSource.literal(async () => {
    const url = new URL(process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT!, window.location.origin);
    const sandboxId = appConfig.sandboxId ?? '';
    const sel = getSelection();
    const agentName = sel.agentName ?? appConfig.agentName;
    const roomConfig = agentName
      ? {
          agents: [{ agent_name: agentName }],
        }
      : undefined;

    try {
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sandbox-Id': sandboxId,
        },
        body: JSON.stringify({
          room_config: roomConfig,
          stt: sel.stt,
          tts: sel.tts,
          detector: sel.detector,
          language: sel.language,
          voice_id: sel.voiceId,
          server_vad: sel.serverVad,
          turn_handling: sel.turnHandling,
        }),
      });
      return await res.json();
    } catch (error) {
      console.error('Error fetching connection details:', error);
      throw new Error('Error fetching connection details!');
    }
  });
}
