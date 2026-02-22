import { DuckDBInstance } from '@duckdb/node-api';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

const DB_PATH = process.env.DUCKDB_PATH || './trade-up.duckdb';
const MIGRATIONS_DIR = resolve(import.meta.dirname, '.');

async function migrate() {
  console.log(`Opening database: ${DB_PATH}`);
  const instance = await DuckDBInstance.create(DB_PATH);
  const conn = await instance.connect();

  // Ensure _migrations table exists
  await conn.run(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name VARCHAR PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT current_timestamp
    )
  `);

  // Get already-applied migrations
  const appliedResult = await conn.run('SELECT name FROM _migrations ORDER BY name');
  const appliedRows = await appliedResult.getRows();
  const applied = new Set(appliedRows.map(r => r[0]));

  // Find .sql migration files, sorted by name
  const files = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  SKIP  ${file} (already applied)`);
      continue;
    }

    console.log(`  APPLY ${file}`);
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');

    // Strip comment-only lines, then split on semicolons
    const stripped = sql
      .split('\n')
      .map(line => line.startsWith('--') ? '' : line)
      .join('\n');
    const statements = stripped
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        await conn.run(stmt);
      } catch (err) {
        console.error(`  ERROR in ${file}:`);
        console.error(`  Statement: ${stmt.substring(0, 120)}...`);
        console.error(`  ${err.message}`);
        process.exit(1);
      }
    }

    // Record migration
    await conn.run(`INSERT INTO _migrations (name) VALUES ('${file}')`);
  }

  // List all tables for verification
  const tablesResult = await conn.run('SHOW TABLES');
  const tableRows = await tablesResult.getRows();
  const tables = tableRows.map(r => r[0]);

  console.log(`\nMigration complete. ${tables.length} tables:`);
  tables.forEach(t => console.log(`  - ${t}`));
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
