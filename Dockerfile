
# ETAPA 1 — Build
FROM node:24-bookworm-slim AS build

WORKDIR /app

RUN apt-get update && \
    apt-get install --no-install-recommends -y python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json .npmrc ./
COPY Model/package.json Model/package.json
COPY Controller/package.json Controller/package.json
COPY View/package.json View/package.json

RUN npm ci

COPY . .

RUN npm run build

# ETAPA 2 — Runtime
FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY --from=build /app /app

RUN mkdir -p /app/data

EXPOSE 3000

# ETAPA 3 — API isolada (opcional)
FROM runtime AS api

CMD ["npm", "run", "start", "--workspace", "@pit/controller"]

# ETAPA 4 — Frontend isolado (opcional)
FROM runtime AS frontend

CMD ["npm", "run", "start", "--workspace", "@pit/view"]

# ETAPA 5 — Frontend + Backend combinados
FROM runtime AS combined

CMD ["npm", "run", "start:combined"]
