import "dotenv/config";
import { defineConfig } from "prisma/config";

// Placeholder is only used so `prisma generate` can run in CI/Vercel
// when DATABASE_URL is not injected yet. Runtime still requires a real URL.
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/postgres?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
