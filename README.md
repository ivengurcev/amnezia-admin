# Amnezia Admin

Самостоятельно размещаемая панель управления VPN на **AmneziaWG 3.1**. Сервер VPN, административный API, веб-интерфейс и получение TLS-сертификатов работают **в одном Docker-контейнере**.

Проект рассчитан на запуск на собственном Linux VPS. Для установки готового образа не нужны Node.js, C++-компилятор, Nginx или Certbot на хосте.

## Возможности

- Создание и удаление VPN-подключений через веб-панель.
- Просмотр подключений, последнего handshake и объёма переданных данных.
- Администраторы с паролем и доступом к панели только через VPN.
- Одноразовые HTTPS-ссылки для скачивания конфигурации клиента (срок действия — 24 часа).
- Автоматическая генерация ключей и адресов клиентов.
- Получение и продление сертификата Let's Encrypt непосредственно в контейнере, в том числе для публичного IPv4 без домена.
- Сохранение конфигурации VPN, базы SQLite и сертификатов в одном Docker volume.

**Стек:** C++20, cpp-httplib, OpenSSL, SQLiteCpp, AmneziaWG Go 3.1, React, TypeScript, Docker. React собирается заранее и раздаётся C++ сервером; Node.js в финальном образе отсутствует.

## Быстрый запуск на сервере

### Требования

- Linux-сервер с Docker Engine и Docker Compose Plugin.
- Публичный IPv4-адрес, доступный из интернета.
- Открытые входящие **TCP 80**, **TCP 443** и выбранный **UDP-порт VPN** (по умолчанию в примере `18443`).
- Доступный `/dev/net/tun` и возможность запуска контейнера с `NET_ADMIN`.

На хосте не требуется устанавливать Certbot или настраивать reverse proxy. Если сервер использует дополнительные правила firewall для Docker (`DOCKER-USER`), они также должны разрешать перечисленные порты.

### Установка

Скачайте Compose-файл опубликованной версии:

```bash
mkdir -p ~/amnezia-admin && cd ~/amnezia-admin

curl -fsSLO https://raw.githubusercontent.com/ivengurcev/amnezia-admin/main/compose.prod.yml
```

Создайте `.env.prod`: подставьте **свой реальный публичный IP**, email и замените `vX.Y.Z` в `IMAGE_TAG` на реально опубликованный тег образа.

```dotenv
PUBLIC_IP=YOUR_PUBLIC_IPV4
ACME_EMAIL=you@example.com
AWG_PORT=18443
IMAGE_TAG=vX.Y.Z
```

Запустите готовый образ из GitHub Container Registry:

```bash
docker compose --env-file .env.prod -f compose.prod.yml up -d
docker compose --env-file .env.prod -f compose.prod.yml logs -f
```

При первом запуске контейнер создаёт ключи AmneziaWG, поднимает интерфейс VPN и запрашивает сертификат Let's Encrypt через TCP 80. После получения сертификата C++ сервер начинает обслуживать публичную HTTPS-страницу на TCP 443.

Для проверки HTTPS используйте:

```bash
curl -I https://YOUR_PUBLIC_IPV4/assets/setup.css
```

## Создание администратора

В каталоге с `compose.prod.yml` выполните:

```bash
docker compose --env-file .env.prod -f compose.prod.yml \
  exec amnezia-admin \
  /usr/local/bin/amnezia-admin add "Admin" --admin
```

Введите пароль администратора и подтвердите его. CLI выдаст **одноразовую HTTPS-ссылку** вида:

```text
https://YOUR_PUBLIC_IPV4/setup/<token>
```

Откройте ссылку, скачайте конфигурацию и импортируйте её в совместимый клиент AmneziaWG. После подключения к VPN административная панель доступна по адресу:

**http://10.90.0.1:3002/**

Это внутренний адрес VPN; административный TCP-порт **не публикуется** в интернет. Авторизация проверяет VPN-IP администратора и пароль. 

Не публикуйте одноразовую ссылку, скачанный конфиг или `PrivateKey`: они предоставляют доступ к VPN. Если ключ раскрыт, удалите соответствующее подключение и создайте новое.

## Управление клиентами через CLI

Команды выполняются внутри работающего контейнера:

```bash
# Создать обычное подключение и получить ссылку
docker compose --env-file .env.prod -f compose.prod.yml \
  exec amnezia-admin /usr/local/bin/amnezia-admin add "Laptop"

# Список подключений
docker compose --env-file .env.prod -f compose.prod.yml \
  exec amnezia-admin /usr/local/bin/amnezia-admin list

# Только администраторы
docker compose --env-file .env.prod -f compose.prod.yml \
  exec amnezia-admin /usr/local/bin/amnezia-admin list --admin

# Создать новую одноразовую ссылку для существующего клиента
docker compose --env-file .env.prod -f compose.prod.yml \
  exec amnezia-admin /usr/local/bin/amnezia-admin link "PUBLIC_KEY"
```

