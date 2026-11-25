import multer from 'multer';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

/** In-memory single-file PDF upload (bounded by MAX_UPLOAD_MB); content is verified later by signature. */
export const uploadPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadBytes, files: 1, fields: 10 },
  fileFilter: (_req, file, cb) => {
    const okMime = file.mimetype === 'application/pdf';
    const okExt = file.originalname.toLowerCase().endsWith('.pdf');
    if (!okMime || !okExt) return cb(new AppError(415, 'Only PDF files are accepted', 'UNSUPPORTED_MEDIA_TYPE'));
    cb(null, true);
  },
}).single('file');
