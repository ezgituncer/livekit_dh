import availableVoices from './data/available_voices.json';

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
  stts: STTOption[];
  ttss: TTSOption[];
  detectors: DetectorOption[];
  voices: VoiceOption[];

  // LiveKit Cloud Sandbox configuration
  sandboxId?: string;
}

export interface STTOption {
  id: string;
  label: string;
  supportsLanguage: boolean;
}

export interface TTSOption {
  id: string;
  label: string;
}

export interface DetectorOption {
  id: string;
  label: string;
}

export interface VoiceOption {
  id: string;
  label: string;
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

// Realtime-only ElevenLabs STT server-VAD options. Defaults match
// https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime
export interface AdvancedSttSettings {
  // When false, the agent disables ElevenLabs' server-side VAD and lets
  // LiveKit handle turn detection. The four numeric fields below are then
  // ignored.
  server_vad_enabled: boolean;
  vad_silence_threshold_secs: number;
  vad_threshold: number;
  min_speech_duration_ms: number;
  min_silence_duration_ms: number;
}

export const DEFAULT_ADVANCED_STT_SETTINGS: AdvancedSttSettings = {
  server_vad_enabled: true,
  vad_silence_threshold_secs: 1.5,
  vad_threshold: 0.4,
  min_speech_duration_ms: 250,
  min_silence_duration_ms: 2500,
};

// LiveKit AgentSession turn-handling knobs. See:
// https://docs.livekit.io/reference/agents/turn-handling-options/
//
// Defaults mirror what the agent currently uses internally so the UI's
// "Reset to defaults" preserves the existing runtime behavior.
export type InterruptionMode = 'adaptive' | 'vad';

export interface AdvancedTurnHandlingSettings {
  // Endpointing — how long to wait after the detector signals end-of-turn
  // before declaring the user's turn complete.
  endpointing_min_delay: number; // seconds
  endpointing_max_delay: number; // seconds
  // Interruption
  interruption_enabled: boolean;
  interruption_mode: InterruptionMode;
  interruption_min_duration: number; // seconds
  interruption_min_words: number;
}

export const DEFAULT_ADVANCED_TURN_HANDLING_SETTINGS: AdvancedTurnHandlingSettings = {
  endpointing_min_delay: 0.5,
  endpointing_max_delay: 3.0,
  interruption_enabled: true,
  interruption_mode: 'vad',
  interruption_min_duration: 1.0,
  interruption_min_words: 0,
};

// Must match the @server.rtc_session(agent_name=...) in voice_agent_configurable.py.
export const AGENT_NAME = 'eval-voice-agent';

export const APP_CONFIG_DEFAULTS: AppConfig = {
  companyName: 'Huawei',
  pageTitle: 'Huawei',
  pageDescription: 'Huawei voice agent',

  supportsChatInput: true,
  supportsVideoInput: true,
  supportsScreenShare: true,
  isPreConnectBufferEnabled: true,

  logo: '/lk-logo.svg',
  accent: '#2fe6c0',
  logoDark: '/lk-logo-dark.svg',
  accentDark: '#2fe6c0',
  startButtonText: 'Start call',

  agentName: process.env.AGENT_NAME ?? AGENT_NAME,

  stts: [
    { id: 'elevenlabs-scribe-v2', label: 'ElevenLabs Scribe V2', supportsLanguage: true },
    {
      id: 'elevenlabs-scribe-v2-realtime',
      label: 'ElevenLabs Scribe V2 (Realtime)',
      supportsLanguage: true,
    },
    { id: 'azure-stt', label: 'Azure STT', supportsLanguage: true },
  ],

  ttss: [
    { id: 'elevenlabs-multilingual-v2', label: 'ElevenLabs Multilingual V2' },
    { id: 'elevenlabs-flash-v2-5', label: 'ElevenLabs Flash V2.5' },
    { id: 'elevenlabs-v3', label: 'ElevenLabs V3 (audio tags)' },
    { id: 'elevenlabs-v3-plain', label: 'ElevenLabs V3 (plain)' },
  ],

  detectors: [
    { id: 'vad', label: 'VAD' },
    { id: 'multilingual', label: 'LiveKit Multilingual' },
    { id: 'smart-turn', label: 'Smart Turn (ONNX)' },
  ],

  voices: availableVoices.map((v) => ({
    id: v.voice_id,
    label: v.is_default ? `${v.name} (default)` : v.name,
  })),

  sandboxId: undefined,
};
