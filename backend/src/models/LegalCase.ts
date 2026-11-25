import { Schema, Types, model } from 'mongoose';
import { CASE_CATEGORIES, CASE_STATUSES } from '../utils/constants';

const legalCaseSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 300 },
    caseNumber: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
    citation: { type: String, trim: true, maxlength: 200 },
    court: { type: String, required: true, trim: true, maxlength: 200, index: true },
    year: { type: Number, required: true, min: 1700, max: 2100, index: true },
    category: { type: String, enum: CASE_CATEGORIES, required: true, index: true },
    petitioner: { type: String, trim: true, maxlength: 300 },
    respondent: { type: String, trim: true, maxlength: 300 },
    bench: { type: String, trim: true, maxlength: 500 },
    decisionDate: { type: Date },
    summary: { type: String, required: true, trim: true, maxlength: 10000 },
    keyHoldings: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    sourceUrl: { type: String, trim: true, maxlength: 500 },
    status: { type: String, enum: CASE_STATUSES, default: 'DRAFT', index: true },
    createdBy: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    reviewedBy: { type: Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewNote: { type: String, trim: true, maxlength: 1000 },
    submittedAt: { type: Date },
    publishedAt: { type: Date },
  },
  { timestamps: true },
);

legalCaseSchema.index({ title: 'text', summary: 'text', caseNumber: 'text', petitioner: 'text', respondent: 'text' });

export const LegalCase = model('LegalCase', legalCaseSchema);
