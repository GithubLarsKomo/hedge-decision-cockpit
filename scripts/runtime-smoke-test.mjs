const baseUrl = process.env.SMOKE_TEST_BASE_URL ?? 'http://127.0.0.1:3000';
const timeoutMs = Number(process.env.SMOKE_TEST_TIMEOUT_MS ?? 30000);
const retryDelayMs = 500;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForLiveness() {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/live`, { cache: 'no-store' });
      const body = await response.json();
      assert(response.status === 200, `liveness returned HTTP ${response.status}`);
      assert(body.status === 'alive', `liveness status was ${String(body.status)}`);
      assert(typeof body.version === 'string' && body.version.length > 0, 'liveness version was missing');
      assert(typeof body.timestamp === 'string' && !Number.isNaN(Date.parse(body.timestamp)), 'liveness timestamp was invalid');
      return body;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  throw new Error(`application did not become live within ${timeoutMs} ms: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function waitForReady() {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`, { cache: 'no-store' });
      const body = await response.json();
      const databaseCheck = Array.isArray(body.checks)
        ? body.checks.find((check) => check && check.name === 'database')
        : undefined;
      const databaseDetail = databaseCheck?.detail ?? 'no database detail';

      assert(response.status === 200, `health returned HTTP ${response.status}: ${databaseDetail}`);
      assert(body.status === 'ready', `health status was ${String(body.status)}: ${databaseDetail}`);
      assert(databaseCheck?.ok === true, `database readiness check was not up: ${databaseDetail}`);
      return body;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  throw new Error(`application did not become ready within ${timeoutMs} ms: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function verifyTestPage() {
  const response = await fetch(`${baseUrl}/test`, { cache: 'no-store' });
  const html = await response.text();
  assert(response.status === 200, `/test returned HTTP ${response.status}`);
  assert(html.includes('BESTANDEN'), '/test did not contain the expected BESTANDEN marker');
}

await waitForLiveness();
const health = await waitForReady();
await verifyTestPage();
console.log(`Runtime smoke test passed for version ${health.version ?? 'unknown'}.`);
