import 'dotenv/config';
import { createApp } from './app.js';
import { prisma } from './lib/prisma.js';
import { startEmailWorker } from './email/service.js';

const port = Number(process.env.PORT) || 3000;

const server = createApp().listen(port, () => {
  console.log(`API rodando na porta ${port}`);
});
const stopEmailWorker = startEmailWorker();

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    stopEmailWorker();
    const timeout = setTimeout(() => process.exit(1), 10_000);
    timeout.unref();
    server.close(() => {
      void prisma.$disconnect().then(() => process.exit(0), () => process.exit(1));
    });
  });
}
