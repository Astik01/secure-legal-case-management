import { createHash } from 'crypto';
import path from 'path';

/** SHA-256 of the exact file bytes, lowercase hex (64 chars). */
export const sha256Hex = (data: Buffer): string => createHash('sha256').update(data).digest('hex');

/** Validates the PDF signature (header) and end-of-file marker; never trusts the client MIME type alone. */
export function looksLikePdf(buf: Buffer): boolean {
  if (buf.length < 16) return false;
  if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') return false;
  const tail = buf.subarray(Math.max(0, buf.length - 1024)).toString('latin1');
  return tail.includes('%%EOF');
}

/** Produces a filesystem- and header-safe display name; strips paths, control and special characters. */
export function safeFileName(original: string): string {
  const base = path.basename(original.replace(/\\/g, '/'));
  const cleaned = base
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 100);
  const name = cleaned || 'document';
  return name.toLowerCase().endsWith('.pdf') ? name : `${name.replace(/\.+$/, '')}.pdf`;
}
