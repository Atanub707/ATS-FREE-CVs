FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --loglevel=error

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
