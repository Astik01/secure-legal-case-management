import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { env } from '../config/env';

/**
 * Storage abstraction. Only LocalStorage exists today; an S3/GCS provider can implement the same
 * interface later without touching controllers. Files are addressed by opaque keys, never by user input.
 */
export interface StorageProvider {
  save(key: string, data: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  stream(key: string): Readable;
  exists(key: string): Promise<boolean>;
}

export class LocalStorage implements StorageProvider {
  constructor(private root: string) {}

  /** Resolves a key inside the root and rejects anything that escapes it (path traversal). */
  private resolve(key: string): string {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error('Invalid storage key');
    return full;
  }

  async save(key: string, data: Buffer) {
    const full = this.resolve(key);
    await fs.promises.mkdir(path.dirname(full), { recursive: true });
    // 'wx' fails if the file exists: stored versions are never overwritten.
    await fs.promises.writeFile(full, data, { flag: 'wx', mode: 0o600 });
  }
  read(key: string) {
    return fs.promises.readFile(this.resolve(key));
  }
  stream(key: string) {
    return fs.createReadStream(this.resolve(key));
  }
  async exists(key: string) {
    try {
      await fs.promises.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }
}

let storage: StorageProvider = new LocalStorage(env.storageDir);
export const getStorage = () => storage;
export const setStorage = (s: StorageProvider) => {
  storage = s;
};
