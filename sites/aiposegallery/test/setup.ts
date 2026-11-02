import { applyD1Migrations, env } from 'cloudflare:test';
import type { D1Migration } from '@cloudflare/vitest-plugin';

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS as D1Migration[]);
