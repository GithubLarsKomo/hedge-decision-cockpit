export function isValidBearerToken(header: string | null): boolean {
  const expected = process.env.N8N_INGEST_TOKEN;
  if (!expected) return false;
  return header === `Bearer ${expected}`;
}
