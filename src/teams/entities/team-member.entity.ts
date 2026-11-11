import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
  type Relation,
} from 'typeorm';
import type { Team } from './team.entity.js';
import type { User } from '../../users/entities/user.entity.js';
import { TeamRole } from '../enums/team-role.enum.js';

@Entity('team_members')
@Unique('UQ_TEAM_MEMBERS_TEAM_USER', ['teamId', 'userId'])
export class TeamMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'team_id' })
  @Index()
  teamId: string;

  @Column({ type: 'uuid', name: 'user_id' })
  @Index()
  userId: string;

  @Column({
    type: 'enum',
    enum: TeamRole,
    default: TeamRole.VIEWER,
  })
  role: TeamRole;

  @ManyToOne('Team', 'members', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Relation<Team>;

  @ManyToOne('User', 'teamMemberships', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone', name: 'updated_at' })
  updatedAt: Date;
}
