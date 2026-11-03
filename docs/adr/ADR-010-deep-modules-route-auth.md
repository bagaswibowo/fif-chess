# ADR-010: Centralized `routeAuth` Deep Module & PostgreSQL Identity Mapping

## Status
Accepted

## Context
Aplikasi saat ini memiliki 28 grup route di `app/api/` dengan lebih dari 24 duplikasi penanganan 401 Unauthorized, 403 Forbidden (account pending), dan 503 Service Unavailable (Postgres connectivity down). Terdapat pula duplikasi mapping manual `username -> pg uuid` di setidaknya 5 route game.

## Decision
1. Mengangkat fungsi otentikasi menjadi satu Deep Module di `lib/route-auth.ts`.
2. Antarmuka publik module ini sangat ramping:
   ```typescript
   export async function routeAuth(req: Request): Promise<
     | { ok: true; user: SessionUser; pgUserId: string }
     | { ok: false; response: NextResponse }
   >;
   export async function pgIdByUsername(username: string): Promise<string | null>;
   ```
3. Seluruh pemetaan identity dan handling status akun diselesaikan di dalam modul ini.
4. `lib/puzzle-api.ts` yang sebelumnya menjadi host fungsi `resolvePgUser` akan mere-export helper dari `lib/route-auth.ts` untuk menjaga backwards compatibility.

## Consequences
- **Positive**: Penanganan status auth menjadi konsisten di seluruh aplikasi (tidak ada kebocoran CTA login palsu bagi akun pending).
- **Positive**: Mengurangi kompleksitas pemeliharaan API route secara drastis.
- **Positive**: Menjadi fondasi untuk migrasi penuh dari `users.json` ke PostgreSQL murni.
