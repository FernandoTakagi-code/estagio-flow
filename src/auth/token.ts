import { randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';

const issuer = 'estagio-flow';
const audience = 'estagio-flow-api';
export const tokenDurationSeconds = 15 * 60;

export function createTokenService(secret: string | undefined) {
  if (!secret || !/^[a-f0-9]{64,}$/i.test(secret) || secret.length % 2 !== 0) {
    throw new Error('Configure JWT_SECRET com pelo menos 32 bytes aleatórios em hexadecimal.');
  }
  const key = Buffer.from(secret, 'hex');

  return {
    async issue(id: string, tokenVersao: number) {
      return new SignJWT({ versao: tokenVersao })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuer(issuer).setAudience(audience).setSubject(id)
        .setJti(randomUUID()).setIssuedAt().setExpirationTime('15m').sign(key);
    },
    async verify(token: string) {
      const { payload } = await jwtVerify(token, key, {
        issuer, audience, algorithms: ['HS256'], typ: 'JWT',
        requiredClaims: ['sub', 'exp', 'iat', 'jti'],
      });
      return z.object({ sub: z.uuid(), versao: z.number().int().nonnegative() }).parse(payload);
    },
  };
}

export type TokenService = ReturnType<typeof createTokenService>;
