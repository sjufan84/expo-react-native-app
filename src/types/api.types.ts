/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface TokenResponse {
  token: string;
  roomName: string;
  participantIdentity: string;
  expiresAt: number;
}

export interface ImageUploadResponse {
  url: string;
  key: string;
  size: number;
  contentType: string;
}

export interface ErrorResponse {
  code: string;
  message: string;
  details?: any;
}

export interface RequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}