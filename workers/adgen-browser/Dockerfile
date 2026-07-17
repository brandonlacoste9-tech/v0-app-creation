# AdGen Browser Worker — run on Fly / Railway / any Docker host (NOT Netlify)
FROM mcr.microsoft.com/playwright:v1.52.0-jammy

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev 2>/dev/null || npm install --omit=dev
COPY tsconfig.json ./
COPY src ./src
RUN npm install -g tsx@4.19.2

ENV PORT=8787
ENV NODE_ENV=production
EXPOSE 8787

CMD ["tsx", "src/server.ts"]
