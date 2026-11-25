# Architecture

## Overview

LexVault is a three-tier web application with a blockchain integrity layer.

```
 Browser (React SPA)
    |  HTTPS / JSON, httpOnly session cookie
    v
 Express API (Node.js, TypeScript) ----------------+
    |                 |                             |
    | Mongoose        | private file storage        | ethers.js v6 (JSON-RPC)
    v                 v                             v
 MongoDB         backend/storage/ (not served)   LegalDocumentRegistry (Hardhat local / Sepolia)
```

| Layer | Responsibility |
|---|---|
| `frontend/` | UI, client-side validation, route guards (usability only). Never holds keys or tokens in JS. |
| `backend/` | Authentication, **all** authorization, validation, file handling, hashing, blockchain calls, audit logging. |
| `blockchain/` | Solidity contract, Hardhat config, deploy script, contract tests. |
| MongoDB | Users, cases, document metadata/versions, blockchain bookkeeping, bookmarks, audit logs. |

## Backend structure (`backend/src`)

| Folder | Contents |
|---|---|
| `config/` | Zod-validated environment (`env.ts`), DB connection |
| `models/` | Mongoose schemas (7 collections) |
| `middleware/` | `authenticate`, `authorize(...roles)`, `validate`, `sanitize` (NoSQL operators), upload (multer), error handler |
| `controllers/` | HTTP handlers; thin, delegate to services |
| `services/` | `auth`, `audit`, `case` (visibility rules), `document`, `storage` (provider interface), `blockchain`, `verification` |
| `routes/` | Express routers, one per resource |
| `validators/` | Zod schemas for bodies and queries |
| `utils/` | `AppError`, response helpers, pagination, file/hash helpers |

Every response uses one envelope: `{ success, message?, data, meta? }` or `{ success: false, message, error: { code, details? } }`.

## Key flows

### Upload and registration
1. `POST /api/documents/upload` (faculty/admin) receives a multipart PDF in memory (size capped).
2. MIME type, `.pdf` extension, `%PDF-` header and `%%EOF` trailer are checked.
3. SHA-256 is computed from the exact bytes. The file is written to private storage under an opaque key (`<documentId>/v<n>-<uuid>.pdf`).
4. `Document` / `DocumentVersion` metadata is stored (version numbers use optimistic concurrency).
5. The blockchain service registers the hash and records a `BlockchainRecord`: `PENDING` -> `SUBMITTED` (tx sent, hash stored) -> `CONFIRMED` (receipt read, block number stored) or `FAILED`.
6. A blockchain failure never loses the upload; registration can be retried (`POST /api/blockchain/register`).

### Verification
1. Resolve the document and check the caller may see its case.
2. Read the file (or an uploaded copy) and compute SHA-256 now.
3. Read the registered hash **from the contract** (`getVersionCount` / `getVersion`).
4. Compare in constant time. Return `VERIFIED`, `TAMPERED`, `NOT_REGISTERED` or `VERIFICATION_ERROR`.
The database hash is returned for reference only; the chain is authoritative.

### Authorization
`authenticate` verifies the JWT, reloads the user, and rejects deactivated accounts on **every** request. The role used for decisions is read from the database, not the token, so role changes and deactivation apply immediately. `authorize(...roles)` is the reusable role gate; resource-level rules (case ownership, case visibility) live in `case.service.ts`.

## Frontend structure (`frontend/src`)
`components/` (design system, badges, verification panel), `layouts/` (public and app shells, role navigation), `pages/{public,student,faculty,admin,shared}`, `routes/` (guards), `context/` (auth, toasts), `services/` (axios client and endpoint modules), `hooks/`, `types/`, `utils/`.

The Vite dev server proxies `/api` to the backend so the browser sees a single origin (the session cookie stays same-site).

## Design decisions and trade-offs
- **Backend signs blockchain transactions** with one registrar key. Users do not need wallets. The contract stores a pseudonymous `uploaderRef = keccak256("uploader:" + userId)` so uploader identity can be proven by the operator without placing personal data on-chain.
- **Hash on-chain, file off-chain.** Files are never stored on the chain.
- **Storage provider interface** (`StorageProvider`) lets a cloud implementation replace local disk without touching controllers.
- **Case deletion** removes the case and its bookmarks but deliberately retains document files, metadata and on-chain records for audit.
- **Ethers read cache disabled** (`cacheTimeout: -1`) so integrity checks never see stale chain state.
