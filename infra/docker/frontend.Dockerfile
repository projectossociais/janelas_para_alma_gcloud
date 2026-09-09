# Frontend — build estático (Vite) servido por NGINX. Mesmo build para dev
# em container e para o Cloud Run; o que muda entre ambientes é a variável
# VITE_API_URL injectada em build-time (ver docker-compose.yml).
FROM node:20-alpine AS build

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM nginx:1.27-alpine

COPY infra/nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
