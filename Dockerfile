FROM node:20-alpine
RUN apk add --no-cache openssl
EXPOSE 3000
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force
RUN npm remove @shopify/cli
COPY . .
# Set SHOPIFY_APP_URL for the build
ARG SHOPIFY_APP_URL=http://localhost:3000
ENV SHOPIFY_APP_URL=$SHOPIFY_APP_URL
RUN npm run build
CMD ["npm", "run", "docker-start"]
