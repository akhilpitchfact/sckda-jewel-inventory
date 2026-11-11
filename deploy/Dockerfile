# Optional: run in Docker instead of systemd. Build from the project root:
#   docker build -f deploy/Dockerfile -t sckda-jewel .
#   docker run -d --name sckda-jewel -p 127.0.0.1:8080:8080 -v /var/lib/sckda-jewel:/data --restart always sckda-jewel
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080 HOST=0.0.0.0 DATA_DIR=/data TRUST_PROXY=1
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY server ./server
COPY scripts ./scripts
VOLUME /data
EXPOSE 8080
CMD ["node", "--no-warnings", "server/index.mjs"]
