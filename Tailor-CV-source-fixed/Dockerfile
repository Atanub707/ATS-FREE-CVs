FROM node:22-bookworm-slim

WORKDIR /app

# Build tools to compile better-sqlite3 against this image's glibc
# (prebuilt binaries may require a newer glibc than bookworm ships)
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --loglevel=error \
  && rm -rf node_modules/better-sqlite3/prebuilds \
  && cd node_modules/better-sqlite3 && npx node-gyp rebuild

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
