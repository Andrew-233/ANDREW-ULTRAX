# Referenced by `npm run docker:build`; the repo shipped docker scripts with no Dockerfile.
FROM node:20-bookworm-slim

# ffmpeg is invoked via spawn('ffmpeg', ...) in lib/sticker.js and fluent-ffmpeg
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install before copying source so dependency layers stay cached
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps --no-audit --no-fund

COPY . .

# Session and mutable state must live outside the image layer
ENV NODE_ENV=production
VOLUME ["/app/session", "/app/data"]

# index.js reads SESSION_ID from the environment; without it the bot expects a TTY for QR.
CMD ["node", "index.js"]
