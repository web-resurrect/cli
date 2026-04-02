import Conf from 'conf';

// Global flags set by the root command's preAction hook
declare global {
  var __wrAutoYes: boolean;
  var __wrJsonOutput: boolean;
}

// Runtime override for base URL (--base-url flag)
let runtimeBaseUrl: string | null = null;

export function setRuntimeBaseUrl(url: string): void {
  runtimeBaseUrl = url;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

const config = new Conf<{ apiKey: string; baseUrl: string; wisewandKey: string }>({
  projectName: 'wr',
  schema: {
    apiKey: { type: 'string', default: '' },
    baseUrl: { type: 'string', default: 'https://web-resurrect.com' },
    wisewandKey: { type: 'string', default: '' },
  },
});

export function getConfig() {
  return config;
}

export function getApiKey(): string {
  return config.get('apiKey');
}

export function setApiKey(key: string): void {
  config.set('apiKey', key);
}

export function getBaseUrl(): string {
  return runtimeBaseUrl || config.get('baseUrl');
}

export function getWisewandKey(): string {
  return config.get('wisewandKey');
}

export function setWisewandKey(key: string): void {
  config.set('wisewandKey', key);
}

export function ensureAuth(): string {
  const key = getApiKey();
  if (!key) {
    throw new Error('Not authenticated. Run `wr login` first.');
  }
  return key;
}

export async function apiRequest<T = unknown>(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  params?: Record<string, string | number | undefined>,
): Promise<ApiResponse<T>> {
  const apiKey = ensureAuth();
  const baseUrl = getBaseUrl();

  const url = new URL(`/api/v1${path}`, baseUrl);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const options: RequestInit = { method, headers };
  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url.toString(), options);
  const json = await response.json() as ApiResponse<T> | ApiError;

  if (!response.ok) {
    const err = json as ApiError;
    const code = err.error?.code || response.status;
    const message = err.error?.message || response.statusText;
    throw new Error(`API Error [${code}]: ${message}`);
  }

  return json as ApiResponse<T>;
}

export async function apiGet<T = unknown>(
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<ApiResponse<T>> {
  return apiRequest<T>('GET', path, undefined, params);
}

export async function apiPost<T = unknown>(
  path: string,
  body?: Record<string, unknown>,
): Promise<ApiResponse<T>> {
  return apiRequest<T>('POST', path, body);
}

export async function apiDelete<T = unknown>(
  path: string,
): Promise<ApiResponse<T>> {
  return apiRequest<T>('DELETE', path);
}
