import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditController } from './audit.controller.js';
import { AuditService } from './audit.service.js';
import { AuditAction } from './enums/audit-action.enum.js';
import { AuditResourceType } from './enums/audit-resource-type.enum.js';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto.js';

describe('AuditController', () => {
  let controller: AuditController;
  let auditService: {
    findAll: jest.MockedFunction<any>;
    findByProject: jest.MockedFunction<any>;
  };

  const mockUserId = 'user-uuid-1';
  const mockProjectId = 'project-uuid-1';

  const mockResponse = {
    items: [
      {
        id: 'audit-1',
        userId: mockUserId,
        action: AuditAction.PROJECT_CREATE,
        resourceType: AuditResourceType.PROJECT,
        resourceId: mockProjectId,
        projectId: mockProjectId,
        details: { name: 'demo-app' },
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        createdAt: new Date(),
      },
    ],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
  };

  beforeEach(async () => {
    auditService = {
      findAll: jest.fn().mockResolvedValue(mockResponse as never),
      findByProject: jest.fn().mockResolvedValue(mockResponse as never),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        {
          provide: AuditService,
          useValue: auditService,
        },
      ],
    }).compile();

    controller = module.get<AuditController>(AuditController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should delegate to auditService.findAll with userId and query params', async () => {
      const req = { user: { id: mockUserId } };
      const query: QueryAuditLogsDto = {
        page: 2,
        limit: 10,
        action: AuditAction.PROJECT_CREATE,
      };

      const result = await controller.findAll(req, query);

      expect(auditService.findAll).toHaveBeenCalledWith(mockUserId, query);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('findByProject', () => {
    it('should delegate to auditService.findByProject with userId, projectId, and query params', async () => {
      const req = { user: { id: mockUserId } };
      const query: QueryAuditLogsDto = { page: 1, limit: 20 };

      const result = await controller.findByProject(req, mockProjectId, query);

      expect(auditService.findByProject).toHaveBeenCalledWith(
        mockUserId,
        mockProjectId,
        query,
      );
      expect(result).toEqual(mockResponse);
    });
  });
});