Создавать и удалять подключения также можно в веб-панели. Для повторной выдачи конфигурации используйте новую одноразовую ссылку.

## Локальная разработка

Для разработки используется `compose.cpp.yml`: сервер запускается по HTTP и не обращается к Let's Encrypt.

В корне репозитория:

```bash
printf 'AWG_PORT=18443\n' > .env
docker volume create amnezia-cpp-data
docker compose -f compose.cpp.yml up -d --build
```

Адреса для разработки:

| Сервис | Адрес |
| --- | --- |
| React-админка | http://localhost:3002 |
| Публичные страницы выдачи | http://localhost:3001/setup/… |
| VPN | UDP-порт из `.env` |

В dev-режиме вход выполняется по публичному ключу и паролю. Для создания администратора:

```bash
docker compose -f compose.cpp.yml \
  exec amnezia-admin /usr/local/bin/amnezia-admin add "Dev Admin" --admin
```

Логи и остановка:

```bash
docker compose -f compose.cpp.yml logs -f
docker compose -f compose.cpp.yml down
```

**Не запускайте development Compose на публичном VPS без дополнительных ограничений:** он публикует порт административной панели `3002` наружу и использует HTTP.

## Настройки

Основные параметры production задаются через `.env.prod` и `compose.prod.yml`:

| Переменная | Назначение |
| --- | --- |
| `PUBLIC_IP` | Публичный IPv4 VPS, на который Certbot получает сертификат |
| `ACME_EMAIL` | Email для регистрации в Let's Encrypt |
| `AWG_PORT` | UDP-порт AmneziaWG |
| `AWG_INTERFACE` | Имя VPN-интерфейса; в Compose — `awg0` |
| `AWG_ADDRESS` | Адрес интерфейса внутри VPN; по умолчанию `10.90.0.1/24` |
| `AWG_ENDPOINT_HOST` | Адрес сервера в клиентских конфигурациях |
| `SETUP_BASE_URL` | Базовый URL одноразовых ссылок |
| `ADMIN_DEV_MODE` | `1` — dev/HTTP; `0` — production/HTTPS |

Дополнительные параметры AmneziaWG (`AWG_JC`, `AWG_JMIN`, `AWG_JMAX`, `AWG_S1`–`AWG_S4`, `AWG_H1`–`AWG_H4` и другие) имеют значения по умолчанию в `docker/entrypoint.dev.sh`. Меняйте их только при необходимости и учитывайте совместимость с уже выданными конфигурациями клиентов.

Клиентские конфигурации по умолчанию используют `DNS=1.1.1.1`, `MTU=1280` и `AllowedIPs=0.0.0.0/0`.

## Хранение данных, сертификаты и обновление

В production используется том `amnezia-admin-data`, смонтированный в `/data`. В нём находятся:

- `amnezia-admin.db` — SQLite с клиентами, администраторами и одноразовыми ссылками;
- `server.key` и `header-protection.key` — ключи сервера VPN;
- `letsencrypt/` — учётная запись ACME и сертификаты.

Certbot внутри контейнера проверяет продление каждые шесть часов. При успешном обновлении сертификата перезапускается C++ сервер, а не весь VPN. Для работы проверки Let's Encrypt порт **TCP 80 должен оставаться доступным**.

Для обновления измените `IMAGE_TAG` в `.env.prod` на новый опубликованный тег образа и выполните:

```bash
docker compose --env-file .env.prod -f compose.prod.yml pull
docker compose --env-file .env.prod -f compose.prod.yml up -d
```

Docker volume при обновлении сохраняется. Перед переносом или обновлением сервера рекомендуется сделать резервную копию тома `/data`; в нём содержатся секретные ключи и база подключений.

## Сборка и публикация образа

Локальная сборка production-образа:

```bash
docker build -f Dockerfile.cpp \
  --build-arg BUILD_TYPE=Release \
  -t amnezia-admin:local .
```

GitHub Actions (`.github/workflows/docker.yml`) собирает и публикует образ в `ghcr.io/ivengurcev/amnezia-admin` при отправке тега `v*`:

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

На VPS устанавливается **готовый образ**, а не исходный код проекта. Каждому серверу нужны только Compose-файл и собственные значения окружения.

## Структура проекта

```text
packages/server-cpp/   C++ API, VPN-логика, SQLite и CLI
packages/web/          React/TypeScript, административный интерфейс
docker/                Скрипты запуска VPN, TLS и продления
Dockerfile.cpp         Многоэтапная сборка одного production-образа
compose.cpp.yml        Локальная разработка
compose.prod.yml       Запуск опубликованного образа
.github/workflows/     Публикация в GHCR по тегу версии
```

Проект находится в разработке. Перед использованием после обновления обязательно проверяйте VPN-подключение, доступ к панели и прохождение трафика клиента через туннель.
