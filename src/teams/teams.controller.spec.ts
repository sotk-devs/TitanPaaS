import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { TeamsController } from './teams.controller.js';
import { TeamsService } from './teams.service.js';
import { TeamRolesGuard } from './guards/team-roles.guard.js';
import { TeamRole } from './enums/team-role.enum.js';

describe('TeamsController', () => {
  let controller: TeamsController;
  let service: jest.Mocked<Partial<TeamsService>>;

  const mockReq = {
    user: { id: 'uuid-user-1', email: 'owner@titanpaas.dev', name: 'Owner' },
  };
  const teamId = 'uuid-team-1';
  const targetUserId = 'uuid-user-2';

  beforeEach(async () => {
    service = {
      create: jest.fn<any>(),
      findAllForUser: jest.fn<any>(),
      findOne: jest.fn<any>(),
      update: jest.fn<any>(),
      remove: jest.fn<any>(),
      getMembers: jest.fn<any>(),
      addMember: jest.fn<any>(),
      updateMemberRole: jest.fn<any>(),
      removeMember: jest.fn<any>(),
      getTeamProjects: jest.fn<any>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TeamsController],
      providers: [
        { provide: TeamsService, useValue: service },
        Reflector,
        {
          provide: TeamRolesGuard,
          useValue: { canActivate: jest.fn<any>().mockResolvedValue(true) },
        },
      ],
    }).compile();

    controller = module.get<TeamsController>(TeamsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a team', async () => {
    const dto = { name: 'Core Team' };
    (service.create as jest.Mock<any>).mockResolvedValue({
      id: teamId,
      ...dto,
      myRole: TeamRole.OWNER,
    });

    const res = await controller.create(mockReq, dto);
    expect(service.create).toHaveBeenCalledWith(mockReq.user.id, dto);
    expect(res.myRole).toBe(TeamRole.OWNER);
  });

  it('should list teams for user', async () => {
    (service.findAllForUser as jest.Mock<any>).mockResolvedValue([]);
    const res = await controller.findAll(mockReq);
    expect(service.findAllForUser).toHaveBeenCalledWith(mockReq.user.id);
    expect(res).toEqual([]);
  });

  it('should get team details', async () => {
    (service.findOne as jest.Mock<any>).mockResolvedValue({ id: teamId });
    const res = await controller.findOne(mockReq, teamId);
    expect(service.findOne).toHaveBeenCalledWith(mockReq.user.id, teamId);
    expect(res.id).toBe(teamId);
  });

  it('should update team', async () => {
    (service.update as jest.Mock<any>).mockResolvedValue({
      id: teamId,
      name: 'New Name',
    });
    const res = await controller.update(mockReq, teamId, { name: 'New Name' });
    expect(service.update).toHaveBeenCalledWith(mockReq.user.id, teamId, {
      name: 'New Name',
    });
    expect(res.name).toBe('New Name');
  });

  it('should delete team', async () => {
    (service.remove as jest.Mock<any>).mockResolvedValue({
      message: 'deleted',
    });
    const res = await controller.remove(mockReq, teamId);
    expect(service.remove).toHaveBeenCalledWith(mockReq.user.id, teamId);
    expect(res.message).toBe('deleted');
  });

  it('should list, add, update, and remove members', async () => {
    (service.getMembers as jest.Mock<any>).mockResolvedValue([]);
    await controller.getMembers(mockReq, teamId);
    expect(service.getMembers).toHaveBeenCalledWith(mockReq.user.id, teamId);

    const addDto = { email: 'dev@titanpaas.dev', role: TeamRole.DEVELOPER };
    (service.addMember as jest.Mock<any>).mockResolvedValue({
      userId: targetUserId,
      role: TeamRole.DEVELOPER,
    });
    await controller.addMember(mockReq, teamId, addDto);
    expect(service.addMember).toHaveBeenCalledWith(
      mockReq.user.id,
      teamId,
      addDto,
    );

    const roleDto = { role: TeamRole.ADMIN };
    (service.updateMemberRole as jest.Mock<any>).mockResolvedValue({
      userId: targetUserId,
      role: TeamRole.ADMIN,
    });
    await controller.updateMemberRole(mockReq, teamId, targetUserId, roleDto);
    expect(service.updateMemberRole).toHaveBeenCalledWith(
      mockReq.user.id,
      teamId,
      targetUserId,
      roleDto,
    );

    (service.removeMember as jest.Mock<any>).mockResolvedValue({
      message: 'removed',
    });
    await controller.removeMember(mockReq, teamId, targetUserId);
    expect(service.removeMember).toHaveBeenCalledWith(
      mockReq.user.id,
      teamId,
      targetUserId,
    );
  });

  it('should list team projects', async () => {
    (service.getTeamProjects as jest.Mock<any>).mockResolvedValue([]);
    const res = await controller.getTeamProjects(mockReq, teamId);
    expect(service.getTeamProjects).toHaveBeenCalledWith(
      mockReq.user.id,
      teamId,
    );
    expect(res).toEqual([]);
  });
});
