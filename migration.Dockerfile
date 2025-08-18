# Dockerfile for database migration job
FROM node:18-alpine

WORKDIR /app

# Copy migration script
COPY ./migration-db.js ./

# Create a minimal package.json for dependencies
RUN echo '{"name":"migration","version":"1.0.0","dependencies":{"mongodb":"^6.0.0"}}' > package.json

# Install mongodb dependency
RUN npm install

# Run migration
CMD ["node", "migration-db.js"]
