
#!/bin/sh
set -eu

: "${PUBLIC_IP:?PUBLIC_IP is required}"
: "${ACME_EMAIL:?ACME_EMAIL is required}"

CERT_DIR="/data/letsencrypt"
CERT_WORK="/tmp/certbot-work"
CERT_LOGS="/tmp/certbot-logs"

export TLS_CERT_FILE="$CERT_DIR/live/$PUBLIC_IP/fullchain.pem"
export TLS_KEY_FILE="$CERT_DIR/live/$PUBLIC_IP/privkey.pem"

certbot_run() {
    certbot \
        --config-dir "$CERT_DIR" \
        --work-dir "$CERT_WORK" \
        --logs-dir "$CERT_LOGS" \
        "$@"
}

mkdir -p "$CERT_DIR"
chmod 700 "$CERT_DIR"

# Первоначальное получение сертификата
if [ ! -s "$TLS_CERT_FILE" ] || [ ! -s "$TLS_KEY_FILE" ]; then
    certbot_run certonly \
        --standalone \
        --non-interactive \
        --agree-tos \
        --email "$ACME_EMAIL" \
        --preferred-profile shortlived \
        --ip-address "$PUBLIC_IP"
else
    # Проверка необходимости продления после перезапуска контейнера
    certbot_run renew --quiet
fi

# Периодическое продление каждые 6 часов
(
    while sleep 21600; do
        certbot_run renew \
            --quiet \
            --deploy-hook /usr/local/bin/tls-renewed.sh \
            || echo "Certificate renewal failed" >&2
    done
) &
RENEW_PID=$!

APP_PID=""

cleanup() {
    trap - EXIT
    [ -z "$APP_PID" ] || kill "$APP_PID" 2>/dev/null || true
    kill "$RENEW_PID" 2>/dev/null || true
}

trap cleanup EXIT
trap 'exit 0' INT TERM

# Перезапускаем только C++ сервер, не AmneziaWG
while :; do
    /usr/local/bin/amnezia-admin &
    APP_PID=$!
    echo "$APP_PID" > /run/amnezia-admin.pid

    status=0
    wait "$APP_PID" || status=$?

    APP_PID=""
    rm -f /run/amnezia-admin.pid

    if [ -f /run/tls-renewed ]; then
        rm -f /run/tls-renewed
        echo "TLS certificate renewed. Restarting C++ server."
        continue
    fi

    exit "$status"
done
