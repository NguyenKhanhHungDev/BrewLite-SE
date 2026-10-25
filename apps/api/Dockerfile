FROM node:24-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Prisma 7 config yêu cầu DATABASE_URL dù generate không kết nối DB.
# Đây là URL giả chỉ dùng lúc build, KHÔNG phải secret/runtime URL.
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/brewlite?schema=public" \
    npx prisma generate --config ./prisma7.config.ts && npm run build

EXPOSE 3001

# Khi khởi động: chờ DB healthcheck từ Compose, apply migration,
# seed 10 sản phẩm (script idempotent), rồi chạy NestJS production.
CMD ["sh", "-c", "npx prisma migrate deploy --config ./prisma7.config.ts && npx prisma db seed --config ./prisma7.config.ts && npm run start:prod"]