# Kurulum ve Çalıştırma Rehberi (installation.md)

Bu proje üç bileşenden oluşur:

| Bileşen | Klasör | Teknoloji | Görev |
| --- | --- | --- | --- |
| **LiveKit Server** | (kök / `livekit.yaml`) | LiveKit | Gerçek zamanlı ses/görüntü (WebRTC) sunucusu |
| **Agent** | `agent/` | Python 3.11 + LiveKit Agents | Sesli yapay zeka ajanı (STT / LLM / TTS) |
| **Frontend** | `frontend/` | Next.js 15 + React 19 (pnpm) | Kullanıcı arayüzü (dijital insan / avatar) |

Projeyi sıfırdan çalıştırmanın iki yolu vardır:

- **A Yöntemi — Docker Compose** (en kolay, her şeyi tek komutla ayağa kaldırır) → [Bölüm A](#a-yöntemi--docker-compose-önerilen)
- **B Yöntemi — Manuel / Lokal Geliştirme** (her bileşeni ayrı çalıştırma, hot-reload geliştirme için) → [Bölüm B](#b-yöntemi--manuel--lokal-geliştirme)

---

## Ön Koşullar (Her İki Yöntem İçin)

Aşağıdaki anahtarlara/hesaplara ihtiyacınız olacak (ajanın STT/LLM/TTS özellikleri için):

- **ElevenLabs** API anahtarı (TTS / sesli yanıt için) — `ELEVEN_API_KEY`
- **Azure Speech** anahtarı + bölgesi (STT için, opsiyonel) — `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`
- Bir **LLM** sağlayıcısı (OpenAI uyumlu) — `MODEL_NAME`, `BASE_URL`, `API_KEY`

> Not: Lokal geliştirmede LiveKit kimlik bilgileri `livekit.yaml` içindeki geliştirme anahtarıyla gelir:
> - `LIVEKIT_API_KEY = devkey`
> - `LIVEKIT_API_SECRET = secretsecretsecretsecretsecretsecret`
> - `LIVEKIT_URL = ws://localhost:7880` (Docker içinde `ws://livekit:7880`)

---

## A Yöntemi — Docker Compose (Önerilen)

Bu yöntemde LiveKit Server, Agent ve Frontend üç servis olarak otomatik ayağa kalkar.

### Gereksinimler

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Docker Engine + Docker Compose v2)

### Adımlar

**1. Depoyu klonlayın ve klasöre girin**

```powershell
git clone <repo-url> livekit_dh
cd livekit_dh
```

**2. Agent ortam değişkenleri dosyasını oluşturun**

`agent/.env.example` dosyasını `agent/.env` olarak kopyalayın:

```powershell
Copy-Item agent\.env.example agent\.env
```

Ardından `agent\.env` dosyasını açıp değerleri doldurun:

```env
# Docker içinde LiveKit URL'i compose tarafından otomatik veriliyor (ws://livekit:7880),
# ama yine de dolu kalması zararsızdır.
LIVEKIT_URL=ws://livekit:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secretsecretsecretsecretsecretsecret

ELEVEN_API_KEY=<elevenlabs_anahtariniz>
ELEVEN_BASE_URL=
ELEVEN_VOICE_ID=<ses_id>
ELEVEN_MODEL_ID=eleven_multilingual_v2

AZURE_SPEECH_KEY=<azure_anahtariniz>
AZURE_SPEECH_REGION=<bolge_orn_westeurope>

MODEL_NAME=<llm_model_adi>
BASE_URL=<llm_base_url>
API_KEY=<llm_api_anahtariniz>
```

**3. Frontend ortam değişkenleri dosyasını oluşturun**

`frontend/.env.example` dosyasını `frontend/.env` olarak kopyalayın (compose `./frontend/.env` dosyasını okur):

```powershell
Copy-Item frontend\.env.example frontend\.env
```

`frontend\.env` içeriği:

```env
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secretsecretsecretsecretsecretsecret
LIVEKIT_URL=ws://livekit:7880
```

**4. Tüm servisleri build edip başlatın**

```powershell
docker compose up --build
```

> İlk build birkaç dakika sürebilir (Python bağımlılıkları + ONNX modelleri + pnpm paketleri indirilir).

**5. Uygulamayı açın**

Tarayıcıdan: **http://localhost:3001**

| Servis | Adres |
| --- | --- |
| Frontend | http://localhost:3001 |
| LiveKit Server | ws://localhost:7880 |

**Durdurmak için:** `Ctrl + C`, ardından kapatmak için:

```powershell
docker compose down
```

---

## B Yöntemi — Manuel / Lokal Geliştirme

Üç terminal penceresi gerekir: (1) LiveKit Server, (2) Agent, (3) Frontend.

### Gereksinimler

- **Docker** (sadece LiveKit Server'ı çalıştırmak için) — ya da [LiveKit Server binary](https://github.com/livekit/livekit/releases)
- **Python 3.11+** (`agent/` için)
- **Node.js 20+** ve **pnpm 9** (`frontend/` için)
  ```powershell
  corepack enable
  corepack prepare pnpm@9.15.9 --activate
  ```

---

### Terminal 1 — LiveKit Server

Kök dizindeki `livekit.yaml` yapılandırmasıyla sunucuyu Docker ile başlatın:

```powershell
docker run --rm `
  -p 7880:7880 -p 7881:7881 -p 7882:7882/udp `
  -v ${PWD}\livekit.yaml:/etc/livekit.yaml:ro `
  livekit/livekit-server:latest --config /etc/livekit.yaml
```

Sunucu `ws://localhost:7880` adresinde çalışır.

---

### Terminal 2 — Agent (Python)

**1. `agent/` klasörüne girin ve sanal ortam oluşturun**

```powershell
cd agent
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

**2. Bağımlılıkları kurun**

```powershell
pip install --upgrade pip
pip install -r requirements.txt
```

> İsteğe bağlı: gürültü filtresi (DeepFilter) için `pip install -r requirements-deepfilter.txt`

**3. `.env` dosyasını oluşturun**

```powershell
Copy-Item .env.example .env
```

`agent\.env` dosyasını doldurun (lokal için `LIVEKIT_URL=ws://localhost:7880`):

```env
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secretsecretsecretsecretsecretsecret

ELEVEN_API_KEY=<elevenlabs_anahtariniz>
ELEVEN_VOICE_ID=<ses_id>
ELEVEN_MODEL_ID=eleven_multilingual_v2

AZURE_SPEECH_KEY=<azure_anahtariniz>
AZURE_SPEECH_REGION=<bolge>

MODEL_NAME=<llm_model_adi>
BASE_URL=<llm_base_url>
API_KEY=<llm_api_anahtariniz>
```

**4. Model dosyalarını indirin (ilk seferde)**

```powershell
python voice_agent_configurable.py download-files
```

**5. Ajanı geliştirme modunda başlatın**

```powershell
python voice_agent_configurable.py dev
```

---

### Terminal 3 — Frontend (Next.js)

**1. `frontend/` klasörüne girin**

```powershell
cd frontend
```

**2. Bağımlılıkları kurun** (vendor içindeki `furenderkit` tarball'ı dahil)

```powershell
pnpm install --frozen-lockfile
```

**3. Ortam değişkenleri dosyasını oluşturun**

Lokal geliştirmede Next.js `.env.local` dosyasını kullanır:

```powershell
Copy-Item .env.example .env.local
```

`frontend\.env.local` içeriği:

```env
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secretsecretsecretsecretsecretsecret
LIVEKIT_URL=ws://localhost:7880
```

**4. Geliştirme sunucusunu başlatın**

```powershell
pnpm dev
```

**5. Uygulamayı açın**

Tarayıcıdan: **http://localhost:3000**

---

## Hızlı Özet

| Adım | A (Docker) | B (Manuel) |
| --- | --- | --- |
| LiveKit | Otomatik | `docker run ... livekit-server` |
| Agent .env | `agent/.env` | `agent/.env` |
| Frontend .env | `frontend/.env` | `frontend/.env.local` |
| Başlatma | `docker compose up --build` | 3 ayrı terminal |
| Arayüz | http://localhost:3001 | http://localhost:3000 |

---

## Sık Karşılaşılan Sorunlar

- **Frontend ajana bağlanamıyor / "agent not connecting":** Üç bileşenin de (LiveKit, Agent, Frontend) çalıştığından ve aynı `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` değerlerini kullandığından emin olun.
- **`pnpm install` `furenderkit` hatası veriyor:** `frontend/vendor/furenderkit-1.7.1.tgz` dosyasının mevcut olduğundan emin olun (depoyla birlikte gelir).
- **Agent başlarken model indirme hatası:** `python voice_agent_configurable.py download-files` komutunu internet bağlantısı varken yeniden çalıştırın.
- **Port çakışması:** 7880/7881/7882, 3000 veya 3001 portları başka bir uygulama tarafından kullanılıyorsa onları kapatın.
- **PowerShell'de venv aktivasyonu engellendi:** `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` komutunu çalıştırıp tekrar deneyin.
</content>
</invoke>
