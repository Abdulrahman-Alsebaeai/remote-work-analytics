import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles';

describe('RolesGuard', () => {
  const context = (role: string) => ({
    getHandler: () => 'handler', getClass: () => 'class',
    switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
  }) as unknown as ExecutionContext;

  it('allows a declared role', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['ADMIN', 'MANAGER']) } as unknown as Reflector;
    expect(new RolesGuard(reflector).canActivate(context('MANAGER'))).toBe(true);
  });

  it('rejects a role that was not declared', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['ADMIN', 'MANAGER']) } as unknown as Reflector;
    expect(new RolesGuard(reflector).canActivate(context('EMPLOYEE'))).toBe(false);
  });
});
