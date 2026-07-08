FROM node:20-slim

# better-sqlite3 needs build tools to compile its native bindings
# chromium is needed for puppeteer
RUN apt-get update && apt-get install -y python3 make g++ chromium && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 4000

CMD ["node", "server.js"]
