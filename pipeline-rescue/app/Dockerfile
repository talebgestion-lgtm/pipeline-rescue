FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json ./
COPY README.md ./
COPY .env.example ./
COPY server.js ./
COPY data ./data
COPY lib ./lib
COPY public ./public
COPY scripts ./scripts

ENV NODE_ENV=production
ENV PORT=4179
ENV PIPELINE_RESCUE_RUNTIME_DIR=/var/lib/pipeline-rescue/runtime

RUN mkdir -p /var/lib/pipeline-rescue/runtime

EXPOSE 4179
VOLUME ["/var/lib/pipeline-rescue/runtime"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '4179') + '/health/live').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"

CMD node scripts/bootstrap-runtime.js && node server.js
