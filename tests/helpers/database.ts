import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { readFile, readdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

export async function startTestDatabase(port = 55442) {
  const database = await PGlite.create();
  const root = new URL('../../prisma/migrations/', import.meta.url);
  for (const dir of (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    await database.exec(await readFile(new URL(`${dir.name}/migration.sql`, root), 'utf8'));
  }
  const socket = new PGLiteSocketServer({ db: database, host: '127.0.0.1', port, maxConnections: 10 });
  await socket.start();
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable`;
  process.env.DIRECT_URL = process.env.DATABASE_URL;
  // PGlite has a single backend connection; serialize access at the client pool.
  process.env.DATABASE_POOL_MAX = '1';
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  const { prisma } = await import('../../src/lib/prisma.js');
  const { createApp } = await import('../../src/app.js');
  const { createCoordinator } = await import('../../src/auth/service.js');
  return { database, socket, prisma, createApp, createCoordinator };
}
