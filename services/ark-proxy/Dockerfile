FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build/compile TypeScript (optional, can run with tsx directly)
RUN npm run build || true

EXPOSE 18792

CMD ["node", "--import", "tsx", "index.ts"]
