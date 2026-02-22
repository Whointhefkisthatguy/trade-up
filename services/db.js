import { DuckDBInstance } from '@duckdb/node-api';
import dotenv from 'dotenv';

dotenv.config();

const DB_PATH = process.env.DUCKDB_PATH || './trade-up.duckdb';

let instance = null;
let connection = null;

/**
 * Get or create the singleton DuckDB connection.
 * @returns {Promise<import('@duckdb/node-api').DuckDBConnection>}
 */
export async function getConnection() {
  if (!connection) {
    instance = await DuckDBInstance.create(DB_PATH);
    connection = await instance.connect();
  }
  return connection;
}

/**
 * Run a SQL query and return row objects.
 * @param {string} sql - SQL statement to execute
 * @returns {Promise<Array<Object>>}
 */
export async function query(sql) {
  const conn = await getConnection();
  const result = await conn.run(sql);
  return result.getRowObjects();
}

/**
 * Run a SQL statement (INSERT, UPDATE, DELETE, DDL).
 * @param {string} sql - SQL statement to execute
 * @returns {Promise<import('@duckdb/node-api').DuckDBMaterializedResult>}
 */
export async function run(sql) {
  const conn = await getConnection();
  return conn.run(sql);
}

/**
 * Close the database connection and instance.
 */
export async function close() {
  if (connection) {
    connection = null;
  }
  if (instance) {
    instance = null;
  }
}
