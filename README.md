# LexVault: Secure Role-Based Legal Case Database with Blockchain-Enabled Data Integrity

Final-year engineering project: *Design and Development of a Secure Role-Based Legal Case Database for Law Students Using Blockchain-Enabled Data Integrity.*

A centralized legal case research and management platform for law students, faculty and administrators. Judgment PDFs are fingerprinted with SHA-256 and the fingerprint is registered on an Ethereum-compatible smart contract, so any later alteration of a document can be detected.

## 1. Project overview
Students browse and verify published landmark judgments; faculty curate cases and upload documents; administrators approve content, manage users and monitor integrity. Permissions are enforced on the server.

## 2. Problem statement
Case material circulates as loose PDFs with no way to confirm a copy is complete or unaltered, and shared storage gives little control over who may add or change records.

## 3. Objectives
Secure authentication and RBAC; a searchable case database; private document storage with versioning; tamper-evident integrity verification via blockchain; audit logging; dashboards and analytics.

## 4. Features
- Registration, login, httpOnly-cookie sessions, bcrypt passwords, rate limiting
- Three roles with server-side RBAC and a case approval workflow (draft -> pending -> published / rejected -> archived)
- Case search by title, case number, court, year, category and free text; filters, sorting, pagination; bookmarks
- PDF upload with signature validation, private storage, immutable versions, authorized download and inline preview
- SHA-256 hashing, on-chain registration, `VERIFIED / TAMPERED / NOT_REGISTERED / VERIFICATION_ERROR` verification (stored file or user-supplied copy), verification history
- Audit log with filters; role-scoped dashboards; admin analytics and system settings

## 5. Technology stack
| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS 3, React Router 6, Axios, React Hook Form, Zod, Lucide, Recharts |
| Backend | Node.js 22, Express 4, TypeScript, MongoDB + Mongoose 8, JWT, bcrypt, Multer, Zod, Helmet, express-rate-limit |
| Blockchain | Solidity 0.8.24, Hardhat 2, ethers.js v6, local Hardhat network (optional Sepolia) |
| Testing | Hardhat (Mocha/Chai), Jest + Supertest + mongodb-memory-server, Vitest + Testing Library |

## 6. System architecture
See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
```
React SPA --(JSON, cookie)--> Express API --> MongoDB
                                  |--> private file storage
                                  `--> ethers.js --> LegalDocumentRegistry (Hardhat / Sepolia)
```

## 7. Application modules
Authentication - Users - Legal cases - Bookmarks - Documents & versions - Blockchain registry - Integrity verification - Audit logs - Dashboards / analytics - System settings.

## 8. Role permission matrix
| Capability | Student | Faculty | Admin |
|---|:-:|:-:|:-:|
| Browse/search published cases, view, download, verify, bookmark | yes | yes | yes |
| Create / edit own cases, upload documents, submit for approval | - | yes | yes |
| View relevant audit logs, verification history of own documents | - | yes | yes |
| Approve / reject, archive, delete cases | - | - | yes |
| Manage users and roles | - | - | yes |
| All audit logs, blockchain records, analytics, settings | - | - | yes |

## 9. Database design
Seven collections: `users`, `legalcases`, `documents`, `documentversions`, `blockchainrecords`, `bookmarks`, `auditlogs`. See [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md).

## 10. Blockchain workflow
Upload -> validate PDF -> SHA-256 of original bytes -> store privately -> save metadata -> send transaction (`SUBMITTED`) -> read receipt (`CONFIRMED`, block number saved). Verify -> re-hash file -> read registered hash from the contract -> compare. Details: [docs/BLOCKCHAIN_DESIGN.md](docs/BLOCKCHAIN_DESIGN.md).

## 11. Smart contract
`LegalDocumentRegistry` stores per-document, append-only version records (hash, registrar, uploader reference, timestamp), emits `DocumentRegistered`, restricts writes to authorized registrars, and offers `verifyDocument`. It stores no files or personal data.

## 12. Installation
Prerequisites: Node.js 20+ (developed on 22) and npm 10+. MongoDB is optional: `npm run dev:db` starts a local MongoDB for you (the first run downloads a ~780 MB binary).

```bash
git clone https://github.com/Astik01/secure-legal-case-management.git
cd secure-legal-case-management
npm install
```

## 13. Environment configuration
```bash
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
```
Then set `JWT_SECRET` to a random value: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
`.env` is git-ignored. Key variables: `MONGODB_URI`, `JWT_SECRET`, `CLIENT_ORIGIN`, `STORAGE_DIR`, `MAX_UPLOAD_MB`, `BLOCKCHAIN_RPC_URL`, `BLOCKCHAIN_DEPLOYMENT_FILE`, `BLOCKCHAIN_PRIVATE_KEY`, `SEED_*`. To use your own MongoDB or Atlas, set `MONGODB_URI` and skip `dev:db`.

## 14-18. Running the project (five terminals, or run the first three once)
| Step | Command | Notes |
|---|---|---|
| 1. Database | `npm run dev:db` | Persistent data in `backend/.devdb` |
| 2. Local blockchain | `npm run chain` | Hardhat node on `http://127.0.0.1:8545` |
| 3. Deploy contract | `npm run chain:deploy` | Writes `blockchain/deployments/localhost.json` (git-ignored). Redeploy after restarting the chain |
| 4. Seed data | `npm run seed` | Idempotent; registers the demo documents on-chain |
| 5. Backend | `npm run dev:backend` | `http://localhost:4000` |
| 6. Frontend | `npm run dev:frontend` | `http://localhost:5173` |

