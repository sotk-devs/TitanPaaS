import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { User } from './entities/user.entity.js';

export interface CreateUserData {
  email: string;
  password: string;
  name: string;
}

@Injectable()
export class UsersService {
  private readonly users = new Map<string, User>();

  async create(data: CreateUserData): Promise<User> {
    const now = new Date();
    const user: User = {
      id: randomUUID(),
      email: data.email.toLowerCase(),
      password: data.password,
      name: data.name,
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(user.id, user);
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = email.toLowerCase();
    for (const user of this.users.values()) {
      if (user.email === normalizedEmail) {
        return user;
      }
    }
    return null;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }
}
