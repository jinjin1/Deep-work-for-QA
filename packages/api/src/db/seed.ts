import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';

export function seedDefaults(db: BetterSQLite3Database<any>) {
  const now = new Date().toISOString();

  // INSERT OR IGNORE for idempotency
  db.run(sql`
    INSERT OR IGNORE INTO organizations (id, name, slug, plan, created_at)
    VALUES ('org-default', 'Default Org', 'default', 'free', ${now})
  `);

  db.run(sql`
    INSERT OR IGNORE INTO projects (id, organization_id, name, url_patterns, created_at)
    VALUES ('proj-default', 'org-default', 'Default Project', '[]', ${now})
  `);

  db.run(sql`
    INSERT OR IGNORE INTO users (id, organization_id, email, name, role, created_at)
    VALUES ('user-default', 'org-default', 'default@deepwork.dev', 'Default User', 'member', ${now})
  `);

  console.log('[seed] Default organization, project, and user ensured.');
}
