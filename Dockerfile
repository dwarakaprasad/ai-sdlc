FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Family data and Curricula are mounted from the host (see docker-compose.yml), so they outlive the container.
ENV HOME_TUTOR_DATA_DIR=/app/data \
    HOME_TUTOR_CURRICULA_DIR=/app/curricula \
    PORT=3000
EXPOSE 3000

CMD ["node_modules/.bin/tsx", "src/server/main.ts"]
