export interface Environment {
  browser: string;
  os: string;
  viewport: { width: number; height: number };
  user_agent: string;
  device_pixel_ratio: number;
}

export interface User {
  id: string;
  organization_id: string;
  email: string;
  name: string;
  role: 'admin' | 'member' | 'viewer';
  avatar_url?: string;
}

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  url_patterns: string[];
  linear_team_id?: string;
  created_at: string;
}

export interface ApiResponse<T> {
  data: T;
  meta: { request_id: string; timestamp: string };
}

export interface ApiError {
  error: { code: string; message: string; details?: unknown[] };
  meta: { request_id: string; timestamp: string };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: { cursor?: string; has_more: boolean; total?: number };
}
