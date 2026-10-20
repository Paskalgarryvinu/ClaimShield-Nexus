/**
 * ClaimShield Nexus API Client
 */
const API_BASE = "http://localhost:8000/api";

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/system/health`);
  if (!res.ok) throw new Error("Health check failed");
  return res.json();
}

export async function fetchStats() {
  const res = await fetch(`${API_BASE}/data/stats`);
  if (!res.ok) throw new Error("Failed to fetch data stats");
  return res.json();
}

export async function reloadDataset() {
  const res = await fetch(`${API_BASE}/data/reload`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to reload dataset");
  return res.json();
}

export async function fetchConfig() {
  const res = await fetch(`${API_BASE}/config`);
  if (!res.ok) throw new Error("Failed to fetch config");
  return res.json();
}

export async function updateConfig(configData) {
  const res = await fetch(`${API_BASE}/config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(configData)
  });
  if (!res.ok) throw new Error("Failed to update config");
  return res.json();
}

export async function fetchAuditLog(limit = 50) {
  const res = await fetch(`${API_BASE}/audit-log?limit=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch audit log");
  return res.json();
}
