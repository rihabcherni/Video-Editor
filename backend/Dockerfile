FROM node:20-slim

# Install ffmpeg, yt-dlp, and openai-whisper (Python)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    python3-venv \
    libgomp1 \
    curl \
    && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && python3 -m venv /opt/whisper-venv \
    && /opt/whisper-venv/bin/pip install --no-cache-dir -U pip \
    && /opt/whisper-venv/bin/pip install --no-cache-dir faster-whisper \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Use venv python for openai-whisper by default
ENV WHISPER_PY_BIN=/opt/whisper-venv/bin/python

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3005
CMD ["node", "dist/index.js"]
