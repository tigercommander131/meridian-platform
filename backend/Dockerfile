# PARASOL EMS — backend (Express + PostgreSQL client)
FROM node:20-bookworm-slim

WORKDIR /app

# Native build deps for bcrypt (compiles if no prebuilt binary is available).
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

# Apply pending migrations, then start the server.
CMD ["sh", "-c", "node src/migrations/run.js up && node src/server.js"]
