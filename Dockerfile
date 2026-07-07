# Multi-stage Docker build for production-ready, ultra-lean container images
# Suitable for standalone local installations, private cloud clusters, and commercial distribution.

# Stage 1: Compile frontend and bundle backend server
FROM node:18-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# Copy application code
COPY . .

# Build production React SPA assets + esbuild-bundled backend server
RUN npm run build

# Stage 2: Lean runtime runner
FROM node:18-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy package definitions and install ONLY production-essential npm dependencies
COPY package.json package-lock.json* ./
RUN npm ci --only=production || npm install --production

# Import compiled front-end and back-end bundles from the compiler stage
COPY --from=builder /app/dist ./dist

# Expose port 3000 (standard ingress port)
EXPOSE 3000

# Fire up the bundled CommonJS production server
CMD ["node", "dist/server.cjs"]
