FROM node:18-alpine AS base

# Install necessary packages for ZIP extraction and Node version management
RUN apk add --no-cache \
    git \
    unzip \
    zip \
    curl \
    bash \
    python3 \
    make \
    g++

# Install NVM (Node Version Manager)
ENV NVM_DIR /usr/local/nvm
ENV NODE_VERSION 18.17.0

RUN mkdir -p $NVM_DIR && \
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install multiple Node versions
RUN . $NVM_DIR/nvm.sh && \
    nvm install 18.17.0 && \
    nvm install 19.9.0 && \
    nvm install 20.5.0 && \
    nvm install 21.0.0 && \
    nvm alias default 18.17.0

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application files
COPY server.js ./
COPY public ./public

# Create home directory with proper permissions (changed from bot_files)
RUN mkdir -p /app/home && \
    chmod 755 /app/home && \
    mkdir -p /app/logs && \
    chmod 755 /app/logs

# Expose port
EXPOSE $PORT

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:$PORT/api/health || exit 1

# Start the server
CMD ["npm", "start"]