import { Role } from '../utils/constants';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: Role; name: string; email: string };
    }
  }
}

export {};
