FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY node_modules ./node_modules
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.js"]
