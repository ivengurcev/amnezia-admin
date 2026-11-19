
# React build
FROM node:24-alpine AS web-builder

WORKDIR /app

RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml ./
COPY packages/web/package.json ./packages/web/package.json

RUN yarn install --immutable

COPY packages/web/ ./packages/web/

RUN yarn workspace @amnezia-admin/web build


# C++ build
FROM amneziavpn/amneziawg-go:3.1.20260828 AS builder

RUN apk add --no-cache \
    build-base \
    cmake \
    git \
    openssl-dev

WORKDIR /app

COPY packages/server-cpp/CMakeLists.txt ./
COPY packages/server-cpp/src/ ./src/

ARG BUILD_TYPE=Release

RUN --mount=type=cache,target=/app/build,sharing=locked \
    cmake -S . -B build -DCMAKE_BUILD_TYPE=$BUILD_TYPE \
    && cmake --build build --target amnezia-admin --parallel 4 \
    && cp build/amnezia-admin /tmp/amnezia-admin


# Runtime
FROM amneziavpn/amneziawg-go:3.1.20260828

RUN apk add --no-cache libstdc++ libgcc libcrypto3

COPY --from=builder /tmp/amnezia-admin /usr/local/bin/amnezia-admin
COPY --from=web-builder /app/packages/web/dist/ /app/web/

COPY docker/entrypoint.dev.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

CMD ["/usr/local/bin/amnezia-admin"]
