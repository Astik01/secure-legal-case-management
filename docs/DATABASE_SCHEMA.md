# Database Schema (MongoDB / Mongoose)

All collections use `timestamps` (`createdAt`, and `updatedAt` where mutable). References are `ObjectId`.

## users
| Field | Type | Notes |
|---|---|---|
| `name` | String | 2-100 chars |
| `email` | String | **unique**, lowercase |
| `passwordHash` | String | bcrypt (12 rounds), `select: false`, removed from JSON output |
| `role` | `STUDENT` \| `FACULTY` \| `ADMIN` | indexed |
| `isActive` | Boolean | indexed; false blocks login and existing sessions |
| `institution`, `enrollmentId` | String | optional |
| `lastLoginAt` | Date | |

## legalcases
`title`, `caseNumber` (**unique**), `citation`, `court` (idx), `year` (idx, 1700-2100), `category` (enum, idx), `petitioner`, `respondent`, `bench`, `decisionDate`, `summary`, `keyHoldings[]`, `tags[]`, `sourceUrl`, `status` (`DRAFT|PENDING|PUBLISHED|REJECTED|ARCHIVED`, idx), `createdBy` -> users (idx), `reviewedBy` -> users, `reviewedAt`, `reviewNote`, `submittedAt`, `publishedAt`.
A text index covers title, summary, case number and parties.

## documents
Logical document attached to a case.
`legalCase` -> legalcases (idx), `title`, `documentKey` (**unique**; bytes32 hex = `keccak256("legal-doc:" + _id)`), `currentVersion`, `isDemo`, `createdBy` -> users.

## documentversions
Immutable record of each stored file.
`document` -> documents, `version`, `storageKey`, `originalName`, `safeName`, `mimeType`, `size`, `sha256` (64 hex), `uploadedBy` -> users. **Unique** `(document, version)`.

## blockchainrecords
Bookkeeping of registrations (the chain is the source of truth for hashes).
`document`, `documentVersion`, `version`, `documentKey`, `contentHash`, `status` (`PENDING|SUBMITTED|CONFIRMED|FAILED`), `txHash`, `blockNumber`, `chainId`, `contractAddress`, `registrar`, `chainTimestamp`, `error`, `submittedAt`, `confirmedAt`, `requestedBy`. **Unique** `(document, version)`.

## bookmarks
`user` -> users, `legalCase` -> legalcases, `note`. **Unique** `(user, legalCase)`.

## auditlogs
`actor` -> users, `actorRole`, `action`, `resourceType`, `resourceId`, `outcome` (`SUCCESS|FAILURE|DENIED`), `metadata` (secrets redacted), `ip`, `userAgent`, `createdAt`. Indexed on actor, action, resource, outcome, time.
Update/delete operations are rejected by model hooks and no API route can modify entries. This is an application-level guarantee; it is **not** blockchain-immutable.

## Relationships
```
users 1--* legalcases (createdBy)      legalcases 1--* documents 1--* documentversions
documents 1--* blockchainrecords       users 1--* bookmarks *--1 legalcases
users 1--* auditlogs (actor)
```
