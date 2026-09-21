#!/bin/sh
set -eu

INTERFACE="${AWG_INTERFACE:-awg-test}"
ADDRESS="${AWG_ADDRESS:-10.90.0.1/24}"
PORT="${AWG_PORT:-18443}"
JC="${AWG_JC:-4}"
JMIN="${AWG_JMIN:-10}"
JMAX="${AWG_JMAX:-50}"

S1="${AWG_S1:-12}"
S2="${AWG_S2:-12}"
S3="${AWG_S3:-12}"
S4="${AWG_S4:-12}"

H1="${AWG_H1:-1}"
H2="${AWG_H2:-2}"
H3="${AWG_H3:-3}"
H4="${AWG_H4:-4}"

REKEY_AFTER_TIME="${AWG_REKEY_AFTER_TIME:-100-120}"
REKEY_TIMEOUT="${AWG_REKEY_TIMEOUT:-3-7}"
REJECT_AFTER_TIME="${AWG_REJECT_AFTER_TIME:-150-180}"
KEEPALIVE_TIMEOUT="${AWG_KEEPALIVE_TIMEOUT:-5-15}"
MAX_HANDSHAKE_ATTEMPTS="${AWG_MAX_HANDSHAKE_ATTEMPTS:-15-20}"
RANDOM_TRAILERS="${AWG_RANDOM_TRAILERS:-on}"
DISABLE_COOKIES="${AWG_DISABLE_COOKIES:-on}"

HEADER_PROTECTION_KEY_FILE="${AWG_HEADER_PROTECTION_KEY_FILE:-/data/header-protection.key}"
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
    jc "$JC" \
    jmin "$JMIN" \
    jmax "$JMAX" \
    s1 "$S1" \
    s2 "$S2" \
    s3 "$S3" \
    s4 "$S4" \
    h1 "$H1" \
    h2 "$H2" \
    h3 "$H3" \
    h4 "$H4" \
    header-protection-key "$HEADER_PROTECTION_KEY_FILE" \
    rekey-after-time "$REKEY_AFTER_TIME" \
    rekey-timeout "$REKEY_TIMEOUT" \
    reject-after-time "$REJECT_AFTER_TIME" \
    keepalive-timeout "$KEEPALIVE_TIMEOUT" \
    max-handshake-attempts "$MAX_HANDSHAKE_ATTEMPTS" \
    random-trailers "$RANDOM_TRAILERS" \
    disable-cookies "$DISABLE_COOKIES"

ip addr replace "$ADDRESS" dev "$INTERFACE"
ip link set up dev "$INTERFACE"

echo
echo "=== AWG ==="
awg show "$INTERFACE"

echo
echo "=== Starting application ==="

exec "$@"
