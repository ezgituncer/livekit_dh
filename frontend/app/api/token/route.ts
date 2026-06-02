import { NextResponse } from 'next/server';
import { AccessToken, type AccessTokenOptions, type VideoGrant } from 'livekit-server-sdk';
import { RoomAgentDispatch, RoomConfiguration } from '@livekit/protocol';
import { APP_CONFIG_DEFAULTS, SUPPORTED_LANGUAGES } from '@/app-config';

type ConnectionDetails = {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
};

// NOTE: you are expected to define the following environment variables in `.env.local`:
const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

const LANGUAGE_ALLOWLIST = new Set(SUPPORTED_LANGUAGES.map((l) => l.code));
const STT_ALLOWLIST = new Set(APP_CONFIG_DEFAULTS.stts.map((s) => s.id));
const TTS_ALLOWLIST = new Set(APP_CONFIG_DEFAULTS.ttss.map((t) => t.id));
const DETECTOR_ALLOWLIST = new Set(APP_CONFIG_DEFAULTS.detectors.map((d) => d.id));

// ElevenLabs voice IDs are opaque alphanumeric strings (~20 chars). We accept
// either a preconfigured id or any caller-provided id that matches the format,
// since the UI exposes a manual-entry field.
const VOICE_ID_PATTERN = /^[A-Za-z0-9]{10,64}$/;

// Bounds for the realtime STT server-VAD options. Anything outside the range
// (or non-numeric) is dropped so the agent falls back to the model defaults.
const SERVER_VAD_BOUNDS: Record<string, { min: number; max: number; integer?: boolean }> = {
  vad_silence_threshold_secs: { min: 0, max: 10 },
  vad_threshold: { min: 0, max: 1 },
  min_speech_duration_ms: { min: 0, max: 10000, integer: true },
  min_silence_duration_ms: { min: 0, max: 60000, integer: true },
};

// Bounds for the LiveKit AgentSession turn-handling knobs (endpointing +
// interruption). Same drop-on-invalid policy as SERVER_VAD_BOUNDS.
const TURN_HANDLING_BOUNDS: Record<string, { min: number; max: number; integer?: boolean }> = {
  endpointing_min_delay: { min: 0, max: 30 },
  endpointing_max_delay: { min: 0, max: 60 },
  interruption_min_duration: { min: 0, max: 10 },
  interruption_min_words: { min: 0, max: 20, integer: true },
};

const INTERRUPTION_MODE_ALLOWLIST = new Set(['adaptive', 'vad']);

function pickServerVadNumber(
  value: unknown,
  bounds: { min: number; max: number; integer?: boolean }
): string | undefined {
  const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(num)) return undefined;
  if (num < bounds.min || num > bounds.max) return undefined;
  return bounds.integer ? String(Math.round(num)) : String(num);
}

// don't cache the results
export const revalidate = 0;

function pickAllowlisted(value: unknown, allowlist: Set<string>): string | undefined {
  if (typeof value !== 'string') return undefined;
  return allowlist.has(value) ? value : undefined;
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error(
      'THIS API ROUTE IS INSECURE. DO NOT USE THIS ROUTE IN PRODUCTION WITHOUT AN AUTHENTICATION LAYER.'
    );
  }

  try {
    if (LIVEKIT_URL === undefined) {
      throw new Error('LIVEKIT_URL is not defined');
    }
    if (API_KEY === undefined) {
      throw new Error('LIVEKIT_API_KEY is not defined');
    }
    if (API_SECRET === undefined) {
      throw new Error('LIVEKIT_API_SECRET is not defined');
    }

    const body = await req.json().catch(() => ({}));

    const agentName: string | undefined =
      typeof body?.agent_name === 'string' && body.agent_name.length > 0
        ? body.agent_name
        : undefined;
    const roomConfig: RoomConfiguration | undefined = agentName
      ? new RoomConfiguration({ agents: [new RoomAgentDispatch({ agentName })] })
      : body?.room_config
        ? RoomConfiguration.fromJson(body.room_config, { ignoreUnknownFields: true })
        : undefined;

    const attributes: Record<string, string> = {};
    const stt = pickAllowlisted(body?.stt, STT_ALLOWLIST);
    if (stt) attributes.stt = stt;
    const tts = pickAllowlisted(body?.tts, TTS_ALLOWLIST);
    if (tts) attributes.tts = tts;
    const detector = pickAllowlisted(body?.detector, DETECTOR_ALLOWLIST);
    if (detector) attributes.detector = detector;
    const language = pickAllowlisted(body?.language, LANGUAGE_ALLOWLIST);
    if (language) attributes.language = language;
    if (typeof body?.voice_id === 'string' && VOICE_ID_PATTERN.test(body.voice_id)) {
      attributes.voice_id = body.voice_id;
    }

    // Realtime ElevenLabs STT server-VAD knobs. Sent as separate string
    // attributes — only forwarded when STT is the realtime variant.
    if (attributes.stt === 'elevenlabs-scribe-v2-realtime' && body?.server_vad) {
      const enabled = body.server_vad?.server_vad_enabled;
      if (typeof enabled === 'boolean') {
        attributes.server_vad_enabled = enabled ? 'true' : 'false';
      }
      // Numeric knobs are only meaningful when server VAD is on. When off, the
      // agent passes server_vad=None and LiveKit handles turn detection.
      if (enabled !== false) {
        for (const [key, bounds] of Object.entries(SERVER_VAD_BOUNDS)) {
          const picked = pickServerVadNumber(body.server_vad?.[key], bounds);
          if (picked !== undefined) attributes[key] = picked;
        }
      }
    }

    // LiveKit AgentSession turn-handling knobs. Always forwarded when present.
    if (body?.turn_handling) {
      const th = body.turn_handling;
      if (typeof th.interruption_enabled === 'boolean') {
        attributes.interruption_enabled = th.interruption_enabled ? 'true' : 'false';
      }
      if (
        typeof th.interruption_mode === 'string' &&
        INTERRUPTION_MODE_ALLOWLIST.has(th.interruption_mode)
      ) {
        attributes.interruption_mode = th.interruption_mode;
      }
      for (const [key, bounds] of Object.entries(TURN_HANDLING_BOUNDS)) {
        const picked = pickServerVadNumber(th[key], bounds);
        if (picked !== undefined) attributes[key] = picked;
      }
    }

    // Generate participant token
    const participantName = 'user';
    const participantIdentity = `voice_assistant_user_${Math.floor(Math.random() * 10_000)}`;
    const roomName = `voice_assistant_room_${Math.floor(Math.random() * 10_000)}`;

    const participantToken = await createParticipantToken(
      { identity: participantIdentity, name: participantName, attributes },
      roomName,
      roomConfig
    );

    const data: ConnectionDetails = {
      serverUrl: LIVEKIT_URL,
      roomName,
      participantName,
      participantToken,
    };
    const headers = new Headers({
      'Cache-Control': 'no-store',
    });
    return NextResponse.json(data, { headers });
  } catch (error) {
    if (error instanceof Error) {
      console.error(error);
      return new NextResponse(error.message, { status: 500 });
    }
  }
}

function createParticipantToken(
  userInfo: AccessTokenOptions,
  roomName: string,
  roomConfig: RoomConfiguration | undefined
): Promise<string> {
  const at = new AccessToken(API_KEY, API_SECRET, {
    ...userInfo,
    ttl: '15m',
  });
  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  };
  at.addGrant(grant);

  if (roomConfig) {
    at.roomConfig = roomConfig;
  }

  return at.toJwt();
}
