FROM node:22-bookworm-slim

WORKDIR /app

# Build tools to compile better-sqlite3 against this image's glibc
# (prebuilt binaries may require a newer glibc than bookworm ships)
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ chromium fonts-liberation \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --loglevel=error \
  && rm -rf node_modules/better-sqlite3/prebuilds \
  && cd node_modules/better-sqlite3 && npx node-gyp rebuild

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
