# Build Stage
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
# Install all dependencies (including dev for tsc)
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production Stage
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm install --only=production

# Copy built assets from builder
COPY --from=builder /app/dist ./dist
# Copy prisma schema if needed for runtime (though usually client is enough, but migrations/generate might be needed)
COPY --from=builder /app/prisma ./prisma
# Generate Prisma Client in production
RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "start"]
