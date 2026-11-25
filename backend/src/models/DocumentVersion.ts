import { Schema, Types, model } from 'mongoose';

/** Immutable record of one uploaded file version. */
const documentVersionSchema = new Schema(
  {
    document: { type: Types.ObjectId, ref: 'Document', required: true, index: true },
    version: { type: Number, required: true, min: 1 },
    storageKey: { type: String, required: true },
    originalName: { type: String, required: true, maxlength: 255 },
    safeName: { type: String, required: true, maxlength: 255 },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true, min: 1 },
    sha256: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
    uploadedBy: { type: Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

documentVersionSchema.index({ document: 1, version: 1 }, { unique: true });

export const DocumentVersion = model('DocumentVersion', documentVersionSchema);
