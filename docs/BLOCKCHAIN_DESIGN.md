# Blockchain Design

## What is anchored
Only a SHA-256 content hash, an opaque document identifier, a version number, an uploader reference and the block timestamp. **No PDF, no names or e-mail addresses** are written on-chain.

## Contract: `LegalDocumentRegistry` (`blockchain/contracts`)
Solidity 0.8.24. Append-only per document.

```solidity
struct VersionRecord { bytes32 contentHash; address registrar; bytes32 uploaderRef; uint64 timestamp; uint32 version; }

registerDocument(bytes32 documentId, bytes32 contentHash, bytes32 uploaderRef)  // version 1 (onlyRegistrar)
registerVersion (bytes32 documentId, bytes32 contentHash, bytes32 uploaderRef)  // appends version n+1 (onlyRegistrar)
isRegistered(documentId) / getVersionCount(documentId)
getVersion(documentId, version) / getLatest(documentId) / getHash(documentId, version)
verifyDocument(documentId, version, contentHash) -> bool
setRegistrar(account, allowed)  transferOwnership(newOwner)   // onlyOwner
event DocumentRegistered(documentId indexed, version indexed, contentHash, registrar indexed, uploaderRef, timestamp)
```

Guarantees
- `registerDocument` reverts `AlreadyRegistered` if the id exists (duplicate prevention).
- `registerVersion` reverts `NotRegisteredYet` for unknown documents and `DuplicateHash` if the hash equals the latest version.
- Versions are only pushed, never overwritten; there is no update or delete function.
- Only authorized registrars can write (`NotRegistrar`); only the owner manages registrars (`NotOwner`).
- Empty (zero) hashes are rejected.

Identifiers: `documentId = keccak256("legal-doc:" + mongoId)`, `uploaderRef = keccak256("uploader:" + userId)`, `contentHash = 0x + sha256(file bytes)` (SHA-256 fits `bytes32`).

## Backend integration (`backend/src/services/blockchain.service.ts`)
- Private key is read from `BLOCKCHAIN_PRIVATE_KEY` in the backend environment only; contract address and ABI come from `blockchain/deployments/<network>.json`.
- **Submission vs confirmation:** `PENDING` (not sent) -> `SUBMITTED` (tx hash stored) -> `CONFIRMED` (receipt read, block number and block timestamp stored) or `FAILED` (decoded revert reason, e.g. `NotRegistrar`).
- Transactions are serialized through an in-process queue to avoid nonce collisions.
- Versions are registered in order; a failed v1 blocks v2 until retried (the contract requires gap-free versions).
- Retry is idempotent: before sending, the chain is consulted. If the version is already there with the same hash, the record is confirmed from the `DocumentRegistered` event instead of sending a second transaction.
- Provider cache is disabled and receipts are polled directly, because ethers' default 250 ms read cache and event-based waiting produced stale reads and stalls during testing.

## Verification
`GET /api/blockchain/verify/:documentId` re-hashes the stored file, reads the registered hash with `getVersion`, and compares them. Results: `VERIFIED`, `TAMPERED`, `NOT_REGISTERED`, `VERIFICATION_ERROR` (chain unreachable or file unreadable). It does **not** trust the hash stored in MongoDB - an attacker who edits both the file and its database hash is still detected (covered by an automated test).

## Networks
- **Local (default):** `npm run chain` starts a Hardhat node (chain id 31337); `npm run chain:deploy` deploys and writes `blockchain/deployments/localhost.json`. The default `.env.example` uses Hardhat's publicly known account #0 key, which holds only fake ETH and must never be used on a real network.
- **Sepolia (optional):** set `SEPOLIA_RPC_URL` and `SEPOLIA_DEPLOYER_PRIVATE_KEY` in `.env`, run `npm run deploy:sepolia -w blockchain`, then point `BLOCKCHAIN_RPC_URL`, `BLOCKCHAIN_DEPLOYMENT_FILE` (`../blockchain/deployments/sepolia.json`) and `BLOCKCHAIN_PRIVATE_KEY` at it. Requires Sepolia test ETH; this path is configured but has **not** been exercised in this project's test runs.

## Limits
- A matching hash proves the file is identical to what was registered, not that the original was an authentic court document.
- One operator key signs all registrations; compromise of that key allows registering arbitrary hashes (it cannot alter existing records).
