import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  type Relation,
} from 'typeorm';
import type { User } from '../../users/entities/user.entity.js';
import { ApiKeyScope } from '../enums/api-key-scope.enum.js';

@Entity('api_keys')
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  description?: string | null;

  @Column({ type: 'varchar', length: 24, name: 'key_prefix' })
  keyPrefix: string;

  @Column({ type: 'varchar', length: 64, unique: true, name: 'key_hash' })
  @Index({ unique: true })
  keyHash: string;

  @Column({ type: 'jsonb', default: [] })
  scopes: ApiKeyScope[];

  @Column({
    type: 'jsonb',
    nullable: true,
    default: null,
    name: 'allowed_project_ids',
  })
  allowedProjectIds?: string[] | null;

  @Column({
    type: 'timestamp with time zone',
    nullable: true,
    default: null,
    name: 'expires_at',
  })
  expiresAt?: Date | null;

  @Column({
    type: 'timestamp with time zone',
    nullable: true,
    default: null,
    name: 'last_used_at',
  })
  lastUsedAt?: Date | null;

  @Column({
    type: 'varchar',
    nullable: true,
    default: null,
    name: 'last_used_ip',
  })
  lastUsedIp?: string | null;

  @Column({
    type: 'timestamp with time zone',
    nullable: true,
    default: null,
    name: 'revoked_at',
  })
  revokedAt?: Date | null;

  @Column({ type: 'uuid', name: 'user_id' })
  @Index()
  userId: string;

  @ManyToOne('User', 'apiKeys', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', name: 'updated_at' })
  updatedAt: Date;
}
