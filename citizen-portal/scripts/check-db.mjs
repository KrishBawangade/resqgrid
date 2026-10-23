import pkg from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const { PrismaClient } = pkg;

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- ResQGrid Neon + PostgreSQL Health Check ---');
  try {
    await prisma.$connect();
    console.log('✓ Successfully connected to Neon PostgreSQL database via Prisma Client!');

    const reliefRequestCount = await prisma.reliefRequest.count();
    console.log('✓ ReliefRequest table exists. Record count:', reliefRequestCount);
    
    const depotCount = await prisma.reliefDepot.count();
    console.log('✓ ReliefDepot table exists. Record count:', depotCount);
    
    const stockCount = await prisma.depotStock.count();
    console.log('✓ DepotStock table exists. Record count:', stockCount);
    
    const orderCount = await prisma.replenishmentOrder.count();
    console.log('✓ ReplenishmentOrder table exists. Record count:', orderCount);
    
    const auditCount = await prisma.auditLog.count();
    console.log('✓ AuditLog table exists. Record count:', auditCount);

  } catch (error) {
    console.error('✗ Connection or Query Error:', error);
  } finally {
    await prisma.$disconnect();
    console.log('--- Health Check Complete ---');
  }
}

main();
