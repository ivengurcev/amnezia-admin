#!/bin/sh
set -eu

touch /run/tls-renewed

if [ -f /run/amnezia-admin.pid ]; then
    kill -TERM "$(cat /run/amnezia-admin.pid)" 2>/dev/null || true
fi
