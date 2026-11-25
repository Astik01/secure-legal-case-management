import { Schema, Types, model } from 'mongoose';

const bookmarkSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    legalCase: { type: Types.ObjectId, ref: 'LegalCase', required: true },
    note: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

bookmarkSchema.index({ user: 1, legalCase: 1 }, { unique: true });

export const Bookmark = model('Bookmark', bookmarkSchema);
