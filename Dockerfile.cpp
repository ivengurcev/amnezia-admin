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


FROM amneziavpn/amneziawg-go:3.1.20260828

RUN apk add --no-cache libstdc++ libgcc libcrypto3

COPY --from=builder /tmp/amnezia-admin /usr/local/bin/amnezia-admin

COPY docker/entrypoint.dev.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

CMD ["/usr/local/bin/amnezia-admin"]