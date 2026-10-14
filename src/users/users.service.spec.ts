import { describe, it, expect, beforeEach } from '@jest/globals';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(() => {
    service = new UsersService();
  });

  it('should create and store a user', async () => {
    const user = await service.create({
      email: 'test@example.com',
      password: 'hashed_password',
      name: 'Test User',
    });

    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.email).toBe('test@example.com');
    expect(user.name).toBe('Test User');
    expect(user.password).toBe('hashed_password');
  });

  it('should find user by email case-insensitively', async () => {
    await service.create({
      email: 'USER@example.com',
      password: 'secret',
      name: 'User',
    });

    const found = await service.findByEmail('user@example.com');
    expect(found).not.toBeNull();
    expect(found?.email).toBe('user@example.com');
  });

  it('should return null if user by email does not exist', async () => {
    const found = await service.findByEmail('notfound@example.com');
    expect(found).toBeNull();
  });

  it('should find user by id', async () => {
    const created = await service.create({
      email: 'id_test@example.com',
      password: 'secret',
      name: 'ID Test',
    });

    const found = await service.findById(created.id);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(created.id);
  });

  it('should return null if user by id does not exist', async () => {
    const found = await service.findById('non-existent-id');
    expect(found).toBeNull();
  });
});
