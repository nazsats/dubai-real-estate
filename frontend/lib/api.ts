// Lightweight typed fetch wrapper around the FastAPI backend.
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TOKEN_KEY = "dbroker_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  del: <T>(p: string) => request<T>(p, { method: "DELETE" }),
};

// ── Types (mirror backend schemas) ───────────────────────────
export interface User {
  id: number;
  agency_id: number;
  email: string;
  full_name: string;
  role: string;
}
export interface Lead {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  status: string;
  score: number;
  budget_min?: number | null;
  budget_max?: number | null;
  preferred_locations?: string | null;
  bedrooms?: number | null;
  property_type?: string | null;
  notes?: string | null;
  created_at: string;
}
export interface Property {
  id: number;
  location: string;
  building: string;
  price: number;
  type: string;
  bedrooms: number;
  size_sqft: number;
  has_pool: boolean;
  has_gym: boolean;
  available: boolean;
  possession: string;
}
export interface DashboardData {
  stats: {
    leads: number;
    properties: number;
    won_deals: number;
    open_deals: number;
    won_value: number;
    pipeline_value: number;
    commission_won: number;
  };
  leads_by_stage: { stage: string; count: number }[];
  leads_by_source: { source: string; count: number }[];
  leads_over_time: { date: string; count: number }[];
  properties_by_type: { type: string; count: number }[];
  avg_price_by_area: { location: string; count: number; avg_price: number; avg_ppsf: number }[];
  area_markers: {
    location: string;
    count: number;
    avg_price: number;
    avg_ppsf: number;
    lat: number;
    lng: number;
  }[];
}
export interface PipelineData {
  stages: string[];
  counts: Record<string, number>;
  board: Record<string, Lead[]>;
}
