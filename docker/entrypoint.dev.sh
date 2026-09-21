#!/bin/sh
set -eu

INTERFACE="${AWG_INTERFACE:-awg-test}"
ADDRESS="${AWG_ADDRESS:-10.90.0.1/24}"
PORT="${AWG_PORT:-18443}"
KEY_FILE="/data/server.key"
HEADER_PROTECTION_KEY_FILE="/data/header-protection.key"

mkdir -p /data
chmod 700 /data

if [ ! -f "$KEY_FILE" ]; then
    umask 077
    awg genkey > "$KEY_FILE"
fi

if [ ! -f "$HEADER_PROTECTION_KEY_FILE" ]; then
    umask 077
    awg genkey > "$HEADER_PROTECTION_KEY_FILE"
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
    listen-port "$PORT" \
    jc 4 \
    jmin 10 \
    jmax 50 \
    s1 12 \
    s2 12 \
    s3 12 \
    s4 12 \
    h1 1 \
    h2 2 \
    h3 3 \
    h4 4 \
    header-protection-key "$HEADER_PROTECTION_KEY_FILE" \
    rekey-after-time "100-120" \
    rekey-timeout "3-7" \
    reject-after-time "150-180" \
    keepalive-timeout "5-15" \
    max-handshake-attempts "15-20" \
    random-trailers on \
    disable-cookies on

ip addr replace "$ADDRESS" dev "$INTERFACE"
ip link set up dev "$INTERFACE"

echo
echo "=== AWG ==="
awg show "$INTERFACE"

echo
echo "=== Starting application ==="

exec "$@"
