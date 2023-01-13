FROM node:18-alpine

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
