# Deployment Guide

This document describes everything required to deploy the **Real-Time Voice AI
Assistant with a Digital Human** and the exact steps to do it, from a local/demo
run to a hardened production deployment.

---

## 1. Architecture & What Gets Deployed

Three containers, orchestrated by `docker-compose.yml`:

| Service     | Image / Build              | Purpose                                   | Ports (host:container) |
|-------------|----------------------------|-------------------------------------------|------------------------|
| `livekit`   | `livekit/livekit-server`   | WebRTC SFU — media transport & signaling  | `7880`, `7881`, `7882/udp` |
| `agent`     | `./agent` (Python)         | LiveKit Agents worker (qwen-omni realtime)| none (outbound only)   |
| `frontend`  | `./frontend` (Next.js)     | Web client / UI                           | `3001 -> 3000`         |

Data flow: **Browser ⇄ LiveKit (WebRTC) ⇄ Agent**. The frontend also calls its
own `/api/token` route to mint a LiveKit access token and dispatch the agent.

---

## 2. Prerequisites

- **Docker** and **Docker Compose v2** on the host.
- A host/VM with a public IP (for production) and the firewall ports below open.
- **LiveKit API key/secret** (generate your own — do not ship the dev key).
- **Qwen / DashScope realtime API key** (the conversation model
  `qwen3.5-omni-flash-realtime`). Get it from Alibaba Cloud Model Studio /
  DashScope (international endpoint).
