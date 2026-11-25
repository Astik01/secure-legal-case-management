import axios, { AxiosError } from 'axios';
import type { Paged } from '../types';

/** Same-origin in dev (Vite proxies /api) and in production behind a reverse proxy. */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  withCredentials: true, // session lives in an httpOnly cookie; JS never sees the token
  timeout: 60000,
});

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: { path: string; message: string }[],
  ) {
    super(message);
  }
}

type Envelope<T> = { success: boolean; message?: string; data: T; meta?: Paged<T>['meta'] };

api.interceptors.response.use(
  (r) => r,
  (err: AxiosError<{ message?: string; error?: { code?: string; details?: ApiError['details'] } }>) => {
    const status = err.response?.status ?? 0;
    const body = err.response?.data;
    const message =
      body?.message ?? (status === 0 ? 'Cannot reach the server. Check your connection and try again.' : 'Something went wrong');
    return Promise.reject(new ApiError(message, status, body?.error?.code, body?.error?.details));
  },
);

export async function get<T>(url: string, params?: object): Promise<T> {
  return (await api.get<Envelope<T>>(url, { params })).data.data;
}
export async function getPaged<T>(url: string, params?: object): Promise<Paged<T>> {
  const res = (await api.get<Envelope<T[]>>(url, { params })).data;
  return { items: res.data, meta: res.meta ?? { page: 1, limit: res.data.length, total: res.data.length, totalPages: 1 } };
}
export async function send<T>(method: 'post' | 'put' | 'patch' | 'delete', url: string, body?: unknown): Promise<T> {
  return (await api.request<Envelope<T>>({ method, url, data: body })).data.data;
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

/** Strips empty strings so optional fields are omitted instead of failing server validation. */
export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== '' && v !== undefined && v !== null),
  ) as Partial<T>;
}
