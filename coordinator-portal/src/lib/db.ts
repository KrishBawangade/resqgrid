import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import dns from 'dns';
import { Pool } from 'pg';

// Resilient DNS resolver for Neon PostgreSQL endpoints
// Resolves neon.tech via public DNS (Google 8.8.8.8, Cloudflare 1.1.1.1) if local/ISP DNS fails
if (typeof window === 'undefined') {
  try {
    const origLookup = dns.lookup;
    const resolver = new dns.Resolver();
    resolver.setServers(['8.8.8.8', '1.1.1.1']);

    (dns as any).lookup = function (
      hostname: string,
      options: any,
      callback: (err: NodeJS.ErrnoException | null, address: any, family?: number) => void
    ) {
      if (typeof options === 'function') {
        callback = options;
        options = {};
      }
      if (hostname && hostname.includes('neon.tech')) {
        resolver.resolve4(hostname, (err, addrs) => {
          if (!err && addrs && addrs.length > 0) {
            if (options && options.all) {
              return callback(
                null,
                addrs.map((a) => ({ address: a, family: 4 }))
              );
            }
            return callback(null, addrs[0], 4);
          }
          return origLookup(hostname, options, callback);
        });
      } else {
        return origLookup(hostname, options, callback);
      }
    };
  } catch (dnsErr) {
    console.warn('DNS lookup patch warning:', dnsErr);
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
  const pool = globalForPrisma.pool ?? new Pool({ connectionString });
  globalForPrisma.pool = pool;
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

export default db;
