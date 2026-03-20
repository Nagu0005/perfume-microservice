FROM node:18-alpine

ENV NODE_ENV=production

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

USER node

EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO- http://localhost:8090/health || exit 1

CMD ["npm", "start"]
