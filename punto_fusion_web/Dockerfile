# Etapa 1: Construcción
FROM node:20-alpine AS build
WORKDIR /app

# Instalar dependencias
COPY package*.json ./
RUN npm install

# Copiar código fuente y construir
COPY . .
RUN npm run build

# Etapa 2: Servidor Web
FROM nginx:alpine
# Copiar el resultado de la construcción al directorio de Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Configuración de nginx para manejar SPA (rutas de React)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
