import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthController } from '../src/auth/auth.controller.js';
import { AuthService } from '../src/auth/auth.service.js';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy.js';
import { UsersService } from '../src/users/users.service.js';
import { User } from '../src/users/entities/user.entity.js';

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  const mockUserStore = new Map<string, User>();

  const mockUsersService = {
    create: (data: any) => {
      const email = data.email.toLowerCase().trim();
      if (mockUserStore.has(email)) {
        const err = new Error('User with this email already exists');
        (err as any).status = 409;
        throw err;
      }
      const user: User = {
        id: 'mock-uuid-' + Date.now(),
        email,
        password: data.password,
        name: data.name,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockUserStore.set(email, user);
      return Promise.resolve(user);
    },
    findByEmail: (email: string) => {
      return Promise.resolve(
        mockUserStore.get(email.toLowerCase().trim()) || null,
      );
    },
    findById: (id: string) => {
      for (const u of mockUserStore.values()) {
        if (u.id === id) return Promise.resolve(u);
      }
      return Promise.resolve(null);
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret:
            process.env.JWT_SECRET || 'titan_paas_secret_key_change_in_prod',
          signOptions: { expiresIn: '1d' },
        }),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtStrategy,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('should register a new user and return JWT access_token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'e2e@example.com',
          password: 'securePassword123',
          name: 'E2E User',
        })
        .expect(201);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('e2e@example.com');
      expect(response.body.user.name).toBe('E2E User');
      expect(response.body.user.password).toBeUndefined();
    });

    it('should fail with 400 when body has invalid email', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'not-an-email',
          password: 'securePassword123',
          name: 'Invalid Email User',
        })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });

    it('should fail with 400 when name is empty', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'valid@example.com',
          password: 'securePassword123',
          name: '',
        })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });

    it('should fail with 409 when registering already used email', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'e2e@example.com',
          password: 'password456',
          name: 'E2E User',
        })
        .expect(409);
    });
  });

  describe('POST /auth/login', () => {
    it('should login with correct credentials and return access_token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'e2e@example.com',
          password: 'securePassword123',
        })
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body.user.email).toBe('e2e@example.com');
    });

    it('should fail with 401 when password is wrong', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'e2e@example.com',
          password: 'wrongPassword',
        })
        .expect(401);
    });
  });

  describe('GET /auth/profile', () => {
    it('should access protected profile route with bearer token', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'e2e@example.com',
          password: 'securePassword123',
        })
        .expect(200);

      const token = loginRes.body.access_token;

      const profileRes = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(profileRes.body.email).toBe('e2e@example.com');
    });

    it('should fail with 401 when accessing profile without token', async () => {
      await request(app.getHttpServer()).get('/auth/profile').expect(401);
    });
  });
});
