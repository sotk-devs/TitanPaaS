import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
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
          password: '123',
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
          password: 'securePassword123',
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
