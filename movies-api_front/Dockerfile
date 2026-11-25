FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm i
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=4000
COPY --from=builder /app/dist/movies-api_front ./dist/movies-api_front
USER node
EXPOSE 4000
CMD ["node", "dist/movies-api_front/server/server.mjs"]
