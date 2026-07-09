# Video Editor

Éditeur vidéo web complet : import YouTube/Instagram/Facebook, découpage, audio, sous-titres, export MP4.

---

## Stack

| Couche | Technologie |
|--------|-------------|
| Frontend | React 18 + TypeScript + Vite + Tailwind |
| State | Zustand |
| Backend | Fastify + TypeScript |
| Traitement vidéo | FFmpeg (fluent-ffmpeg) |
| Download | yt-dlp |
| Conteneurs | Docker + Docker Compose |

---

## Démarrage rapide (développement local)

### Prérequis

```bash
# Windows — via winget
winget install FFmpeg
winget install yt-dlp

# ou via Scoop
scoop install ffmpeg yt-dlp

# Vérifier
ffmpeg -version
yt-dlp --version
node --version   # >= 18

### 1. Backend

```bash
cd backend
npm install
npm run dev
# → http://localhost:3005
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5175
```