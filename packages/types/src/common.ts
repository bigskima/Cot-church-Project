export interface ApiMeta {
  requestId: string;
  nextCursor?: string;
  [key: string]: unknown;
}

export interface ApiSuccess<T> {
  data: T;
  meta: ApiMeta;
}

export interface ApiFailure {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
