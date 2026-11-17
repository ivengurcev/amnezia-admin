FROM amneziavpn/amneziawg-go:3.1.20260828 AS builder

RUN apk add --no-cache \
    build-base \
    cmake \
    git

WORKDIR /app

COPY packages/server-cpp/CMakeLists.txt ./
COPY packages/server-cpp/src/ ./src/

RUN cmake -S . -B build -DCMAKE_BUILD_TYPE=Release \
    && cmake --build build --target amnezia-admin


FROM amneziavpn/amneziawg-go:3.1.20260828

RUN apk add --no-cache libstdc++ libgcc

COPY --from=builder /app/build/amnezia-admin /usr/local/bin/amnezia-admin


COPY docker/entrypoint.dev.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

CMD ["/usr/local/bin/amnezia-admin"]