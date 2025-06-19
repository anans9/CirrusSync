# Multi-stage Dockerfile for CirrusSync
# Stage 1: Build the React frontend
FROM node:18-alpine as frontend-builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the frontend
RUN npm run build

# Stage 2: Rust build environment (for potential backend API)
FROM rust:1.75-alpine as rust-builder

# Install system dependencies
RUN apk add --no-cache \
    musl-dev \
    pkgconfig \
    openssl-dev \
    gcc \
    libc-dev

# Set working directory
WORKDIR /app

# Copy Rust source
COPY src-tauri/ ./

# Build Rust backend (if needed for web API)
# Note: This would need to be adapted for web deployment
# RUN cargo build --release

# Stage 3: Production web server
FROM nginx:alpine

# Install additional tools
RUN apk add --no-cache curl

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Set ownership
RUN chown -R nextjs:nodejs /usr/share/nginx/html && \
    chown -R nextjs:nodejs /var/cache/nginx && \
    chown -R nextjs:nodejs /var/log/nginx && \
    chown -R nextjs:nodejs /etc/nginx/conf.d

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

# Development stage (optional)
FROM node:18-alpine as development

# Install system dependencies for Tauri development
RUN apk add --no-cache \
    curl \
    wget \
    file \
    build-base \
    openssl-dev \
    gtk+3.0-dev \
    webkit2gtk-dev \
    librsvg-dev \
    rust \
    cargo

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY . .

# Expose development port
EXPOSE 1420

# Start development server
CMD ["npm", "run", "dev"]
