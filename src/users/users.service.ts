import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity.js';

export interface CreateUserData {
  email: string;
  password?: string | null;
  name: string;
  githubId?: string | null;
  githubUsername?: string | null;
  avatarUrl?: string | null;
  githubAccessToken?: string | null;
}

export interface UpdateGithubProfileData {
  githubId: string | null;
  githubUsername: string | null;
  avatarUrl: string | null;
  githubAccessToken: string | null;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(data: CreateUserData): Promise<User> {
    const normalizedEmail = data.email.toLowerCase().trim();

    const existingUser = await this.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const payload: Partial<User> = {
      email: normalizedEmail,
      password: data.password ?? null,
      name: data.name.trim(),
    };

    if (data.githubId !== undefined) {
      payload.githubId = data.githubId;
    }
    if (data.githubUsername !== undefined) {
      payload.githubUsername = data.githubUsername;
    }
    if (data.avatarUrl !== undefined) {
      payload.avatarUrl = data.avatarUrl;
    }
    if (data.githubAccessToken !== undefined) {
      payload.githubAccessToken = data.githubAccessToken;
    }

    const user = this.userRepository.create(payload);

    return this.userRepository.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = email.toLowerCase().trim();
    return this.userRepository.findOne({
      where: { email: normalizedEmail },
    });
  }

  async findByGithubId(githubId: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { githubId },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
    });
  }

  async updateGithubProfile(
    userId: string,
    data: UpdateGithubProfileData,
  ): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.githubId = data.githubId;
    user.githubUsername = data.githubUsername;
    user.avatarUrl = data.avatarUrl;
    user.githubAccessToken = data.githubAccessToken;

    return this.userRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }
}
