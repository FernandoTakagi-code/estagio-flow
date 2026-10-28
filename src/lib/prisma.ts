import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('A variável DATABASE_URL é obrigatória. Configure o arquivo .env.');
}

const poolMax = Number(process.env.DATABASE_POOL_MAX ?? 5);
if (!Number.isInteger(poolMax) || poolMax < 1 || poolMax > 20) {
  throw new Error('DATABASE_POOL_MAX deve ser um inteiro entre 1 e 20.');
}

const adapter = new PrismaPg({
  connectionString,
  max: poolMax,
  connectionTimeoutMillis: 10_000,
});

export const prisma = new PrismaClient({ adapter });
