# PulseCoreLite Frontend Architecture Baseline

- Version: v1.0
- Date: 2026-03-02
- Scope: `src/` frontend only

## Goals

- Keep clear dependency direction and avoid cross-layer coupling.
- Keep behavior stable while refactoring existing features.
- Make future module split predictable and low-risk.

## Layer Model

The frontend follows this direction:

`Entry -> Page -> Domain Composable -> Store -> Service -> UI/Utils`

Rules:

1. `Entry` only does app bootstrap and global providers, no business logic.
2. `Page` only does orchestration and view composition.
3. `Domain Composable` holds feature workflows and combines store/service calls.
4. `Store` holds shared app state and state mutation APIs.
5. `Service` talks to runtime APIs (Tauri, storage, window management).
6. `UI` components stay presentation-first and receive data via props/events.
7. `Utils` stays pure and framework-agnostic.

## Directory Constraints

- `src/entries`: entry-only files (`main.ts`, `taskbar.ts`, `toolkit.ts`, `*App.vue`).
- `src/pages`: page composition only, no direct low-level persistence.
- `src/composables`: feature/domain logic; avoid direct Tauri calls when service exists.
- `src/stores`: shared state only; side effects should go through services.
- `src/services`: integration boundary (`tauri`, `storageRepository`, `windowManager`).
- `src/components`: reusable UI and business view components.
- `src/utils`: stateless helpers; no Vue lifecycle/state.
- `src/types`: shared type contracts by domain.

## Dependency Rules

1. Do not import `pages` from `stores/services/utils`.
2. Do not import `entries` from runtime code.
3. Prefer `services/storageRepository` for persistence access.
4. Prefer `services/windowManager` for window open/show/focus/close operations.
5. Keep `localStorage` direct access only when a sync path is strictly required.

## Legacy and Archive Rules

1. Do not keep `.bak.vue` files under `src/`.
2. Archive temporary backups under `docs/archive/`.
3. Any historical file in `docs/archive/` must not be imported by runtime code.

## P0 Adoption Checklist

1. Add architecture baseline document (this file).
2. Add shared `storageRepository` and `windowManager`.
3. Move `.bak.vue` from `src/` to `docs/archive/`.
4. Keep existing keys/behavior stable during migration.
