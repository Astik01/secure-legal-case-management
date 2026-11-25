import { Schema, Types, model } from 'mongoose';

/** A logical legal document attached to a case. Concrete files live in DocumentVersion. */
const documentSchema = new Schema(
  {
    legalCase: { type: Types.ObjectId, ref: 'LegalCase', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    // bytes32 identifier used on-chain (keccak256 of a namespaced Mongo id; contains no personal data)
    documentKey: { type: String, required: true, unique: true },
    currentVersion: { type: Number, required: true, default: 1, min: 1 },
    isDemo: { type: Boolean, default: false },
    createdBy: { type: Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true },
);

export const DocumentModel = model('Document', documentSchema);
