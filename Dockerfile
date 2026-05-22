FROM node:20-alpine

WORKDIR /app

# No dependencies to install — server.js uses Node built-ins only.
COPY package.json ./
COPY server.js ./
COPY index.html ./

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
