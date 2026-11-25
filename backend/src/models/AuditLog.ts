import { Schema, Types, model } from 'mongoose';

/**
 * Database audit trail. Append-only at the application layer: update and delete operations
 * are rejected by hooks and no API route mutates entries. NOTE: this is NOT blockchain-immutable;
 * a user with direct database access could still alter it. Only document hashes are anchored on-chain.
 */
const auditLogSchema = new Schema(
  {
    actor: { type: Types.ObjectId, ref: 'User', index: true },
    actorRole: { type: String },
    action: { type: String, required: true, index: true },
    resourceType: { type: String, index: true },
    resourceId: { type: String, index: true },
    outcome: { type: String, enum: ['SUCCESS', 'FAILURE', 'DENIED'], default: 'SUCCESS', index: true },
    metadata: { type: Schema.Types.Mixed },
    ip: { type: String },
    userAgent: { type: String, maxlength: 300 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ createdAt: -1 });

const blocked = () => {
  throw new Error('Audit log entries are append-only and cannot be modified or deleted');
};
auditLogSchema.pre('save', function (next) {
  if (!this.isNew) return next(new Error('Audit log entries are append-only'));
  next();
});
for (const op of [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'findOneAndReplace',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
] as const) {
  auditLogSchema.pre(op as 'updateOne', blocked);
}

export const AuditLog = model('AuditLog', auditLogSchema);
