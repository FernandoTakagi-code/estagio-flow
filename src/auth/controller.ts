import type { Request, Response } from 'express';
import type { Actor } from './user-select.js';
import { loginSchema, acceptInviteSchema } from './schemas.js';
import { authenticate, acceptInvite, logout } from './service.js';
import { createTokenService, tokenDurationSeconds } from './token.js';

export function createAuthController(tokens: ReturnType<typeof createTokenService>) {
  return {
    async login(req: Request, res: Response) {
      const input = loginSchema.parse(req.body);
      const { user, tokenVersao } = await authenticate(input.email, input.senha);
      res.json({ accessToken: await tokens.issue(user.id, tokenVersao), tokenType: 'Bearer', expiresIn: tokenDurationSeconds, usuario: user });
    },
    async accept(req: Request, res: Response) { const input = acceptInviteSchema.parse(req.body); await acceptInvite(input.token, input.senha); res.status(204).end(); },
    me(_req: Request, res: Response) { res.json({ usuario: res.locals.actor }); },
    async logout(_req: Request, res: Response) { await logout(res.locals.actor as Actor); res.status(204).end(); },
  };
}
