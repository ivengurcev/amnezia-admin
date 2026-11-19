# Web C++ Adaptation Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline. No commits requested.

**Goal:** Adapt the existing React admin to the actual C++ peer contract and one-time configuration links.
**Architecture:** Preserve App/PeerRow/CreatePeerForm/LoginForm and cookie authentication. Use native dialog, shared controls, CSS Modules and public theme/setup styles. C++ remains untouched.
**Tech Stack:** Existing React, TypeScript, Vite, Vitest; no added libraries.
**Spec:** docs/superpowers/specs/2026-11-19-web-cpp-adaptation-design.md (approved).

## Global Constraints
- publicKey is the only peer identifier; no UUIDs, rename or direct config download.
- Handshake active for 180 seconds; link TTL 86400 seconds.
- C++ API is authoritative. POST name persistence and public CSS serving remain documented backend dependencies.
- Preserve existing multi-stage Docker production build; no runtime frontend server.

## Review Focus
- Retry link issuance after successful creation without creating duplicate peers.
- Retain list and ignore stale fetch results on failed/concurrent refresh.
- Dialog focus, Escape, pending state and clipboard failures.
- Handshake zero, threshold, future timestamp and stale status without manual refresh.
- Public CSS contains no administrative JS and is emitted at stable paths.

## Task 1: API and presentation data
- [x] Update api.test.ts and format.test.ts for GET Peer fields, DELETE JSON publicKey, link POST TTL and auth.
- [x] Run tests and observe old-contract failures.
- [x] Update api.ts and format.ts; remove rename, UUID and config download contracts.
- [x] Run API/format tests.

## Task 2: Components and UI behavior
- [x] Update App/CreatePeerForm/PeerRow tests; add Modal and auth tests.
- [x] Observe failures before implementation.
- [x] Build shared Button, IconButton, Input, Modal, LinkResult and layout styles; migrate existing components to CSS Modules.
- [x] Implement creation/link/delete flow, safe retries and refresh; preserve cookie auth.
- [x] Run complete frontend tests.

## Task 3: Production resources and documentation
- [x] Extract public theme.css and setup.css; global reset only; CSS Modules for components.
- [x] Remove Vite dev serving configuration and script, retain build/test tools.
- [x] Document public CSS paths, backend name requirement and production serving.
- [x] Run typecheck, tests, production build, inspect emitted CSS and Docker boundaries.
- [x] Fresh independent code review, address material findings, rerun affected checks.

## Execution record
- User approved design and execution; working in the requested existing workspace without Git mutations.

- Task 1 complete: API/format tests failed on legacy contract, then passed (27 tests).
- Task 2 complete: new UI tests failed before components were changed; final suite 56/56.
- Additional regression: slow list refresh must not delay issuance. Observed failure,
  made onCreated a notification, verified link result while refresh remains pending.
- Root moved unchanged into Root.tsx to test cookie auth without main.tsx mounting side effects.
- Task 3 complete: typecheck exit 0; 56 tests passed; production build exit 0.
- Built theme.css/setup.css match public sources; stable paths verified. Docker runtime
  retains dist-only copy; no C++ or Docker changes made by this implementation.
- Independent reviewer found no material frontend issues, confirmed backend dependencies.
- Headless Chrome: 1440px desktop and 390/320px mobile; no horizontal overflow,
  native dialog focus/Escape, successful create/link and JS-free setup styling verified.
- Browser checks use mocked API and temporary external test harness under /tmp;
  real VPN integration and a full Docker image build were not run.
