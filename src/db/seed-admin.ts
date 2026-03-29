import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import * as schema from './schema';

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? 'Admin';

  if (!email || !password) {
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD env vars are required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  const existing = await db.query.adminUser.findFirst({
    where: eq(schema.adminUser.email, email),
  });

  if (existing) {
    console.log(`Admin "${email}" already exists — skipping.`);
    await pool.end();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(schema.adminUser).values({ email, password: passwordHash, name });

  console.log(`Admin "${email}" created successfully.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
