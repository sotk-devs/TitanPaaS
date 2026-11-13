import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Repository } from 'typeorm';
import { TeamRolesGuard } from './team-roles.guard.js';
import { TeamMember } from '../entities/team-member.entity.js';
import { TeamRole } from '../enums/team-role.enum.js';

describe('TeamRolesGuard', () => {
  let guard: TeamRolesGuard;
  let reflector: jest.Mocked<Partial<Reflector>>;
  let memberRepo: jest.Mocked<Partial<Repository<TeamMember>>>;

  const createMockContext = (
    userId: string,
    teamId: string,
  ): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: userId },
          params: { id: teamId },
        }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn<any>(),
    };
    memberRepo = {
      findOne: jest.fn<any>(),
    };
    guard = new TeamRolesGuard(
      reflector as Reflector,
      memberRepo as Repository<TeamMember>,
    );
  });

  it('should allow access when no roles metadata is defined', async () => {
    (reflector.getAllAndOverride as jest.Mock<any>).mockReturnValue(undefined);
    const result = await guard.canActivate(createMockContext('u1', 't1'));
    expect(result).toBe(true);
  });

  it('should throw ForbiddenException when user has insufficient role', async () => {
    (reflector.getAllAndOverride as jest.Mock<any>).mockReturnValue([
      TeamRole.OWNER,
      TeamRole.ADMIN,
    ]);
    (memberRepo.findOne as jest.Mock<any>).mockResolvedValue({
      teamId: 't1',
      userId: 'u1',
      role: TeamRole.VIEWER,
    });

    await expect(
      guard.canActivate(createMockContext('u1', 't1')),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should allow access when user holds one of required roles', async () => {
    (reflector.getAllAndOverride as jest.Mock<any>).mockReturnValue([
      TeamRole.OWNER,
      TeamRole.ADMIN,
    ]);
    (memberRepo.findOne as jest.Mock<any>).mockResolvedValue({
      teamId: 't1',
      userId: 'u1',
      role: TeamRole.ADMIN,
    });

    const result = await guard.canActivate(createMockContext('u1', 't1'));
    expect(result).toBe(true);
  });
});
