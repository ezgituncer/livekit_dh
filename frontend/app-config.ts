export interface AppConfig {
  pageTitle: string;
  pageDescription: string;
  companyName: string;

  supportsChatInput: boolean;
  supportsVideoInput: boolean;
  supportsScreenShare: boolean;
  isPreConnectBufferEnabled: boolean;

  logo: string;
  startButtonText: string;
  accent?: string;
  logoDark?: string;
  accentDark?: string;

  audioVisualizerType?: 'bar' | 'wave' | 'grid' | 'radial' | 'aura';
  audioVisualizerColor?: `#${string}`;
  audioVisualizerColorDark?: `#${string}`;
  audioVisualizerColorShift?: number;
  audioVisualizerBarCount?: number;
  audioVisualizerGridRowCount?: number;
  audioVisualizerGridColumnCount?: number;
  audioVisualizerRadialBarCount?: number;
  audioVisualizerRadialRadius?: number;
  audioVisualizerWaveLineWidth?: number;

  // agent dispatch configuration
  agentName?: string;

  // LiveKit Cloud Sandbox configuration
  sandboxId?: string;
}

export interface LanguageOption {
  code: string;
  label: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'tr', label: 'Türkçe' },
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'ru', label: 'Русский' },
];

export const DEFAULT_LANGUAGE = 'en';

// Must match the @server.rtc_session(agent_name=...) in voice_agent_configurable.py.
export const AGENT_NAME = 'eval-voice-agent';

export const APP_CONFIG_DEFAULTS: AppConfig = {
  companyName: 'Huawei',
  pageTitle: 'Huawei',
  pageDescription: 'Huawei voice agent',

  supportsChatInput: true,
  supportsVideoInput: true,
  supportsScreenShare: true,
  // The mic starts off and the user taps to talk, so there's no pre-connect
  // audio to buffer (and the "agent is listening" hint would be misleading).
  isPreConnectBufferEnabled: false,

  logo: '/lk-logo.svg',
  accent: '#2fe6c0',
  logoDark: '/lk-logo-dark.svg',
  accentDark: '#2fe6c0',
  startButtonText: 'Start call',

  agentName: process.env.AGENT_NAME ?? AGENT_NAME,

  sandboxId: undefined,
};
