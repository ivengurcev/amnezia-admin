# React-админка AmneziaWG

Сборка из корня: `yarn workspace @amnezia-admin/web build`.
Проверки: `yarn workspace @amnezia-admin/web typecheck` и
`yarn workspace @amnezia-admin/web test`.
Vite используется для сборки; запуск отдельного frontend HTTP-сервера не требуется.

`Dockerfile.cpp` собирает `packages/web/dist` в этапе `web-builder` и копирует
его в `/app/web` C++ runtime. Node.js, Yarn и Vite не копируются в runtime.
C++ административный сервер отдаёт `/app/web` и `/api` с одного origin.
Существующие cookie-сессии и маршруты `/api/auth/login`, `/api/auth/me`,
`/api/auth/logout` сохранены; токены не хранятся в localStorage.

## Контракт подключений

- `GET /api/peers`: массив `{ publicKey, name, allowedIps, isAdmin, endpoint,
  latestHandshake, rx, tx }`. `endpoint` — строка или null, handshake — Unix
  seconds (0 означает отсутствие), rx/tx — байты. Идентификатор — publicKey.
- `POST /api/peers`: JSON `{ name }`, ответ содержит publicKey и allowedIps.
- `POST /api/peers/links`: JSON `{ publicKey, ttlSeconds: 86400 }`, ответ `{ url }`.
- `DELETE /api/peers`: JSON `{ publicKey }`, успешный ответ 204.

Статус вычисляется в браузере: handshake от 0 до 180 секунд назад включительно
означает «Подключён». Нулевой, некорректный и будущий timestamp не считается
подключением. Статус пересчитывается раз в секунду без дополнительных запросов;
новые метрики загружаются кнопкой «Обновить».
Создание и выпуск ссылки — отдельные операции. При ошибке второй операции
повторяется только выпуск ссылки, подключение повторно не создаётся.
Скачивание .conf и переименование в административном интерфейсе отсутствуют.
Clipboard API требует защищённый контекст (HTTPS или localhost); при его
недоступности ссылка остаётся в поле для ручного копирования.

## Оставшиеся изменения C++ (здесь не реализованы)

1. Текущий POST /api/peers игнорирует тело и вызывает createPeer() без имени.
   Нужно читать JSON, проверять trim(name) на длину 1–100 и сохранять имя через
   createPeer(name). Клиент отправляет имя, но не подменяет серверное значение
   локальным кэшем. Пока backend не исправлен, созданные подключения без имени.
   Клиент использует только publicKey; privateKey в ответе ему не требуется.
2. Публичный сервер, обслуживающий `/setup/:token`, должен отдавать:

   | URL | Файл в runtime |
   | --- | --- |
   | `/assets/theme.css` | `/app/web/assets/theme.css` |
   | `/assets/setup.css` | `/app/web/assets/setup.css` |

   Оба файла копируются Vite из `public/assets` в `dist/assets` без хеша.
   В `<head>` публичного HTML нужны:

   ```html
   <link rel="stylesheet" href="/assets/theme.css">
   <link rel="stylesheet" href="/assets/setup.css">
   ```

   Удалить встроенный `<style>` из C++ HTML. setup.css рассчитан на существующие
   `body`, `main`, `.icon`, `h1`, `p`, `form`, `button`, `small`. Для состояний
   активной, истёкшей ссылки и ошибки используется та же разметка.
   Сейчас `/app/web` смонтирован только на административном сервере; публичному
   серверу нужны именно эти CSS-ресурсы, без публикации административных файлов.
   Не подключать к публичной странице административный JS, React или index.html.

Общие дизайн-токены находятся только в `public/assets/theme.css`.
Компонентные стили — CSS Modules; `src/styles.css` содержит глобальный reset.
