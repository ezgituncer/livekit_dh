# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A real-time voice AI assistant with a 3D **digital human** avatar. Three cooperating services
(orchestrated by `docker-compose.yml`):

| Service    | Tech                                  | Role |
|------------|---------------------------------------|------|
| `livekit`  | `livekit/livekit-server` (WebRTC SFU) | Media transport & signaling |
| `agent`    | Python — LiveKit Agents worker        | The voice AI (Qwen-Omni realtime model) |
| `frontend` | Next.js 15 / React 19                 | Web client + FaceUnity WebGL avatar |

Data flow: **Browser ⇄ LiveKit (WebRTC) ⇄ Agent**. The frontend's `/api/token` route mints a
LiveKit access token and dispatches the agent into the room.

## Commands

### Full stack (Docker — closest to production)
```bash
docker compose up -d --build          # build & start all three services
docker compose logs agent | grep "registered worker"   # confirm agent connected
docker compose up -d --build agent    # rebuild agent only (no bind-mount; must rebuild on change)
docker compose restart frontend       # frontend source is bind-mounted for hot reload
```
Frontend is served at **http://localhost:3001** (host `3001` → container `3000`).
See `deploy.md` for the full deployment + hardening + troubleshooting guide.

### Frontend (cwd: `frontend/`, pnpm 9 / Node 20+)
```bash
pnpm install        # vendor/furenderkit-*.tgz must exist before install resolves the lockfile
pnpm dev            # next dev --turbopack, port 3000
pnpm build && pnpm start
pnpm lint           # next lint
pnpm format         # prettier --write .  (format:check for CI)
```
No automated test suite is configured.

### Agent (cwd: `agent/`, Python 3.11 venv)
```bash
pip install -r requirements.txt
python voice_agent_configurable.py download-files   # prefetch ML models (smart-turn ONNX, etc.)
python voice_agent_configurable.py dev              # run the worker (dev mode = hot reload)
```
`voice_agent_env.py` is a standalone variant that reads all per-session knobs from env vars
(`AGENT_STT`, `AGENT_TTS`, `AGENT_DETECTOR`, …) instead of per-participant attributes — useful for
running the agent without this repo's frontend. Files prefixed with `_` (e.g.
`_voice_agent_eleven_labs_deepfilter.py`) are experimental/inactive.

## Architecture

