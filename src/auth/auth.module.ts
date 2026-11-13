import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../projects/entities/project.entity.js';
import { Team } from '../teams/entities/team.entity.js';
import { TeamMember } from '../teams/entities/team-member.entity.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { GithubAuthController } from './github-auth.controller.js';
import { GithubOAuthService } from './github-oauth.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([Project, Team, TeamMember]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'titan_paas_secret_key_change_in_prod',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AuthController, GithubAuthController],
  providers: [AuthService, GithubOAuthService, JwtStrategy],
  exports: [AuthService, GithubOAuthService, JwtModule],
})
export class AuthModule {}
