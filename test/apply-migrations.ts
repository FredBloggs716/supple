import { applyD1Migrations, env } from "cloudflare:test";

// Each isolated test Worker gets the schema applied before its tests run.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
