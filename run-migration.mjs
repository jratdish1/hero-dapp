import { createConnection } from 'mysql2/promise';
import { readFileSync } from 'fs';

const sql = readFileSync('drizzle/0006_slim_lionheart.sql', 'utf8');

async function run() {
  const conn = await createConnection(process.env.DATABASE_URL);
  try {
    await conn.execute(sql);
    console.log('Migration applied successfully');
  } catch (err) {
    if (err.code === 'ER_TABLE_EXISTS_ERROR') {
      console.log('Table already exists, skipping');
    } else {
      throw err;
    }
  } finally {
    await conn.end();
  }
}

run().catch(e => { console.error(e); process.exit(1); });
