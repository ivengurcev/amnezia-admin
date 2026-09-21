#!/bin/sh
set -eu

INTERFACE="${AWG_INTERFACE:-awg-test}"
ADDRESS="${AWG_ADDRESS:-10.90.0.1/24}"
PORT="${AWG_PORT:-18443}"
KEY_FILE="/data/server.key"

mkdir -p /data
chmod 700 /data

if [ ! -f "$KEY_FILE" ]; then
    umask 077
    awg genkey > "$KEY_FILE"
fi

echo "Starting amneziawg-go on $INTERFACE..."
amneziawg-go -f "$INTERFACE" &
AWG_PID=$!

cleanup() {
    kill "$AWG_PID" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

sleep 1

awg set "$INTERFACE" \
    private-key "$KEY_FILE" \
    listen-port "$PORT"

ip addr replace "$ADDRESS" dev "$INTERFACE"
ip link set up dev "$INTERFACE"

echo
echo "=== AWG ==="
awg show "$INTERFACE"

echo
echo "=== Starting application ==="

exec "$@"
