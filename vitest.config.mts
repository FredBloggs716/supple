import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";
import path from "node:path";

// Windows-on-ARM64: no native workerd build; run the x64 binary under emulation.
process.env.MINIFLARE_WORKERD_PATH ??= path.resolve(
  import.meta.dirname,
  "node_modules/@cloudflare/workerd-windows-64/bin/workerd.exe",
);

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations(path.resolve(import.meta.dirname, "migrations"));
  return {
    test: {
      setupFiles: ["./test/apply-migrations.ts"],
      poolOptions: {
        workers: {
          // Windows + emulated workerd: per-test isolated storage stacking fails
          // with EBUSY temp-dir locks. Share one worker/storage and clean up
          // explicitly in D1 tests instead.
          isolatedStorage: false,
          singleWorker: true,
          wrangler: { configPath: "./wrangler.toml" },
          miniflare: {
            bindings: {
              TEST_MIGRATIONS: migrations,
              STC_SETUP_TOKEN: "test-setup-token",
              STC_PUBLIC_ORIGIN: "",
            },
          },
        },
      },
    },
  };
});
