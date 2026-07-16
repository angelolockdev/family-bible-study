FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2

WORKDIR /app
COPY package.json ./package.json
COPY *.mjs ./

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

USER node
EXPOSE 3000

CMD ["node", "server.mjs"]
