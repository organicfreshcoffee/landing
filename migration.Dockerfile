# Dockerfile for database migration job
FROM node:18-alpine

WORKDIR /app

# Copy migration script and package.json
COPY scripts/db-migrate.js ./
COPY package*.json ./

# Install only mongodb dependency
RUN npm install mongodb

# Run migration
CMD ["node", "db-migrate.js"]
