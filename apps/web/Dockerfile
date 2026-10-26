FROM node:24-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# URL nội bộ phải sẵn lúc next build cho rewrites().
ARG API_INTERNAL_URL=http://api:3001
ENV API_INTERNAL_URL=${API_INTERNAL_URL}

RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start"]