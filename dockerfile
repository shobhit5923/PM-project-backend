# Dockerfile
FROM node:20

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm install

COPY . .

RUN npm run build

EXPOSE 4000

CMD ["npm", "start"]
