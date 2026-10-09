FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY dist ./dist
COPY server ./server
COPY deploy/nginx/codeiary.conf /etc/codeiary/codeiary.conf

USER node
EXPOSE 3000
CMD ["node", "server/index.mjs", "--production"]
