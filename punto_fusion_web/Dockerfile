FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git
RUN git clone https://github.com/aromeroconde/puntofusion.git /tmp/repo
RUN cp -a /tmp/repo/punto_fusion_web/dist/* /usr/share/nginx/html/
RUN rm -rf /tmp/repo

FROM nginx:alpine
COPY --from=builder /usr/share/nginx/html /usr/share/nginx/html

RUN cat > /etc/nginx/conf.d/default.conf << 'EOF'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://puntofusion-punto-fusion-api-1:3100;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF
