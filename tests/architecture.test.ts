import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

async function sources(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  return (await Promise.all(entries.filter((entry) => entry.name !== 'generated').map((entry) => entry.isDirectory() ? sources(join(root, entry.name)) : Promise.resolve(entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? [join(root, entry.name)] : [])))).flat();
}
describe('fronteiras da arquitetura', () => {
  it('controllers e serviços não executam consultas ou importam o client do banco', async () => {
    const files = (await sources('src')).filter((file) => /(?:controller|service|course-hours)\.ts$/.test(file));
    for (const file of files) {
      const code = await readFile(file, 'utf8');
      expect(code, file).not.toMatch(/from ['"].*lib\/prisma\.js['"]/);
      expect(code, file).not.toMatch(/\b(?:prisma|tx)\.(?:\$queryRaw|\$executeRaw|\$transaction|usuario|estagio|registroEstagio|vinculoEstagio|matriculaTurma|conviteUsuario|importacaoAlunos)\b/);
    }
  });
  it('controllers dependem dos serviços e não dos repositories', async () => {
    for (const file of (await sources('src')).filter((item) => item.endsWith('controller.ts'))) {
      expect(await readFile(file, 'utf8'), file).not.toMatch(/from ['"][^'"]*repository\.js['"]/);
    }
  });
  it('frontend não importa persistência nem acessa credenciais do backend', async () => {
    for (const file of await sources('web/src')) {
      const code = await readFile(file, 'utf8');
      expect(code, file).not.toMatch(/from ['"][^'"]*(?:@prisma|src\/generated|src\/lib\/prisma)/);
      expect(code, file).not.toMatch(/(?:process\.env|import\.meta\.env)\.(?:DATABASE_URL|DIRECT_URL|JWT_SECRET)/);
    }
  });
});
