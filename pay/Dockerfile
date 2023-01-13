FROM node:18-alpine

RUN apk add --no-cache tini
# Tini is now available at /sbin/tini
ENTRYPOINT ["/sbin/tini", "--"]

WORKDIR /app

COPY merchant_id.crt.pem ./
COPY merchant_id.key.pem ./

COPY package.json ./
COPY tsconfig.json ./
COPY yarn.lock ./
COPY src ./src

RUN yarn
RUN yarn build

EXPOSE 3443

CMD ["node", "./bin/app.js"]
