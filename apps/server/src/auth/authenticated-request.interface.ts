import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    id?: string;
    phone?: string;
    role?: string;
    [key: string]: unknown;
  };
}