Production build: `npm run build`, then `npm start -w backend` (serve `frontend/dist` behind a reverse proxy that forwards `/api`).

If the chain is restarted its state is lost; redeploy and re-run `npm run seed`. Registrations of old documents will then show `NOT_REGISTERED` until you retry them (**Retry registration** on the document page, or `POST /api/blockchain/register`).

## 19. Tests
```bash
npm test                       # everything
npm run test -w blockchain     # 7 contract tests
npm run test -w backend        # 67 API/integration tests (starts its own Mongo and Hardhat node on port 8546)
npm run test -w frontend       # 25 UI tests
```
Last full run: 7 + 67 + 25 = **99 passing, 0 failing**. The backend integration suite runs against a real in-memory MongoDB and a real Hardhat node, covering upload -> register -> download -> verify -> tamper -> detect.

## 20. Demo accounts (development only)
| Role | Email | Password |
|---|---|---|
| Administrator | `admin@lawschool.test` | `Admin@12345` |
| Faculty | `faculty@lawschool.test` | `Faculty@12345` |
| Student | `student@lawschool.test` | `Student@12345` |

Override via `SEED_*` in `.env`. These credentials are public; **never** seed or use them in production (the seed script refuses to run when `NODE_ENV=production`).

Sample data: *Kesavananda Bharati*, *Maneka Gandhi*, *Vishaka*, *Puttaswamy*, *Shreya Singhal*, *M.C. Mehta (Oleum Gas Leak)* (published) and *Navtej Singh Johar* (pending, to demonstrate approval). Only bibliographic facts and short original summaries are included. The generated PDFs are one-page **demonstration summary sheets**, clearly labelled as not official or court-certified. Verify citations against the official Supreme Court of India portal before relying on them.

## 21. API documentation
See [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md). Security notes: [docs/SECURITY.md](docs/SECURITY.md).

## 22. Screenshots
Screenshots have not been captured yet. To add them, run the app as described above and save images under `docs/screenshots/`: landing page, student dashboard, case explorer, document viewer with a VERIFIED and a TAMPERED result, faculty upload page, admin approvals, blockchain records, analytics.

## 23. Future enhancements
Cloud object storage provider; on-chain anchoring of audit-log digests (Merkle roots); per-user wallets or multi-signer registration; password reset and e-mail verification; zod 4 / React Router 7 upgrades; OCR and full-text search over PDF content; Sepolia deployment run-through and a CI pipeline; additional document types.

## Known limitations
See [docs/SECURITY.md](docs/SECURITY.md): dependency advisories, no session revocation, single operator key, local storage only, Sepolia path untested.

## AI assistance disclosure
This project was developed with the assistance of an AI coding tool (Claude Code). Code, tests and documentation were generated and then run and reviewed during development. Check your institution's policy on AI-assisted work and extend this disclosure as it requires.

## Repository layout
```
blockchain/  contracts, scripts, tests, hardhat.config.ts
backend/     src (config, controllers, middleware, models, routes, services, utils, validators), scripts (seed), tests
frontend/    src (components, pages, layouts, hooks, services, context, routes, types, utils)
docs/        architecture, database, API, blockchain, security
```
