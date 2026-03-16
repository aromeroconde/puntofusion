# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Instalar dependencias necesarias para Prisma y build
RUN apt-get update && apt-get install -y openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

# Generar cliente de Prisma y compilar TS
RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Instalar openssl para Prisma en runtime
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "start"]
