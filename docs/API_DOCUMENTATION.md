# API Documentation

Base URL: `/api` (dev: `http://localhost:4000/api`, or `http://localhost:5173/api` through the Vite proxy).

**Authentication:** an httpOnly cookie `token` is set on login/registration. Non-browser clients may send `Authorization: Bearer <token>` (the token is also returned in the login response body).

**Envelope**
```json
{ "success": true, "message": "optional", "data": {}, "meta": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 } }
{ "success": false, "message": "Validation failed", "error": { "code": "VALIDATION_ERROR", "details": [{ "path": "email", "message": "..." }] } }
```
Status codes: 400 validation, 401 unauthenticated, 403 forbidden, 404 not found (also used to hide unpublished cases), 409 conflict, 413 file too large, 415 unsupported type, 429 rate limited.

Roles: **S** student, **F** faculty, **A** admin. "any" = any signed-in user (results are filtered by role).

## Auth
| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/auth/register` | public | Always creates a STUDENT; extra fields (e.g. `role`) are ignored |
| POST | `/auth/login` | public | Rate limited |
| POST | `/auth/logout` | any | Clears cookie |
| GET | `/auth/me` | any | |

## Users
| Method | Path | Access |
|---|---|---|
| GET | `/users?page&limit&search&role&isActive` | A |
| POST | `/users` | A (create account with any role) |
| GET | `/users/:id` | A or self |
| PUT | `/users/:id` | A (any, incl. email) or self (name, institution, enrollmentId) |
| PATCH | `/users/:id/role` `{role}` | A (not self; not the last admin) |
| PATCH | `/users/:id/status` `{isActive}` | A (not self; not the last admin) |

## Cases
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/cases` | any | Query: `q, title, caseNumber, court, year, category, status, mine, sort, page, limit`. Students see PUBLISHED only; faculty PUBLISHED + own; admin all |
| GET | `/cases/meta/filters` | any | Distinct courts, years, categories |
| GET | `/cases/:id` | any | Includes `bookmarkId` |
| POST | `/cases` | F, A | Created as DRAFT |
| PUT | `/cases/:id` | F (own, DRAFT/REJECTED), A | Unknown fields rejected |
| PATCH | `/cases/:id/submit` | F (own), A | DRAFT/REJECTED -> PENDING |
| PATCH | `/cases/:id/approve` | A | `{decision: APPROVE|REJECT, note}`; note required to reject |
| PATCH | `/cases/:id/archive` | A | |
| DELETE | `/cases/:id` | A | Retains documents and on-chain records |

## Bookmarks
`POST /bookmarks {caseId, note?}`, `GET /bookmarks`, `DELETE /bookmarks/:id` (owner only). Any signed-in user, for cases they can view.

## Documents
| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/documents/upload` | F (own case), A | multipart: `file` (PDF), `caseId`, optional `title`, optional `documentId` (= new version). Response includes `blockchain` record |
| GET | `/documents?caseId=` | any | Documents of a viewable case |
| GET | `/documents/:id` | any | With versions |
| GET | `/documents/:id/versions` | any | |
| GET | `/documents/:id/download?version&inline` | any | Streams PDF; `nosniff`, `no-store`, sandbox CSP |

## Blockchain
| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/blockchain/register` `{documentId, version?}` | F (own), A | Idempotent retry of unconfirmed versions |
| GET | `/blockchain/records/:documentId` | any (viewable) | Per-version records; SUBMITTED ones are reconciled |
| GET | `/blockchain/records?status&page&limit` | A | All registrations |
| GET | `/blockchain/verify/:documentId?version` | any (viewable) | Returns status `VERIFIED|TAMPERED|NOT_REGISTERED|VERIFICATION_ERROR`, `originalHash`, `currentHash`, `txHash`, `blockNumber`, `registeredAt`, ... |
| POST | `/blockchain/verify/:documentId/file?version` | any (viewable) | multipart `file`; verifies a user-held copy |
| GET | `/blockchain/verifications` | any | Verification history: students own, faculty their documents, admin all |
| GET | `/blockchain/status` | F, A | Connectivity, contract, registrar authorization |

## Audit logs (read-only)
`GET /audit-logs?action&outcome&actor&resourceType&resourceId&from&to&page&limit`, `GET /audit-logs/actions`, `GET /audit-logs/:id` - **A** (all) and **F** (own actions + events on their cases/documents). There are no write endpoints.

## Dashboards and system
`GET /dashboard` (any; shape depends on role), `GET /analytics` (A), `GET /system/settings` (A; no secrets), `GET /health` (public).
