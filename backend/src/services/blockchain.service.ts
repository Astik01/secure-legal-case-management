import fs from 'fs';
import { Contract, JsonRpcProvider, Network, Wallet, ethers } from 'ethers';
import { env } from '../config/env';
import { BlockchainRecord } from '../models/BlockchainRecord';
import { DocumentModel } from '../models/Document';
import { DocumentVersion } from '../models/DocumentVersion';

export interface ChainConfig {
  rpcUrl: string;
  deploymentFile: string;
  privateKey?: string;
  confirmTimeoutMs?: number;
}

export interface OnChainVersion {
  contentHash: string; // 0x-prefixed bytes32
  registrar: string;
  uploaderRef: string;
  timestamp: number; // unix seconds
  version: number;
}

const toBytes32 = (hex: string) => (hex.startsWith('0x') ? hex : `0x${hex}`);
export const uploaderRefFor = (userId: string) => ethers.id(`uploader:${userId}`);

function errorText(err: unknown): string {
  const e = err as { revert?: { name?: string }; shortMessage?: string; message?: string; code?: string };
  return (e?.revert?.name ?? e?.shortMessage ?? e?.message ?? String(err)).slice(0, 500);
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: NodeJS.Timeout;
  const timeout = new Promise<never>((_, rej) => {
    t = setTimeout(() => rej(new Error(`${label} timed out after ${ms} ms`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(t)) as Promise<T>;
}

/**
 * Wraps the LegalDocumentRegistry contract. The private key never leaves this process and is
 * never sent to the frontend or stored in the database.
 */
export class BlockchainService {
  private provider?: JsonRpcProvider;
  private contract?: Contract;
  private wallet?: Wallet;
  private chainId = 0;
  private address = '';
  private txQueue: Promise<unknown> = Promise.resolve();

  constructor(private config: ChainConfig) {}

  private init() {
    if (this.contract) return;
    if (!this.config.privateKey) throw new Error('BLOCKCHAIN_PRIVATE_KEY is not configured');
    if (!fs.existsSync(this.config.deploymentFile)) {
      throw new Error('Contract deployment file not found. Run: npm run chain:deploy');
    }
    const dep = JSON.parse(fs.readFileSync(this.config.deploymentFile, 'utf8'));
    this.chainId = Number(dep.chainId);
    this.address = dep.address;
    this.provider = new JsonRpcProvider(this.config.rpcUrl, this.chainId, {
      staticNetwork: Network.from(this.chainId),
      pollingInterval: 300,
    });
    this.wallet = new Wallet(this.config.privateKey, this.provider);
    this.contract = new Contract(dep.address, dep.abi, this.wallet);
  }

  private get c() {
    this.init();
    return this.contract!;
  }

  /** Serialises transaction submission so concurrent uploads never reuse a nonce. */
  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.txQueue.then(fn, fn);
    this.txQueue = run.catch(() => undefined);
    return run;
  }

  async status() {
    try {
      this.init();
      const [block, balance, isRegistrar] = await withTimeout(
        Promise.all([
          this.provider!.getBlockNumber(),
          this.provider!.getBalance(this.wallet!.address),
          this.c.registrars(this.wallet!.address) as Promise<boolean>,
        ]),
        8000,
        'status',
      );
      return {
        connected: true,
        chainId: this.chainId,
        contractAddress: this.address,
        registrarAddress: this.wallet!.address,
        registrarAuthorized: isRegistrar,
        registrarBalanceEth: ethers.formatEther(balance),
        latestBlock: block,
        rpcUrl: this.config.rpcUrl.replace(/\/\/[^@/]*@/, '//***@'),
      };
    } catch (err) {
      return { connected: false, error: errorText(err), rpcUrl: this.config.rpcUrl.replace(/\/\/[^@/]*@/, '//***@') };
    }
  }

  /** Human-readable error, decoding custom contract errors (e.g. NotRegistrar) from revert data. */
  private describe(err: unknown): string {
    const data = (err as { data?: string })?.data;
    if (typeof data === 'string' && data.startsWith('0x') && data.length >= 10) {
      try {
        const parsed = this.contract?.interface.parseError(data);
        if (parsed) return `${parsed.name}(${parsed.args.map(String).join(', ')})`.slice(0, 500);
      } catch {
        /* fall through */
      }
    }
    return errorText(err);
  }

  /** Reads the registered record from the blockchain. Throws if the chain cannot be reached. */
  async readVersion(documentKey: string, version: number): Promise<{ registered: boolean; record?: OnChainVersion; versionCount: number }> {
    const count = Number(await withTimeout(this.c.getVersionCount(documentKey), 10000, 'getVersionCount'));
    if (count === 0 || version > count) return { registered: false, versionCount: count };
    const r = await withTimeout(this.c.getVersion(documentKey, version), 10000, 'getVersion');
    return {
      registered: true,
      versionCount: count,
      record: {
        contentHash: String(r.contentHash).toLowerCase(),
        registrar: r.registrar,
        uploaderRef: r.uploaderRef,
        timestamp: Number(r.timestamp),
        version: Number(r.version),
      },
    };
  }

  /** Registers a single stored version on-chain, tracking submission and confirmation separately. */
  private async registerOne(versionId: string, requestedBy?: string) {
    const dv = await DocumentVersion.findById(versionId);
    if (!dv) throw new Error('Document version not found');
    const doc = await DocumentModel.findById(dv.document);
    if (!doc) throw new Error('Document not found');

    let record = await BlockchainRecord.findOne({ document: doc._id, version: dv.version });
    if (record?.status === 'CONFIRMED') return record;
    if (!record) {
      record = await BlockchainRecord.create({
        document: doc._id, documentVersion: dv._id, version: dv.version, documentKey: doc.documentKey,
        contentHash: toBytes32(dv.sha256), status: 'PENDING', requestedBy,
      });
    }

    try {
      this.init();
      // Recover from "mined but not recorded" (e.g. crash after submission) by consulting the chain first.
      const existing = await this.readVersion(doc.documentKey, dv.version);
      if (existing.registered) {
        if (existing.record!.contentHash !== toBytes32(dv.sha256).toLowerCase()) {
          throw new Error('A different hash is already registered on-chain for this version');
        }
        return await this.confirmFromEvents(record, doc.documentKey, dv.version);
      }
      if (existing.versionCount !== dv.version - 1) {
        throw new Error(`Version out of sequence: chain has ${existing.versionCount} version(s), expected ${dv.version - 1}`);
      }

      const uploaderRef = uploaderRefFor(String(dv.uploadedBy));
      const tx = await this.enqueue(async () =>
        dv.version === 1
          ? this.c.registerDocument(doc.documentKey, toBytes32(dv.sha256), uploaderRef)
          : this.c.registerVersion(doc.documentKey, toBytes32(dv.sha256), uploaderRef),
      );
      // Submitted but not yet mined: NOT a confirmed registration.
      record.status = 'SUBMITTED';
      record.txHash = tx.hash;
      record.submittedAt = new Date();
      record.error = undefined;
      record.chainId = this.chainId;
      record.contractAddress = this.address;
      await record.save();

      const receipt = await withTimeout(this.provider!.waitForTransaction(tx.hash, 1, this.config.confirmTimeoutMs ?? 60000), (this.config.confirmTimeoutMs ?? 60000) + 2000, 'confirmation');
      if (!receipt) return record; // still pending; reconcile() will pick it up
      if (receipt.status !== 1) throw new Error('Transaction reverted');
      const block = await this.provider!.getBlock(receipt.blockNumber);
      record.status = 'CONFIRMED';
      record.blockNumber = receipt.blockNumber;
      record.registrar = receipt.from;
      record.chainTimestamp = block ? new Date(block.timestamp * 1000) : undefined;
      record.confirmedAt = new Date();
      await record.save();
      return record;
    } catch (err) {
      const message = this.describe(err);
      record.status = record.txHash && record.status === 'SUBMITTED' && /timed out/.test(message) ? 'SUBMITTED' : 'FAILED';
      record.error = message;
      await record.save();
      return record;
    }
  }

  private async confirmFromEvents(record: InstanceType<typeof BlockchainRecord>, documentKey: string, version: number) {
    const events = await this.c.queryFilter(this.c.filters.DocumentRegistered(documentKey, version));
    const ev = events[0];
    if (ev) {
      const block = await this.provider!.getBlock(ev.blockNumber);
      record.txHash = ev.transactionHash;
      record.blockNumber = ev.blockNumber;
      record.chainTimestamp = block ? new Date(block.timestamp * 1000) : undefined;
    }
    record.status = 'CONFIRMED';
    record.chainId = this.chainId;
    record.contractAddress = this.address;
    record.confirmedAt = new Date();
    record.error = undefined;
    await record.save();
    return record;
  }

  /** Checks SUBMITTED records against the chain and promotes them to CONFIRMED or FAILED. */
  async reconcile(record: InstanceType<typeof BlockchainRecord>) {
    if (record.status !== 'SUBMITTED' || !record.txHash) return record;
    try {
      this.init();
      const receipt = await withTimeout(this.provider!.getTransactionReceipt(record.txHash), 10000, 'receipt');
      if (!receipt) return record;
      if (receipt.status !== 1) {
        record.status = 'FAILED';
        record.error = 'Transaction reverted';
      } else {
        const block = await this.provider!.getBlock(receipt.blockNumber);
        record.status = 'CONFIRMED';
        record.blockNumber = receipt.blockNumber;
        record.registrar = receipt.from;
        record.chainTimestamp = block ? new Date(block.timestamp * 1000) : undefined;
        record.confirmedAt = new Date();
        record.error = undefined;
      }
      await record.save();
    } catch (err) {
      record.error = errorText(err);
    }
    return record;
  }

  /**
   * Registers every not-yet-confirmed version of a document in ascending order, because the contract
   * requires gap-free version numbers. Already confirmed versions are never re-sent (idempotent).
   */
  async registerDocumentVersions(documentId: string, requestedBy?: string, onlyVersion?: number) {
    const versions = await DocumentVersion.find({ document: documentId }).sort({ version: 1 });
    const records: InstanceType<typeof BlockchainRecord>[] = [];
    const newlyConfirmed: number[] = [];
    const failed: number[] = [];
    for (const v of versions) {
      if (onlyVersion && v.version > onlyVersion) break;
      let rec = await BlockchainRecord.findOne({ document: documentId, version: v.version });
      if (rec?.status === 'SUBMITTED') {
        rec = await this.reconcile(rec);
        if (rec.status === 'CONFIRMED') newlyConfirmed.push(v.version);
      }
      if (rec?.status === 'CONFIRMED') {
        records.push(rec);
        continue;
      }
      rec = await this.registerOne(v.id, requestedBy);
      records.push(rec);
      if (rec.status === 'CONFIRMED') newlyConfirmed.push(v.version);
      else {
        if (rec.status === 'FAILED') failed.push(v.version);
        break; // later versions cannot be registered before this one
      }
    }
    return { records, newlyConfirmed, failed };
  }
}

let instance: BlockchainService | undefined;

export function getBlockchain(): BlockchainService {
  instance ??= new BlockchainService({
    rpcUrl: env.BLOCKCHAIN_RPC_URL,
    deploymentFile: env.deploymentFile,
    privateKey: env.BLOCKCHAIN_PRIVATE_KEY,
  });
  return instance;
}

/** Replaces the singleton (used by tests to simulate outages and unauthorized signers). */
export function setBlockchain(svc: BlockchainService | undefined) {
  instance = svc;
}
