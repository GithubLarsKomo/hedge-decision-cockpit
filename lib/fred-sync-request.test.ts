import assert from 'node:assert/strict';
import test from 'node:test';
import { InvalidFredSyncPayloadError, parseFredSyncRequestBody } from './fred-sync-request';

test('accepts an explicit historical range', () => {
  assert.deepEqual(
    parseFredSyncRequestBody('{"observationStart":"1990-01-02","observationEnd":"2026-08-04"}'),
    { observationStart: '1990-01-02', observationEnd: '2026-08-04' }
  );
});

test('accepts an empty JSON object for the default recent sync', () => {
  assert.deepEqual(parseFredSyncRequestBody('{}'), {});
});

test('rejects malformed JSON instead of falling back to the default sync', () => {
  assert.throws(
    () => parseFredSyncRequestBody('{observationStart:1990-01-02}'),
    InvalidFredSyncPayloadError
  );
});

test('rejects non-object JSON payloads', () => {
  for (const raw of ['[]', 'null', '"text"', '42']) {
    assert.throws(() => parseFredSyncRequestBody(raw), InvalidFredSyncPayloadError);
  }
});
