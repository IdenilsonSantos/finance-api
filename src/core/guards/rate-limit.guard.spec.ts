import { HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitGuard, RateLimitOptions } from './rate-limit.guard';

function context(ip: string, body: Record<string, unknown> = {}) {
  const res = { setHeader: jest.fn() };
  const handler = function login() {};
  class AuthController {}
  return {
    res,
    ctx: {
      getHandler: () => handler,
      getClass: () => AuthController,
      switchToHttp: () => ({
        getRequest: () => ({ ip, body }),
        getResponse: () => res,
      }),
    } as any,
  };
}

describe('RateLimitGuard', () => {
  const options: RateLimitOptions = { limit: 2, windowMs: 60_000, perEmail: true };
  let guard: RateLimitGuard;

  beforeEach(() => {
    RateLimitGuard.reset();
    const reflector = { get: jest.fn().mockReturnValue(options) } as unknown as Reflector;
    guard = new RateLimitGuard(reflector);
  });

  it('bloqueia após o limite com 429 e Retry-After', () => {
    const { ctx, res } = context('1.1.1.1', { email: 'a@a.com' });
    expect(guard.canActivate(ctx)).toBe(true);
    expect(guard.canActivate(ctx)).toBe(true);
    expect(() => guard.canActivate(ctx)).toThrow(HttpException);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });

  it('conta separadamente por e-mail e por IP', () => {
    const a = context('1.1.1.1', { email: 'a@a.com' }).ctx;
    const b = context('1.1.1.1', { email: 'B@a.com' }).ctx;
    const c = context('2.2.2.2', { email: 'a@a.com' }).ctx;
    guard.canActivate(a);
    guard.canActivate(a);
    expect(guard.canActivate(b)).toBe(true);
    expect(guard.canActivate(c)).toBe(true);
  });

  it('libera de novo quando a janela expira', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const { ctx } = context('1.1.1.1', { email: 'a@a.com' });
    guard.canActivate(ctx);
    guard.canActivate(ctx);
    now.mockReturnValue(1_000_000 + 60_001);
    expect(guard.canActivate(ctx)).toBe(true);
    now.mockRestore();
  });
});
