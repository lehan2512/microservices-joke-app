FROM node:22-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
# ETL has no web server, so no EXPOSE needed
CMD ["node", "etl.js"]