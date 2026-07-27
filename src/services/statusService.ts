const API_URL = import.meta.env.VITE_API_URL.replace(/\/$/, "");

export async function getBackendStatus() {
  const response = await fetch(`${API_URL}/health`);

  if (!response.ok) {
    throw new Error("Backend is unavailable");
  }

  return await response.json();
}