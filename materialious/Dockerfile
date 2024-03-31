FROM node as build

WORKDIR /app

COPY ./package*.json ./

RUN npm install

COPY . .

RUN echo "VITE_DEFAULT_INVIDIOUS_INSTANCE=VITE_DEFAULT_INVIDIOUS_INSTANCE_PLACEHOLDER" > .env && \
    echo "VITE_DEFAULT_FRONTEND_URL=VITE_DEFAULT_FRONTEND_URL_PLACEHOLDER" > .env && \
    echo "VITE_DEFAULT_SPONSERBLOCK_INSTANCE=VITE_DEFAULT_SPONSERBLOCK_INSTANCE_PLACEHOLDER" > .env && \
    echo "VITE_DEFAULT_RETURNYTDISLIKES_INSTANCE=VITE_DEFAULT_RETURNYTDISLIKES_INSTANCE_PLACEHOLDER" >> .env

RUN npm run build

FROM node AS production

COPY --from=build /app/build .

COPY --from=build /app/package.json .

COPY --from=build /app/package-lock.json .

RUN npm ci --omit dev

EXPOSE 3000

CMD ["node", "."]