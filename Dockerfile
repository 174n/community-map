FROM node:17-alpine AS BUILD_IMAGE

RUN apk update && apk add curl bash python3 g++ make &&\
    rm -rf /var/cache/apk/*

# install node-prune (https://github.com/tj/node-prune)
RUN curl -sfL https://install.goreleaser.com/github.com/tj/node-prune.sh | bash -s -- -b /usr/local/bin

WORKDIR /usr/src/app

COPY package.json ./

# install dependencies
RUN npm i

COPY . .

# build application
RUN npm run build

RUN npm run migrate

# remove development dependencies
RUN npm prune --production

# run node prune
RUN /usr/local/bin/node-prune

FROM node:17-alpine

WORKDIR /usr/src/app
VOLUME /usr/src/app/data

# copy from build image
COPY data /fresh-data
COPY LICENSE /LICENSE
COPY LICENSE /fresh-data
COPY --from=BUILD_IMAGE /usr/src/app/dist ./dist
COPY --from=BUILD_IMAGE /usr/src/app/data/users.sqlite3 /fresh-data
COPY --from=BUILD_IMAGE /usr/src/app/node_modules ./node_modules

EXPOSE 8080

CMD cp /usr/src/app/data/users.sqlite3 /fresh-data/ && cp -u -r /fresh-data/* /usr/src/app/data && node ./dist/pkg.esm.js

HEALTHCHECK --interval=5s --timeout=5s --retries=3 CMD wget localhost:8080/status -q -O - > /dev/null 2>&1