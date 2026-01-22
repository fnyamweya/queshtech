import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { existsSync } from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// TypeORM datasource options are read at import-time (before Nest ConfigModule).
// Load env here with the same precedence as AppModule: .env.local > .env.
const envPath = existsSync(path.join(process.cwd(), '.env.local'))
  ? path.join(process.cwd(), '.env.local')
  : path.join(process.cwd(), '.env');

dotenv.config({ path: envPath, override: true });

const isJest = typeof process.env.JEST_WORKER_ID !== 'undefined';
const syncEnv = (process.env.DB_SYNC ?? '').trim();
const isSyncEnabled = syncEnv === 'true';
const migrationsRunEnv = (process.env.DB_MIGRATIONS_RUN ?? '').trim();
const shouldRunMigrations = !isJest && !isSyncEnabled && migrationsRunEnv !== 'false';

const loggingEnv = (process.env.DB_LOGGING ?? '').trim();
const isLoggingEnabled = !isJest && loggingEnv === 'true';

const dbHost = (process.env.DB_HOST ?? '').trim();
const isLocalDbHost = dbHost === 'localhost' || dbHost === '127.0.0.1' || dbHost === 'db';
const sslEnv = (process.env.DB_SSL ?? '').trim();
const shouldUseSsl = sslEnv ? sslEnv === 'true' : Boolean(dbHost) && !isLocalDbHost;

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: +process.env.DB_PORT!,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [__dirname + '/**/*.entity.{ts,js}'],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  // In normal runs, use migrations (synchronize can attempt unsafe rewrites like bigint -> uuid).
  // In local dev, allow opting into synchronize to boot on a fresh DB even when the migration
  // history isn't a full baseline.
  // In Jest e2e, we rely on synchronize+dropSchema.
  synchronize: isJest || isSyncEnabled,
  dropSchema: isJest,
  migrationsRun: shouldRunMigrations,
  logging: isLoggingEnabled,
  ssl: shouldUseSsl
    ? {
        rejectUnauthorized: false,
      }
    : false,
});
