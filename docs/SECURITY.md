# Security

## Controls implemented

| Area | Control |
|---|---|
| Passwords | bcrypt (12 rounds; 4 in tests), min 8 chars with letter + digit. Hash never serialized (`select:false`, stripped from JSON). |
| Sessions | JWT (HS256, 8 h) in an **httpOnly, SameSite=Lax** cookie (`Secure` in production). JS never reads the token. Bearer header also accepted for API clients. |
| Account state | `authenticate` reloads the user on every request: deactivated accounts and role changes take effect immediately. Role comes from the DB, not the token. |
| Authorization | Reusable `authorize(...roles)` middleware on every protected route + resource rules (ownership, case visibility). Frontend guards are cosmetic. Unpublished cases return 404 to students. |
| Privilege escalation | Registration ignores `role`; profile updates reject unknown keys (`strict`); users cannot change their own role/status; last active admin cannot be demoted or deactivated. |
| Input validation | Zod schemas on bodies/queries/params; `ObjectId` checks; unknown fields rejected on writes. |
| NoSQL injection | Middleware strips `$`-prefixed / dotted keys; schemas only accept scalars; search text is regex-escaped. Tested with `{ "$gt": "" }` login and `year[$gt]`. |
| Rate limiting | Global (600 / 15 min / IP) and stricter on login/register (30 / 15 min). |
| Headers / CORS | Helmet defaults, `x-powered-by` removed, CORS limited to `CLIENT_ORIGIN` with credentials. |
| File upload | PDF only: MIME + extension + `%PDF-` header + `%%EOF` trailer; size cap; in-memory, then written to private storage under a random key (`wx` flag: never overwrite). Original names are sanitized and used only for `Content-Disposition`. |
| File serving | No static route to storage. Downloads go through an authorized endpoint with `nosniff`, `Cache-Control: private, no-store`, sandbox CSP. Path traversal blocked in the storage layer. |
| Secrets | `.env` is git-ignored; `.env.example` has placeholders. JWT secret is validated (strong value required in production). Blockchain key lives only in backend env. Settings page never prints secrets. |
| Logging | Errors logged without bodies/headers; audit metadata is scrubbed for keys matching password/secret/token/private/authorization/cookie. |
| Audit | Login, registration, case/document/blockchain/verification events, role/status changes and **denied** requests are recorded. |
| CSRF | Cookies are SameSite=Lax and the API only accepts JSON or multipart on state-changing routes, so cross-site form posts do not carry the session. |

## Audit log honesty
Audit logs live in MongoDB. Application code cannot update or delete them (model hooks + no routes), but someone with direct database access could. They are **not** blockchain-immutable. Only document hashes are anchored on-chain.

## Known limitations and accepted risks
- **Dependency advisories** (`npm audit --omit=dev`, 4 findings at time of writing):
  - `zod` 3.x (high): memory exhaustion validating oversized constrained collections. Mitigated by the 1 MB JSON body limit and array/string caps; the fix is a major upgrade (zod 4) not yet adopted.
  - `lodash` (high, transitive via `recharts`): prototype-pollution / `_.template` issues. The app never passes attacker-controlled data to those functions; a forced pin made the install unreliable and was reverted.
  - `react-router-dom` 6 (moderate): open-redirect/deserialization advisories in features not used here (no SSR, no redirect to user-supplied URLs). Fix requires v7.
- Sessions cannot be revoked individually before expiry (only by deactivating the account).
- No account lockout / e-mail verification / password reset flow.
- Single blockchain operator key (see BLOCKCHAIN_DESIGN.md).
- Local file storage only; no malware scanning of uploads.
- Development seed credentials are public in this repository; never seed production.
- Sepolia deployment path is configured but untested here.

## Reporting
This is a coursework project; there is no production deployment or disclosure program.
