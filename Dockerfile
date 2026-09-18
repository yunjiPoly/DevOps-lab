FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
USER node
EXPOSE 8080
CMD ["node", "src/server.js"]
