import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';

export interface RateLimitOptions {
  /** Tentativas permitidas por janela. */
  limit: number;
  /** Duração da janela em ms. */
  windowMs: number;
  /** Inclui o e-mail do corpo na chave (limita por conta, não só por IP). */
  perEmail?: boolean;
}

const RATE_LIMIT_KEY = 'rateLimit';

/** Limita tentativas por IP (e opcionalmente por e-mail) numa janela fixa. */
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Rate limit em memória para rotas sensíveis (login, cadastro, recuperação
 * de senha), contra força bruta e abuso de envio de e-mails. Funciona por
 * instância: com várias réplicas, troque o Map por um store compartilhado
 * (ex.: Redis). Atrás de proxy, configure TRUST_PROXY para que `req.ip`
 * seja o IP real do cliente.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private static readonly buckets = new Map<string, Bucket>();
  private static lastSweep = 0;

  constructor(private readonly reflector: Reflector) {}

  /** Uso em testes. */
  static reset(): void {
    RateLimitGuard.buckets.clear();
  }

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.get<RateLimitOptions | undefined>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );
    if (!options) return true;

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const now = Date.now();
    this.sweep(now);

    const body = (req.body ?? {}) as { email?: unknown };
    const email =
      options.perEmail && typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const route = `${context.getClass().name}.${context.getHandler().name}`;
    const key = `${route}:${req.ip ?? 'unknown'}:${email}`;

    const bucket = RateLimitGuard.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      RateLimitGuard.buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return true;
    }

    bucket.count++;
    if (bucket.count > options.limit) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      const minutes = Math.ceil(retryAfter / 60);
      throw new HttpException(
        `Muitas tentativas. Tente novamente em ${minutes} minuto${minutes > 1 ? 's' : ''}.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  private sweep(now: number): void {
    if (now - RateLimitGuard.lastSweep < 60_000) return;
    RateLimitGuard.lastSweep = now;
    for (const [key, bucket] of RateLimitGuard.buckets) {
      if (bucket.resetAt <= now) RateLimitGuard.buckets.delete(key);
    }
  }
}
