import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { UsersService } from '../src/modules/users/users.service';
import { JwtService } from '@nestjs/jwt';
import { HttpExceptionFilter } from '../src/shared/http-exception.filter';
import { ResponseEnvelopeInterceptor } from '../src/shared/response-envelope.interceptor';
import { RefreshToken } from '../src/modules/auth/refresh-token.entity';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('POST /auth/refresh & Strong Password Validation', () => {
  let app: INestApplication;
  const refreshTokensDb: RefreshToken[] = [];

  const mockRefreshTokenRepo = {
    create: (dto: any) => ({
      id: 'rt-' + Math.random().toString(36).substring(2, 9),
      createdAt: new Date(),
      ...dto,
    }),
    save: async (token: RefreshToken) => {
      const idx = refreshTokensDb.findIndex((t) => t.id === token.id);
      if (idx >= 0) {
        refreshTokensDb[idx] = token;
      } else {
        refreshTokensDb.push(token);
      }
      return token;
    },
    findOne: async ({ where }: any) => {
      return refreshTokensDb.find((t) => {
        let match = true;
        if (where.tokenHash !== undefined) match = match && t.tokenHash === where.tokenHash;
        if (where.userId !== undefined) match = match && t.userId === where.userId;
        if (where.isRevoked !== undefined) match = match && t.isRevoked === where.isRevoked;
        return match;
      }) ?? null;
    },
    update: async (criteria: any, partial: any) => {
      for (const t of refreshTokensDb) {
        if (criteria.userId && t.userId === criteria.userId) {
          Object.assign(t, partial);
        }
      }
    },
  };

  const mockUsersService = {
    findByEmail: async (email: string) => {
      if (email === 'existing@example.com') {
        return {
          id: 'u1',
          email: 'existing@example.com',
          role: 'user',
          isActive: true,
          passwordHash: '$2a$10$sample',
        };
      }
      return null;
    },
    findById: async (id: string) => {
      if (id === 'u1') {
        return {
          id: 'u1',
          email: 'existing@example.com',
          role: 'user',
          isActive: true,
        };
      }
      return null;
    },
    create: async (d: any) => ({
      id: 'u1',
      email: d.email,
      role: 'user',
      isActive: true,
      createdAt: new Date(),
    }),
  };

  beforeAll(async () => {
    const jwtSecret = 'test-secret';
    const realJwt = new JwtService({ secret: jwtSecret });

    const mod = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: realJwt },
        { provide: getRepositoryToken(RefreshToken), useValue: mockRefreshTokenRepo },
      ],
    }).compile();

    app = mod.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Password Complexity Validation on Signup', () => {
    it('rejects password without uppercase letters', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: 'pass1@example.com', password: 'password123!' });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/رمز عبور/);
    });

    it('rejects password without numbers', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: 'pass2@example.com', password: 'Password!@#' });
      expect(res.status).toBe(400);
    });

    it('rejects password without special symbols', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: 'pass3@example.com', password: 'Password123' });
      expect(res.status).toBe(400);
    });

    it('accepts compliant strong password', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: 'strong@example.com', password: 'StrongPassword123!' });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
    });
  });

  describe('Refresh Token Rotation & Invalidation', () => {
    let initialRefreshToken: string;
    let rotatedRefreshToken: string;

    it('generates initial tokens upon signup', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: 'user-refresh@example.com', password: 'SecurePass987@!' });
      expect(res.status).toBe(201);
      initialRefreshToken = res.body.data.refreshToken;
      expect(initialRefreshToken).toBeDefined();
    });

    it('successfully refreshes token with valid refresh token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: initialRefreshToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.refreshToken).not.toBe(initialRefreshToken);

      rotatedRefreshToken = res.body.data.refreshToken;
    });

    it('can refresh sequentially again with the newly rotated token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: rotatedRefreshToken });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
    });

    it('rejects reused / old refresh token (detects token reuse and revokes token family)', async () => {
      // Re-using the initialRefreshToken which was already rotated
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: initialRefreshToken });

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/نامعتبر|منقضی/);
    });

    it('rejects completely bogus refresh token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'totally-bogus-token-value' });

      expect(res.status).toBe(401);
    });

    it('rejects empty refresh token payload with 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({});

      expect(res.status).toBe(400);
    });
  });
});
