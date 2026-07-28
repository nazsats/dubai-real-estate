// Lightweight typed fetch wrapper around the FastAPI backend.
//
// NEXT_PUBLIC_* vars are inlined at build time, so this must be set in the
// Vercel project settings BEFORE deploying — changing it later needs a rebuild.
const CONFIGURED_API_URL = process.env.NEXT_PUBLIC_API_URL?.trim();

// Fall back to localhost for local development only. In a production build a
// missing value is a deploy mistake — without the guard in assertConfigured()
// every request silently targets the visitor's own machine and fails with an
// opaque network error.
const IS_MISCONFIGURED = !CONFIGURED_API_URL && process.env.NODE_ENV === "production";

export const API_BASE = (CONFIGURED_API_URL || "http://localhost:8000").replace(/\/+$/, "");
const BASE = API_BASE;

/** Checked per request rather than at module load: throwing at import time would
 *  crash Next's static prerender and fail the build instead of the deploy. */
function assertConfigured() {
  if (IS_MISCONFIGURED) {
    throw new ApiError(
      0,
      "NEXT_PUBLIC_API_URL is not set. Add it in your Vercel project's Environment " +
        "Variables (e.g. https://your-api.onrender.com), then redeploy."
    );
  }
}
const TOKEN_KEY = "dbroker_token";

// Set by the auth provider so the API layer can bounce the user to /login when
// their token expires, instead of leaving them clicking into failing requests.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

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

/** Turn a failed response into an ApiError, handling expired sessions. */
async function toApiError(res: Response, hadToken: boolean): Promise<ApiError> {
  let detail = res.statusText;
  try {
    const body = await res.json();
    if (body.detail) detail = body.detail;
  } catch {
    /* body wasn't JSON — keep the status text */
  }

  // An authenticated request that comes back 401 means the token expired or was
  // revoked. Sign the user out rather than let them keep hitting dead endpoints.
  // Login/signup 401s are excluded (no token was sent) so "wrong password" still
  // surfaces as a normal form error.
  if (res.status === 401 && hadToken) {
    clearToken();
    onUnauthorized?.();
    detail = "Your session expired. Please sign in again.";
  }

  return new ApiError(res.status, typeof detail === "string" ? detail : JSON.stringify(detail));
}

/** fetch() only rejects on network failure, which reads as a cryptic "Failed to
 *  fetch". Name the likely cause so a misconfigured API URL is obvious. */
async function safeFetch(url: string, init: RequestInit): Promise<Response> {
  assertConfigured();
  try {
    return await fetch(url, init);
  } catch {
    throw new ApiError(0, `Cannot reach the server at ${BASE}. Check that the API is running and that NEXT_PUBLIC_API_URL is correct.`);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await safeFetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) throw await toApiError(res, Boolean(token));
  if (res.status === 204) return undefined as T;
  return res.json();
}

async function uploadFile<T>(path: string, file: File): Promise<T> {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);
  const res = await safeFetch(`${BASE}${path}`, {
    method: "POST",
    body: form, // browser sets multipart boundary; don't set Content-Type
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw await toApiError(res, Boolean(token));
  return res.json();
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  del: <T>(p: string) => request<T>(p, { method: "DELETE" }),
  upload: uploadFile,
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
  language: string;
  source: string;
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
export interface Interaction {
  id: number;
  lead_id: number;
  user_id: number | null;
  channel: string;
  direction: string;
  body: string;
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
  image_url?: string | null;
  external_id?: string | null;
  source?: string;
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
  per_stage?: number;
}
export interface BriefingLead {
  lead_id: number;
  name: string;
  status: string;
  score: number;
  days_since_touch?: number;
  contacted?: boolean;
  reason?: string;
  budget_max?: number | null;
}
export interface BriefingData {
  generated_at: string;
  stats: { follow_ups: number; hot: number; going_cold: number; tasks_today: number; active_leads: number };
  follow_ups: BriefingLead[];
  hot_leads: BriefingLead[];
  going_cold: BriefingLead[];
  tasks_today: { id: number; title: string; lead_id: number | null; due_at: string | null; overdue: boolean }[];
}
export interface MarketData {
  stats: { listings: number; avg_price: number; avg_ppsf: number; areas: number };
  price_bands: { band: string; count: number }[];
  bedrooms_dist: { beds: string; count: number }[];
  type_mix: { type: string; count: number }[];
  price_range_by_type: { type: string; min: number; avg: number; max: number }[];
  ready_split: { status: string; count: number }[];
  ppsf_by_area: { location: string; count: number; avg_price: number; ppsf: number; avg_size: number }[];
  area_treemap: { location: string; count: number }[];
  scatter: { size: number; price: number; type: string }[];
  radar: { areas: string[]; data: Record<string, string | number>[] };
}
