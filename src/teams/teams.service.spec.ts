import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TeamsService } from './teams.service.js';
import { Team } from './entities/team.entity.js';
import { TeamMember } from './entities/team-member.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Project } from '../projects/entities/project.entity.js';
import { TeamRole } from './enums/team-role.enum.js';

describe('TeamsService', () => {
  let service: TeamsService;
  let teamRepo: jest.Mocked<Partial<Repository<Team>>>;
  let memberRepo: jest.Mocked<Partial<Repository<TeamMember>>>;
  let userRepo: jest.Mocked<Partial<Repository<User>>>;
  let projectRepo: jest.Mocked<Partial<Repository<Project>>>;

  const ownerId = 'uuid-owner-1';
  const adminId = 'uuid-admin-1';
  const devId = 'uuid-dev-1';
  const viewerId = 'uuid-viewer-1';
  const teamId = 'uuid-team-1';

  const mockTeam: Team = {
    id: teamId,
    name: 'Platform Team',
    slug: 'platform-team',
    description: 'Core team',
    ownerId,
    owner: null as any,
    members: [],
    projects: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser: User = {
    id: devId,
    email: 'dev@titanpaas.dev',
    password: 'hashed_password',
    name: 'Dev Collaborator',
    projects: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    teamRepo = {
      create: jest.fn<any>().mockImplementation((dto: any) => ({ ...dto })),
      save: jest.fn<any>().mockImplementation((entity: any) =>
        Promise.resolve({
          ...mockTeam,
          ...entity,
        }),
      ),
      findOne: jest.fn<any>(),
      remove: jest
        .fn<any>()
        .mockImplementation((entity: any) => Promise.resolve(entity)),
    };

    memberRepo = {
      create: jest.fn<any>().mockImplementation((dto: any) => ({ ...dto })),
      save: jest.fn<any>().mockImplementation((entity: any) =>
        Promise.resolve({
          id: 'uuid-member-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          ...entity,
        }),
      ),
      findOne: jest.fn<any>(),
      find: jest.fn<any>(),
      count: jest.fn<any>(),
      remove: jest
        .fn<any>()
        .mockImplementation((entity: any) => Promise.resolve(entity)),
    };

    userRepo = {
      findOne: jest.fn<any>(),
    };

    projectRepo = {
      find: jest.fn<any>().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamsService,
        { provide: getRepositoryToken(Team), useValue: teamRepo },
        { provide: getRepositoryToken(TeamMember), useValue: memberRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Project), useValue: projectRepo },
      ],
    }).compile();

    service = module.get<TeamsService>(TeamsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a team with auto-generated slug and assign creator as OWNER', async () => {
      (teamRepo.findOne as jest.Mock<any>).mockResolvedValue(null);

      const result = await service.create(ownerId, {
        name: 'Platform Team',
        description: 'Core team',
      });

      expect(teamRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Platform Team',
          slug: 'platform-team',
          ownerId,
        }),
      );
      expect(memberRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          teamId,
          userId: ownerId,
          role: TeamRole.OWNER,
        }),
      );
      expect(result.myRole).toBe(TeamRole.OWNER);
    });

    it('should throw ConflictException when slug already exists', async () => {
      (teamRepo.findOne as jest.Mock<any>).mockResolvedValue(mockTeam);

      await expect(
        service.create(ownerId, { name: 'Platform Team' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAllForUser & findOne', () => {
    it('should list teams with caller role', async () => {
      (memberRepo.find as jest.Mock<any>).mockResolvedValue([
        { teamId, userId: devId, role: TeamRole.DEVELOPER, team: mockTeam },
      ]);

      const result = await service.findAllForUser(devId);
      expect(result).toHaveLength(1);
      expect(result[0].myRole).toBe(TeamRole.DEVELOPER);
    });

    it('should return sanitized team members without password', async () => {
      (teamRepo.findOne as jest.Mock<any>)
        .mockResolvedValueOnce(mockTeam)
        .mockResolvedValueOnce({
          ...mockTeam,
          members: [
            {
              id: 'm1',
              teamId,
              userId: devId,
              role: TeamRole.DEVELOPER,
              user: mockUser,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        });
      (memberRepo.findOne as jest.Mock<any>).mockResolvedValue({
        teamId,
        userId: devId,
        role: TeamRole.DEVELOPER,
      });

      const result = await service.findOne(devId, teamId);
      expect(result.myRole).toBe(TeamRole.DEVELOPER);
      expect(result.members[0].user).toEqual({
        id: devId,
        name: 'Dev Collaborator',
        email: 'dev@titanpaas.dev',
      });
      expect((result.members[0].user as any).password).toBeUndefined();
    });
  });

  describe('RBAC team management', () => {
    it('should forbid DEVELOPER from updating team', async () => {
      (teamRepo.findOne as jest.Mock<any>).mockResolvedValue(mockTeam);
      (memberRepo.findOne as jest.Mock<any>).mockResolvedValue({
        teamId,
        userId: devId,
        role: TeamRole.DEVELOPER,
      });

      await expect(
        service.update(devId, teamId, { name: 'Hacked' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should forbid ADMIN from deleting team (OWNER only)', async () => {
      (teamRepo.findOne as jest.Mock<any>).mockResolvedValue(mockTeam);
      (memberRepo.findOne as jest.Mock<any>).mockResolvedValue({
        teamId,
        userId: adminId,
        role: TeamRole.ADMIN,
      });

      await expect(service.remove(adminId, teamId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow OWNER to delete team', async () => {
      (teamRepo.findOne as jest.Mock<any>).mockResolvedValue(mockTeam);
      (memberRepo.findOne as jest.Mock<any>).mockResolvedValue({
        teamId,
        userId: ownerId,
        role: TeamRole.OWNER,
      });

      const res = await service.remove(ownerId, teamId);
      expect(res.message).toContain('eliminado exitosamente');
    });
  });

  describe('members & privilege guards', () => {
    it('should allow OWNER to add member by email', async () => {
      (teamRepo.findOne as jest.Mock<any>).mockResolvedValue(mockTeam);
      (memberRepo.findOne as jest.Mock<any>)
        .mockResolvedValueOnce({
          teamId,
          userId: ownerId,
          role: TeamRole.OWNER,
        })
        .mockResolvedValueOnce(null);
      (userRepo.findOne as jest.Mock<any>).mockResolvedValue(mockUser);

      const res = await service.addMember(ownerId, teamId, {
        email: 'dev@titanpaas.dev',
        role: TeamRole.DEVELOPER,
      });

      expect(res.role).toBe(TeamRole.DEVELOPER);
      expect(res.user?.email).toBe('dev@titanpaas.dev');
    });

    it('should forbid ADMIN from adding another ADMIN or OWNER', async () => {
      (teamRepo.findOne as jest.Mock<any>).mockResolvedValue(mockTeam);
      (memberRepo.findOne as jest.Mock<any>).mockResolvedValue({
        teamId,
        userId: adminId,
        role: TeamRole.ADMIN,
      });

      await expect(
        service.addMember(adminId, teamId, {
          email: 'dev@titanpaas.dev',
          role: TeamRole.ADMIN,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if trying to demote or remove sole OWNER', async () => {
      (teamRepo.findOne as jest.Mock<any>).mockResolvedValue(mockTeam);
      (memberRepo.findOne as jest.Mock<any>)
        .mockResolvedValueOnce({
          teamId,
          userId: ownerId,
          role: TeamRole.OWNER,
        })
        .mockResolvedValueOnce({
          teamId,
          userId: ownerId,
          role: TeamRole.OWNER,
          user: mockUser,
        });
      (memberRepo.count as jest.Mock<any>).mockResolvedValue(1);

      await expect(
        service.updateMemberRole(ownerId, teamId, ownerId, {
          role: TeamRole.ADMIN,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow member to leave team if not sole OWNER', async () => {
      (teamRepo.findOne as jest.Mock<any>).mockResolvedValue(mockTeam);
      (memberRepo.findOne as jest.Mock<any>)
        .mockResolvedValueOnce({
          teamId,
          userId: viewerId,
          role: TeamRole.VIEWER,
        })
        .mockResolvedValueOnce({
          teamId,
          userId: viewerId,
          role: TeamRole.VIEWER,
        });

      const res = await service.removeMember(viewerId, teamId, viewerId);
      expect(res.message).toContain('abandonado');
    });
  });

  describe('assertProjectAccess', () => {
    const teamProject: Project = {
      id: 'proj-1',
      name: 'team-app',
      repositoryUrl: 'https://github.com/org/repo.git',
      repositoryName: 'org/repo',
      branch: 'main',
      port: 3000,
      envVariables: {},
      healthcheckPath: null,
      healthcheckExpectedStatus: 200,
      healthcheckTimeout: 5,
      healthcheckRetries: 3,
      userId: ownerId,
      teamId,
      user: null as any,
      deployments: [],
      customDomains: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should allow VIEWER to read project but throw ForbiddenException on write actions', async () => {
      (memberRepo.findOne as jest.Mock<any>).mockResolvedValue({
        teamId,
        userId: viewerId,
        role: TeamRole.VIEWER,
      });

      const readRole = await service.assertProjectAccess(viewerId, teamProject);
      expect(readRole).toBe(TeamRole.VIEWER);

      await expect(
        service.assertProjectAccess(viewerId, teamProject, [
          TeamRole.OWNER,
          TeamRole.ADMIN,
          TeamRole.DEVELOPER,
        ]),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if user is not a member of project team', async () => {
      (memberRepo.findOne as jest.Mock<any>).mockResolvedValue(null);

      await expect(
        service.assertProjectAccess('stranger-id', teamProject),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
