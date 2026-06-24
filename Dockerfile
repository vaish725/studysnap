FROM node:20-alpine AS builder

WORKDIR /app

COPY client/package*.json ./client/
RUN cd client && npm install

COPY client/ ./client/
RUN cd client && npm run build

FROM node:20-alpine AS runner

WORKDIR /app

COPY server/package*.json ./
RUN npm install --production

COPY server/ ./
COPY --from=builder /app/client/dist ./public

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "index.js"]
