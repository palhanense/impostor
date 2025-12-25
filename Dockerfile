FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
# Install ALL dependencies (including ts-node/typescript)
RUN npm install

COPY . .
RUN npx prisma generate

EXPOSE 3000

# Run directly with ts-node (bypassing build step)
CMD ["npx", "ts-node", "src/server.ts"]
