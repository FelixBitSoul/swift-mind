export async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text();

  if (!text) return res.statusText || `HTTP ${res.status}`;

  try {
    const parsed = JSON.parse(text) as unknown;
    if (typeof parsed === "object" && parsed !== null && "error" in parsed) {
      const err = (parsed as { error?: unknown }).error;
      if (typeof err === "string" && err.trim()) return err;
    }
  } catch {
    // non-JSON response
  }

  return text;
}

