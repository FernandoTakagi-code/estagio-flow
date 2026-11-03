import type { RequestHandler } from 'express';
import { findSessionUser } from './repository.js';
import { HttpError } from '../lib/errors.js';
import type { Actor } from './user-select.js';
import type { TokenService } from './token.js';

export function requireAuth(tokens: TokenService): RequestHandler {
  return async (req, res, next) => {
    const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization ?? '');
    if (!match?.[1]) throw new HttpError(401, 'Autenticação necessária.');
    let claims;
    try {
      claims = await tokens.verify(match[1]);
    } catch {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }
    const user = await findSessionUser(claims.sub);
    if (!user?.ativo || !user.senhaHash || user.tokenVersao !== claims.versao) {
      throw new HttpError(401, 'Sessão inválida ou expirada.');
    }
    const { senhaHash: _hash, tokenVersao: _version, ...actor } = user;
    res.locals.actor = actor;
    next();
  };
}

export const requireCoordinator: RequestHandler = (_req, res, next) => {
  const actor = res.locals.actor as Actor | undefined;
  if (actor?.perfil !== 'coordenacao') throw new HttpError(403, 'Acesso permitido somente à coordenação.');
  next();
};
