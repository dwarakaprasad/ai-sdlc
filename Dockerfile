FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# The app's defaults, /app/data and /app/curricula on port 3000, are mounted from the host (see docker-compose.yml).
EXPOSE 3000

CMD ["node_modules/.bin/tsx", "src/server/main.ts"]
