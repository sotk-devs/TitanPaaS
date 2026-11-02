import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UsersService } from './users.service.js';
import { User } from './entities/user.entity.js';

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<Partial<Repository<User>>>;

  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    password: 'hashedPassword123',
    name: 'Test User',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn().mockImplementation((dto) => dto as User),
      save: jest
        .fn()
        .mockImplementation((user) =>
          Promise.resolve({ ...mockUser, ...(user as User) }),
        ),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([mockUser]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should successfully create and return a user', async () => {
      (repository.findOne as any).mockResolvedValue(null);

      const result = await service.create({
        email: 'TEST@example.com',
        password: 'hashedPassword123',
        name: 'Test User',
      });

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(repository.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'hashedPassword123',
        name: 'Test User',
      });
      expect(repository.save).toHaveBeenCalled();
      expect(result.email).toBe('test@example.com');
    });

    it('should throw ConflictException if user email already exists', async () => {
      (repository.findOne as any).mockResolvedValue(mockUser);

      await expect(
        service.create({
          email: 'test@example.com',
          password: 'password',
          name: 'Existing',
        }),
      ).rejects.toThrow(ConflictException);

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('findByEmail', () => {
    it('should return a user if found', async () => {
      (repository.findOne as any).mockResolvedValue(mockUser);

      const result = await service.findByEmail('TEST@example.com');
      expect(result).toEqual(mockUser);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should return null if user is not found', async () => {
      (repository.findOne as any).mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');
      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return a user by id', async () => {
      (repository.findOne as any).mockResolvedValue(mockUser);

      const result = await service.findById(
        '123e4567-e89b-12d3-a456-426614174000',
      );
      expect(result).toEqual(mockUser);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: '123e4567-e89b-12d3-a456-426614174000' },
      });
    });

    it('should return null if user by id is not found', async () => {
      (repository.findOne as any).mockResolvedValue(null);

      const result = await service.findById('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return an array of users', async () => {
      const result = await service.findAll();
      expect(result).toEqual([mockUser]);
      expect(repository.find).toHaveBeenCalledTimes(1);
    });
  });
});
