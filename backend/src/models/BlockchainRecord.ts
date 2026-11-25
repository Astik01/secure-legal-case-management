import { Schema, Types, model } from 'mongoose';
import { CHAIN_STATUSES } from '../utils/constants';

/**
 * Off-chain bookkeeping of a registration. The authoritative hash lives on the blockchain;
 * `status` separates a submitted transaction from a confirmed (mined) registration.
 */
const blockchainRecordSchema = new Schema(
  {
    document: { type: Types.ObjectId, ref: 'Document', required: true, index: true },
    documentVersion: { type: Types.ObjectId, ref: 'DocumentVersion', required: true },
    version: { type: Number, required: true },
    documentKey: { type: String, required: true },
    contentHash: { type: String, required: true },
    status: { type: String, enum: CHAIN_STATUSES, default: 'PENDING', index: true },
    txHash: { type: String, index: true },
    blockNumber: { type: Number },
    chainId: { type: Number },
    contractAddress: { type: String },
    registrar: { type: String },
    chainTimestamp: { type: Date },
    error: { type: String, maxlength: 1000 },
    submittedAt: { type: Date },
    confirmedAt: { type: Date },
    requestedBy: { type: Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

blockchainRecordSchema.index({ document: 1, version: 1 }, { unique: true });

export const BlockchainRecord = model('BlockchainRecord', blockchainRecordSchema);
