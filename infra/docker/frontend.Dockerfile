# Frontend — build estático (Vite) servido por NGINX. Build único, igual em
# todos os ambientes: o browser fala com `/api/*` na mesma origem, por isso não
# há nenhum URL de API baked na imagem. O que muda entre ambientes é só a
# variável API_URL, lida em RUN-TIME pela imagem oficial do NGINX (envsubst
# sobre infra/nginx/default.conf.template) — o alvo do proxy /api/ só se conhece
# depois do primeiro deploy.
FROM node:20-alpine AS build

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

FROM nginx:1.27-alpine

# /etc/nginx/templates/*.template → a imagem corre envsubst no arranque e
# escreve /etc/nginx/conf.d/default.conf (substituindo o default stock).
COPY infra/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
