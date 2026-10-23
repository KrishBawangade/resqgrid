import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, env } from '@prisma/config';

// Ensure .env.local variables are loaded if .env is absent
if (!process.env.DATABASE_URL) {
  try {
    const envLocalPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envLocalPath)) {
      const content = fs.readFileSync(envLocalPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [k, ...v] = trimmed.split('=');
          const val = v.join('=').replace(/^["']|["']$/g, '');
          process.env[k.trim()] = val.trim();
        }
      }
    }
  } catch {}
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
});