- For production: a **domain name** and **TLS certificates** (Let's Encrypt) for
  the frontend and the LiveKit WebSocket URL.
- Optional (only if you re-enable those providers — not used by the default
  single-model path): ElevenLabs and/or Azure Speech keys.

---

## 3. Required Credentials & Environment Variables

### 3.1 `frontend/.env` (copy from `frontend/.env.example`)
```
LIVEKIT_API_KEY=<your key>
LIVEKIT_API_SECRET=<your secret>
LIVEKIT_URL=<ws(s):// URL the BROWSER can reach>
DESIGN=dark-green        # default theme: dark-green | light | dark
```
- `LIVEKIT_URL` is returned to the browser, so it must be reachable **from the
  client**. Local: `ws://localhost:7880`. Production: `wss://livekit.example.com`.

### 3.2 `agent/.env` (copy from `agent/.env.example`)
```
LIVEKIT_URL=ws://livekit:7880      # internal compose hostname
LIVEKIT_API_KEY=<your key>         # must match livekit.yaml + frontend
LIVEKIT_API_SECRET=<your secret>

# Conversation model (Qwen-Omni realtime via DashScope)
# Ordered key pool, primary first, comma-separated. The agent fails over to the
# next key when one stops working (see the two failure modes below). One key works too.
QWEN_API_KEYS=<primary DashScope key>,<backup DashScope key>
QWEN_BASE_URL=wss://dashscope-intl.aliyuncs.com/api-ws/v1/realtime   # optional override
QWEN_MODEL=qwen3.5-omni-plus-realtime                                # optional override
QWEN_VOICE=Ethan                                                     # optional override
QWEN_TRANSCRIPTION_MODEL=gummy-realtime-v1                           # input-ASR for the displayed transcript
QWEN_TRANSCRIBE_SESSION_ENABLED=true                                 # 2nd realtime session transcribes (text-only)
QWEN_TRANSCRIBE_SESSION_MODEL=qwen3.5-omni-plus-realtime             # model for that 2nd session
QWEN_KEY_ROTATE_MARKERS=                                             # optional extra in-band error markers
QWEN_KEY_DEAD_CONN_SECONDS=8                                         # optional: dead-key detector window
QWEN_KEY_DEAD_CONN_LIMIT=3                                           # optional: drops-in-a-row before rotating

# Optional — only if you re-enable ElevenLabs/Azure providers (unused by default)
ELEVEN_API_KEY=
AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=
```
> The Qwen keys are read from `QWEN_API_KEYS` in `agent/.env` (the previously
> hardcoded key has been removed from `agent/voice_agent_configurable.py`). The
> agent rotates to the next key automatically — at session start **and** mid-call
> (it reconnects and replays the conversation) — for two distinct failure modes:
> 1. **Revoked / invalid key** → the websocket handshake is rejected with HTTP
>    401/403/429.
> 2. **Exhausted quota** (the 1M-token cap) → the handshake *succeeds*, then the
>    DashScope server drops the socket immediately (observed close codes 1006/1002).
>    This is detected as repeated connections dying right after connect (tunable via
>    `QWEN_KEY_DEAD_CONN_SECONDS` / `QWEN_KEY_DEAD_CONN_LIMIT`).
>
> **Still rotate the previously committed key**: it remains exposed in source history.

### 3.3 `livekit.yaml` (LiveKit server config)
The committed file uses a **development key** (`devkey` / `secretsecret...`).
For production, replace it with your generated key/secret and enable external IP:
```yaml
port: 7880
rtc:
  tcp_port: 7881
  udp_port: 7882
  use_external_ip: true        # required behind NAT / on a cloud VM
keys:
  <LIVEKIT_API_KEY>: <LIVEKIT_API_SECRET>
```
The `keys` here, `frontend/.env`, and `agent/.env` must all use the **same**
key/secret.

---

## 4. Step-by-Step: Local / Demo Deployment

1. **Clone** the repo onto the host.
2. **Create env files:**
   ```bash
   cp frontend/.env.example frontend/.env   # fill in values
   cp agent/.env.example    agent/.env      # fill in values
   ```
3. **Build & start** all services:
   ```bash
   docker compose up -d --build
   ```
   - First build downloads the agent's ML models (smart-turn ONNX, etc.) and the
     frontend dependencies (including the local `furenderkit` avatar SDK tarball).
4. **Wait for readiness:**
   - Frontend compiles on first request (dev server) — give it ~1–2 min.
   - Confirm the agent registered: `docker compose logs agent | grep "registered worker"`.
5. **Open** `http://localhost:3001`. The avatar loads, the mic starts off (tap to
   talk), and suggested questions appear once the avatar is ready.

---

## 5. Step-by-Step: Production Deployment (Hardening)

The default setup runs the frontend in **development mode** (`pnpm dev`) and its
token route is intentionally disabled outside development. Do the following for a
real deployment:

### 5.1 Secure the token endpoint (critical)
`frontend/app/api/token/route.ts` **throws** unless `NODE_ENV=development` —
because it mints LiveKit tokens with no authentication. For production you must
either:
- Put the token route behind your **own authentication** (session/login) and
  remove the dev-only guard, **or**
- Use a **separate, authenticated token service** and point the client at it via
  `NEXT_PUBLIC_CONN_DETAILS_ENDPOINT` (the app already supports a sandbox/remote
  token source), **or**
- Use **LiveKit Cloud** and its token/sandbox endpoint.

Never expose the unauthenticated token route publicly.

### 5.2 Build the frontend for production
Change `frontend/Dockerfile` to build and serve instead of `pnpm dev`:
```dockerfile
RUN pnpm build
ENV NODE_ENV=production
CMD ["pnpm", "start"]
```
Then drop the bind-mount + dev assumptions from the `frontend` service in
`docker-compose.yml` (the source bind-mount is for hot reload only).

### 5.3 LiveKit for production
- Generate strong `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` and set them in
  `livekit.yaml`, `frontend/.env`, and `agent/.env`.
- Set `rtc.use_external_ip: true`.
- Serve LiveKit signaling over **TLS** (`wss://`) via a reverse proxy
  (nginx/Caddy) and set `LIVEKIT_URL=wss://livekit.example.com` in `frontend/.env`.
- Open firewall ports: **7880/tcp** (signaling), **7881/tcp** (RTC/TCP),
  **7882/udp** (RTC/UDP). For restrictive networks, configure a **TURN** server.

### 5.4 TLS / reverse proxy for the frontend
- Put the frontend behind nginx/Caddy with HTTPS (browsers require a secure
  context for microphone access — `getUserMedia` needs HTTPS or `localhost`).
- Map your domain (e.g. `https://app.example.com`) to the frontend container.

### 5.5 Secrets hygiene
- Qwen credentials now live in `agent/.env` (`QWEN_API_KEYS`); the hardcoded key
  has been removed from source. **Rotate** the previously committed key — it is
  still exposed in git history.
- Provide a backup key (second entry in `QWEN_API_KEYS`) so a session survives a
  key hitting its 1M-token cap. Failover is reactive and covers both a refused
  handshake (401/403/429) and an exhausted key (handshake OK, socket dropped
  immediately — see §3.2). If a future quota error ever arrives as an in-band error
  event instead, copy its text into `QWEN_KEY_ROTATE_MARKERS` (watch the agent logs
  for the "did not match any key-rotate marker" warning).
- Keep `.env` files out of version control; inject secrets via your platform's
  secret manager where possible.

### 5.6 Agent worker: production mode & warm processes
The agent currently runs in **development mode** (`docker-compose.yml`:
`command: ["python", "voice_agent_configurable.py", "dev"]`). Dev mode shrinks
the idle-process pool, so every session cold-starts a worker process — if that
plus the model/Qwen connection setup exceeds the client's join timeout you get
**"agent did not join the room."**

For production:
- Run the worker in **`start`** mode instead of `dev`:
  ```yaml
  command: ["python", "voice_agent_configurable.py", "start"]
  ```
  `start` mode honors the full idle-process pool, so prewarmed workers stay
  ready and the agent joins instantly.
- Keep prewarmed (idle) processes ready. The code already sets
  `AgentServer(num_idle_processes=2)`; tune per host RAM via the env var (each
  idle process holds the prewarmed models — Silero VAD, smart-turn ONNX, Whisper
  feature extractor — in memory):
  ```
  LIVEKIT_NUM_IDLE_PROCESSES=2   # raise on big hosts, set 1 on small ones
  ```
- The client already retries transient agent-join failures a couple of times
  before surfacing an error (see `frontend/hooks/useAgentErrors.tsx`).
- Scale out by running multiple agent worker replicas behind the same LiveKit
  server for higher concurrency.

---

## 6. Verification / Health Checks

```bash
docker compose ps                                   # all three "running"
docker compose logs agent  | grep "registered worker"   # agent connected
docker compose logs livekit | grep "starting LiveKit"    # SFU up
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001   # 200
```
In the browser: open the app → avatar loads → tap mic (grant permission) or pick a
suggested question → the agent replies (audio + transcript). If audio is blocked
by autoplay policy, a "Start audio" button appears.

---

## 7. Configuration Knobs

- **Theme:** `DESIGN` in `frontend/.env` (`dark-green` | `light` | `dark`). Can
  also be switched live in the UI (top-right swatches); the env value is the
  default. Changing the env requires recreating the frontend container:
  `docker compose up -d --force-recreate --no-deps frontend`.
- **Conversation language / UI language:** chosen in-app (TR/EN/AR/ES/PT/RU);
  changing the conversation language reconnects the session.

---

## 8. Updating / Redeploying

- **Agent code changes:** the agent has **no bind-mount**, so rebuild it:
  ```bash
  docker compose up -d --build agent
  ```
- **Frontend code changes (dev setup):** the source is bind-mounted, but on
  Windows hosts file-watch may not propagate — restart to be safe:
  ```bash
  docker compose restart frontend
  ```
  (Clear `.next` inside the container if a stale build lingers.)
- **Production frontend:** rebuild the image (`docker compose up -d --build frontend`).

---

## 9. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Agent never connects / "did not complete initializing" | Model prewarm exceeds the init timeout, or wrong `LIVEKIT_URL`/keys. Check `docker compose logs agent`. |
| "agent did not join the room" (intermittent) | Cold-start with no warm worker and/or a transient Qwen WS connection — see §5.6 (run in `start` mode, keep `num_idle_processes` warm). The client also auto-retries a couple of times. |
| Token request fails (500) in production | The `/api/token` dev guard — see §5.1. |
| No audio / mic blocked | Frontend not on HTTPS (or `localhost`). Serve over TLS (§5.4). |
| Browser can't reach LiveKit | `LIVEKIT_URL` not publicly reachable or RTC ports closed (§5.3). |
| Theme change not applied after editing `DESIGN` | `docker compose up -d --force-recreate --no-deps frontend` (restart doesn't always reload env). |
| Avatar stuck on "Preparing avatar" | Avatar SDK/bundle failed to load — check the browser console and that `frontend/public/digital-human/**` assets are present. |
