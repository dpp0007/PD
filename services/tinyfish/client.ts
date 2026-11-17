// Server-side only. Endpoints/fields per https://docs.tinyfish.ai (read 2026-11-10).
import "server-only";

const BASE = "https://agent.tinyfish.ai";

export type RunStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type Run = {
  run_id: string;
  status: RunStatus;
  result?: unknown;
  streaming_url?: string; // read-only live view (documented)
  num_of_steps?: number;
  error?: { code?: string; message?: string; category?: string } | null;
};
export type RunInput = {
  url: string;
  goal: string;
  output_schema?: object;
  browser_profile?: "lite" | "stealth";
  use_profile?: boolean; // saved browser context profile
  profile_id?: string;
  use_vault?: boolean; // 1Password / Bitwarden vault; TOTP only if the vault item has a TOTP field
  credential_item_ids?: string[];
  proxy_config?: { enabled?: boolean; type?: "tinyfish"; country_code?: string }; // ISO alpha-2, default US
  agent_config?: { max_steps?: number; max_duration_seconds?: number };
};

async function tf<T>(path: string, init?: RequestInit): Promise<T> {
  const key = process.env.TINYFISH_API_KEY;
  if (!key) throw new Error("TINYFISH_API_KEY not set");
  const r = await fetch(BASE + path, {
    ...init,
    cache: "no-store",
    headers: { "X-API-Key": key, "Content-Type": "application/json", ...init?.headers },
  });
  if (!r.ok) throw new Error(`TinyFish ${r.status} ${path}: ${(await r.text()).slice(0, 300)}`);
  return r.json() as Promise<T>;
}

export const startRun = (b: RunInput) =>
  tf<{ run_id: string; error: unknown }>("/v1/automation/run-async", { method: "POST", body: JSON.stringify(b) });
export const getRun = (id: string) => tf<Run>(`/v1/runs/${encodeURIComponent(id)}`);
export const cancelRun = (id: string) => tf<unknown>(`/v1/runs/${encodeURIComponent(id)}/cancel`, { method: "POST" });
export const listVaultItems = () => tf<unknown>("/v1/vault/items");
