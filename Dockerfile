FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates ffmpeg python3 python3-venv \
    && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/yt-dlp
ENV PATH="/opt/yt-dlp/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" NODE_ENV=production PORT=10000 DOWNLOAD_DIR=/tmp/mono-downloads FFMPEG_DIR=/usr/bin
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY --chown=node:node package.json *.mjs ./
COPY --chown=node:node dist ./dist
USER node
EXPOSE 10000
CMD ["node", "server.mjs"]
