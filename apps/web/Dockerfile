FROM node:20-alpine
WORKDIR /app/apps/web
COPY apps/web/dist ./dist
COPY apps/web/server.js .
EXPOSE 5192
CMD ["node", "server.js"]
