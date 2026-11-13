import { ApiProperty } from '@nestjs/swagger';
import { AuditAction } from '../enums/audit-action.enum.js';
import { AuditResourceType } from '../enums/audit-resource-type.enum.js';

export class AuditLogResponseDto {
  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  id: string;

  @ApiProperty({
    example: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    nullable: true,
  })
  userId: string | null;

  @ApiProperty({ enum: AuditAction, example: AuditAction.PROJECT_CREATE })
  action: AuditAction;

  @ApiProperty({ enum: AuditResourceType, example: AuditResourceType.PROJECT })
  resourceType: AuditResourceType;

  @ApiProperty({
    example: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
    nullable: true,
  })
  resourceId: string | null;

  @ApiProperty({
    example: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
    nullable: true,
  })
  projectId: string | null;

  @ApiProperty({ example: { projectName: 'api-service' } })
  details: Record<string, unknown>;

  @ApiProperty({ example: '127.0.0.1', nullable: true })
  ipAddress: string | null;

  @ApiProperty({ example: 'Mozilla/5.0 ...', nullable: true })
  userAgent: string | null;

  @ApiProperty({ example: '2026-11-13T12:00:00.000Z' })
  createdAt: Date;
}

export class PaginatedAuditLogsResponseDto {
  @ApiProperty({ type: [AuditLogResponseDto] })
  items: AuditLogResponseDto[];

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 3 })
  totalPages: number;
}
