# Amnezia Admin Web MVP Design

## Goal

Create a Russian-language responsive administration interface in the new
`packages/web` workspace. The interface lists AWG peers and supports creation,
inline renaming, deletion, and one-time download of the client configuration
returned by the backend.

## Scope

The MVP includes:

- peer list with name, address, connection status, latest handshake, RX, and TX;
- initial loading, empty-list, and load-error states;
- manual refresh;
- peer creation by name;
- immediate `.conf` download through a browser `Blob` after creation;
- inline peer rename;
- peer deletion after explicit confirmation;
- API and validation error messages;
- a simple responsive admin layout usable on mobile widths.

The MVP excludes QR codes, authentication, deep links, repeat configuration
downloads, private-key storage, AWG settings, charts, themes, i18n, and
WebSockets.

## Technology and Workspace

`packages/web` is a Yarn workspace using React, TypeScript, Vite, and ordinary
CSS. It has no UI library or state-management dependency. Vitest, jsdom, and
Testing Library cover user-visible behavior.

Vite sends browser requests to relative `/api/...` URLs and proxies `/api` to
`http://localhost:3001` during development. The backend package and its API
contracts are not changed.

## Structure

- `src/api.ts` owns API types, request functions, JSON parsing, and conversion
  of non-success responses into readable errors.
- `src/App.tsx` owns the peer collection, initial and refresh state, creation
  state, and page-level rendering.
- `src/CreatePeerForm.tsx` owns the new-peer input and displays creation errors.
- `src/PeerRow.tsx` owns per-peer inline rename state, delete state, and local
  operation errors.
- `src/format.ts` formats handshake timestamps and byte counts.
- `src/styles.css` defines the desktop table-like layout and its mobile card
  layout without external styling dependencies.

This split keeps HTTP mechanics separate while avoiding a custom state layer or
hooks that the MVP does not need.

## API Model

A peer returned by `GET /api/peers` has:

- `id: string | null`;
- `publicKey: string`;
- `name: string`;
- `address: string`;
- `connected: boolean`;
- `latestHandshakeAt: string | null`;
- `rxBytes: number`;
- `txBytes: number`.

The POST response additionally contains `privateKey` and `config`. The client
uses `config` only to construct the immediate download. It does not put the
config or private key into application state, local storage, session storage,
logs, or the rendered page.

All mutations use JSON `{ "name": string }` where applicable. DELETE and PATCH
use the API UUID in `peer.id`, never `publicKey`.

## Data Flow

On mount, `App` requests the peer list. Initial loading replaces the content
area; a failed initial request presents an error and retry action. An empty
successful response presents an empty-state message and the creation form.

Manual refresh keeps the current list visible, disables the refresh button,
and replaces the list only after a successful response. A refresh failure is
shown as a page-level error without discarding the existing peers.

After successful creation, the app immediately downloads the response config,
revokes the temporary object URL, clears the input, and reloads the list. The
filename is derived from the normalized peer name, with unsafe filename
characters replaced, and ends in `.conf`.

After successful rename or deletion, the app reloads the list. While a mutation
is in flight, only controls for that peer are disabled. Delete uses
`window.confirm` before sending the request.

Peers with `id: null` remain visible but have rename and delete controls
disabled because the mutation endpoints require an API UUID.

## Validation and Errors

The client trims names and requires between 1 and 100 characters, matching the
backend contract. Client validation prevents an avoidable request, but backend
errors remain authoritative and visible.

`api.ts` attempts to read an `{ error: string }` response for non-success HTTP
statuses. If none is available, it produces a Russian fallback containing the
HTTP status. Network and malformed-response errors also become readable Russian
messages.

Creation errors appear at the form. Rename and delete errors appear within the
affected peer row/card. Load and refresh errors appear at page level.

## Interface

The page uses a restrained admin layout with a top bar titled “Amnezia Admin”,
a centered content area, a peer-section heading, a manual refresh button, and a
compact creation form.

On desktop, peers use aligned table-style columns. On narrow screens, each peer
becomes a card whose values retain visible field labels. Connection state is a
text badge. Handshake uses the browser's Russian locale when a timestamp exists
and displays “Нет данных” otherwise. RX and TX use human-readable binary units.

Controls have visible focus styles, form fields have labels, live errors use an
appropriate alert role, and status is not communicated by color alone.

## Testing and Verification

Frontend tests exercise behavior at the rendered application boundary with
mocked `fetch` and browser download primitives:

- loading followed by populated list;
- empty response;
- load error and retry;
- manual refresh;
- creation request and one-time config download;
- inline rename request;
- confirmed deletion request;
- API mutation error display;
- disabled mutations for a peer with `id: null`;
- formatting of handshake and traffic values.

Required verification commands:

```bash
yarn workspace @amnezia-admin/web typecheck
yarn workspace @amnezia-admin/web build
yarn workspace @amnezia-admin/server typecheck
yarn workspace @amnezia-admin/server test
```

No Docker daemon, AWG binary, tunnel device, external network, or real private
key is used by the frontend tests.
