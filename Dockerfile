FROM node:24-bookworm-slim AS build

WORKDIR /app
RUN apt-get update && apt-get install --no-install-recommends -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json .npmrc ./
COPY Model/package.json Model/package.json
COPY Controller/package.json Controller/package.json
COPY View/package.json View/package.json
RUN npm ci

COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
RUN mkdir -p /app/data

FROM runtime AS api
CMD ["npm", "run", "start", "--workspace", "@pit/controller"]

FROM runtime AS frontend
CMD ["npm", "run", "start", "--workspace", "@pit/view"]
