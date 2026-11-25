import { HydratedDocument, InferSchemaType, Schema, model } from 'mongoose';
import { ROLES } from '../utils/constants';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'STUDENT', required: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
    institution: { type: String, trim: true, maxlength: 150 },
    enrollmentId: { type: String, trim: true, maxlength: 50 },
    lastLoginAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export type IUser = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<IUser>;
export const User = model('User', userSchema);
