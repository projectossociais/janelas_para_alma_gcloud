# Frontend — build estático (Vite) servido por NGINX. Mesmo build para dev
# em container e para o Cloud Run; entre ambientes muda:
#   - VITE_API_URL, injectada em build-time (ver docker-compose.yml)
#   - API_URL, lida em RUN-TIME pela imagem oficial do NGINX (envsubst sobre
#     infra/nginx/default.conf.template) — o alvo do proxy /api/ só se conhece
#     depois do primeiro deploy, por isso não pode estar baked na imagem.
FROM node:20-alpine AS build

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM nginx:1.27-alpine

# /etc/nginx/templates/*.template → a imagem corre envsubst no arranque e
# escreve /etc/nginx/conf.d/default.conf (substituindo o default stock).
COPY infra/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
