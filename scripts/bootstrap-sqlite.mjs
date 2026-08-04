import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const databaseUrl = process.env.DATABASE_URL ?? '';
if (!databaseUrl.startsWith('file:')) {
  throw new Error('DATABASE_URL must be a SQLite file: URL.');
}

const databasePath = databaseUrl.slice('file:'.length);
if (!databasePath) throw new Error('DATABASE_URL must include a SQLite file path.');

if (!existsSync(databasePath)) {
  console.log('Initializing SQLite database...');
  mkdirSync(dirname(databasePath), { recursive: true });
  copyFileSync('/app/bootstrap/hedge.db', databasePath);
}