### Agent (`agent/`)
- **`voice_agent_configurable.py`** — the entrypoint. `AgentServer` + `@server.rtc_session(agent_name="eval-voice-agent")`. It reads **participant attributes** (`stt`, `tts`, `detector`, `language`, `voice_id`, and turn-handling knobs) off the connecting browser participant and composes an `AgentSession`.
- The conversation model is **Qwen-Omni realtime** (`qwen3.5-omni-flash-realtime`) via Alibaba DashScope, implemented in **`qwen_realtime/`** — a fork of LiveKit's OpenAI-realtime plugin adapted to the DashScope websocket. It's a single full-duplex speech model: input ASR is intentionally disabled (`input_audio_transcription=None`) so everything stays on qwen-omni. A language directive is prepended to the instructions to stop it drifting into Chinese.
- **`registry.py`** is the configurability hub: `STT_REGISTRY`, `TTS_REGISTRY`, `DETECTOR_REGISTRY` map stable string ids → factory functions. Also defines `ConfigurableAgent` (one `Agent` subclass whose `stt_node`/`llm_node`/`transcription_node` behavior is toggled by flags rather than subclassing), `BufferedTTS` (wraps ElevenLabs v3, which can't stream over the multi-stream endpoint), the ONNX `SmartTurnDetector`, and `prewarm`. **Adding a provider = one registry entry here + one matching entry in `frontend/app-config.ts`.**
- **Gotcha:** the current single-model path only passes `llm=QwenRealtimeModel(...)` to `AgentSession`. The `stt`/`tts`/`turn_handling_kwargs` it builds from attributes are *not* wired into the session — leftovers from the earlier STT→LLM→TTS pipeline design. What still takes effect from a detector choice is its `pipeline_sample_rate` and the `audio_buffer` (smart-turn), plus the agent `instructions`/`strip_tags`.
- **Hardcoded secret:** the Qwen `api_key`/`model`/`base_url` are inlined in `voice_agent_configurable.py` (around the `QwenRealtimeModel(...)` call). They should move to `agent/.env` and the committed key should be rotated (see `deploy.md` §5.5).

### Frontend (`frontend/`, Next.js App Router)
- **`components/app/app.tsx`** — root client component. Holds the selection state (stt/tts/detector/language/voice), builds a token source via `useMemo`+refs (so changing a selection doesn't recreate the source and reset the session), and drives the LiveKit `useSession`.
- **`app/api/token/route.ts`** — mints the LiveKit token and dispatches the agent. Validates/allowlists every browser-supplied attribute against `app-config.ts`. **It `throw`s unless `NODE_ENV=development`** because it has no auth — it must be put behind authentication or replaced before any production use (`deploy.md` §5.1). Alternatively the client can point at a remote/sandbox token endpoint via `NEXT_PUBLIC_CONN_DETAILS_ENDPOINT`.
- **`app-config.ts`** — central frontend config: `APP_CONFIG_DEFAULTS`, `SUPPORTED_LANGUAGES`, the STT/TTS/detector option lists, and `AGENT_NAME`.
- **Digital human** (`lib/digital-human/`, `components/digital-human/`) — uses the vendored **FaceUnity FURenderKit** SDK (`vendor/furenderkit-*.tgz`); runtime assets live in `public/digital-human/**`.
  - `use-avatar.ts` owns a **process-wide singleton**: one detached `<canvas>` + WebGL renderer, initialized exactly once (~61MB avatar bundle). It survives React StrictMode double-mounts and component remounts — components attach/detach the canvas but never recreate it. Exposes an imperative lip-sync + gesture API.
  - `avatar-lip-sync.tsx` taps the agent's LiveKit audio track through a Web Audio `AnalyserNode` and drives mouth openness/shape/sibilance every animation frame ("acoustic" mode, language-agnostic). A transcript→viseme "phoneme" mode exists but is disabled (`PHONEME_ENABLED = false`). Talking gestures are driven off the agent's `speaking` state.
- **i18n** (`lib/i18n/`) — 6 languages (TR/EN/AR/ES/PT/RU), RTL handling for Arabic. The conversation language is baked into the participant token at connect time and the realtime model can't swap mid-session, so an in-call language change **tears down and restarts** the session (`handleLanguageChange` in `app.tsx`).
- **Theming** (`lib/design/`, `styles/globals.css`) — the `DESIGN` env var (`dark-green` | `light` | `dark`) is read server-side in `app/layout.tsx` and written to `<html data-design>`; an inline no-flash script applies a stored in-UI override from `localStorage` before paint. JS-driven visuals (audio visualizer, particle background) read concrete colors from `design.ts` (mirrors the CSS tokens) rather than CSS vars.
- UI is built on LiveKit's Agents UI starter (`components/agents-ui/`, shadcn/Radix-based). `agent-session-view-01` is the main in-call view block.

### Cross-service invariants (easy to break)
- **Agent name** must match in three places: `@server.rtc_session(agent_name=…)` in `voice_agent_configurable.py`, `AGENT_NAME` in `frontend/app-config.ts`, and the dispatch in `app/api/token/route.ts`.
- **STT/TTS/detector ids** must match between `agent/registry.py` and `frontend/app-config.ts` — the token route allowlists against app-config, so any id not present there is silently dropped.
- **LiveKit key/secret** must be identical across `livekit.yaml`, `frontend/.env`, and `agent/.env`.

## Environment files
Copy the examples and fill them in: `frontend/.env` (from `.env.example`) and `agent/.env`
(from `.env.example`). `livekit.yaml` ships a dev key (`devkey`/`secretsecret…`) — replace it for
anything but local use. Full variable reference is in `deploy.md` §3.
