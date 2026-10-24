<<<<<<< HEAD
import * as fs from 'fs';
import * as path from 'path';

// Tự động đọc file .env thủ công để lấy DATABASE_URL
try {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    for (const line of envFile.split('\n')) {
      const match = line.match(/^([^#\s=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
} catch (e) {
  console.error('Could not load .env file', e);
}

export default {
  datasource: {
    url: process.env.DATABASE_URL,
  },
=======
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
>>>>>>> origin/main
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
<<<<<<< HEAD
};
=======
  datasource: {
    url: env('DATABASE_URL'),
  },
});
>>>>>>> origin/main
