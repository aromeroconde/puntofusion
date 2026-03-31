FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache git openssl
RUN git clone https://github.com/aromeroconde/puntofusion.git /temp_code && \
    cp -a /temp_code/punto_fusion_mcp_server/* /app/ && \
    rm -rf /temp_code
RUN npm install && npm run build
EXPOSE 3200
CMD ["node", "dist/index.js"]
