import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { UsersService } from '../src/modules/users/users.service';
import { JwtService } from '@nestjs/jwt';
import { HttpExceptionFilter } from '../src/shared/http-exception.filter';
import { JwtAuthGuard } from '../src/shared/jwt-auth.guard';
import { ResponseEnvelopeInterceptor } from '../src/shared/response-envelope.interceptor';

/**
 * Auth invariants and edge-case e2e tests.
 * Each test runs against the real NestJS controller stack via supertest,
 * with a mock UsersService/JwtService and the contract error envelope.
 */

interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  displayName?: string;
  role: string;
  createdAt: Date;
}

function makeUsersRepo(seed: StoredUser[] = []): UsersService {
  const data = [...seed];
  return {
    findByEmail: async (email: string) => data.find((u) => u.email === email) ?? null,
    create: async (d: Partial<StoredUser>) => {
      const u: StoredUser = {
        id: 'u' + (data.length + 1),
        email: d.email!,
        passwordHash: d.passwordHash!,
        displayName: d.displayName,
        role: d.role ?? 'user',
        createdAt: new Date(),
      };
      data.push(u);
      return u;
    },
  } as unknown as UsersService;
}

describe('POST /auth/signup + /auth/login — contract invariants & edge cases', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Pre-seed one user so the login-happy-path test can run before any signup test.
    const aliceHash = await bcrypt.hash('password123', 10);
    const mod = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: makeUsersRepo([
            {
              id: 'u1',
              email: 'alice@example.com',
              passwordHash: aliceHash,
              role: 'user',
              createdAt: new Date(),
            },
          ]),
        },
        // jwt.sign returns the payload as JSON — easy to inspect in tests
        { provide: JwtService, useValue: { sign: (p: any) => JSON.stringify(p) } },
      ],
    }).compile();
    app = mod.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });
  afterAll(async () => app.close());

  // ---- happy path ----

  it('signup with valid payload returns 201 with user + access token and sets refresh cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: 'new@example.com', password: 'Pass1234!', displayName: 'New' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toHaveProperty('user');
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.headers['set-cookie']?.some((value: string) => value.startsWith('refreshToken=') && value.includes('HttpOnly'))).toBe(true);
  });

  it('login with valid credentials returns 200 with user + access token and sets refresh cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'alice@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toHaveProperty('user');
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.headers['set-cookie']?.some((value: string) => value.startsWith('refreshToken=') && value.includes('HttpOnly'))).toBe(true);
  });

  // ---- invariant: response never leaks passwordHash ----

  it('signup response never contains passwordHash', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: 'bob@example.com', password: 'Pass1234!' });
    expect(res.status).toBe(201);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|password/i);
  });

  // ---- invariant: JWT payloads contain the right claims ----

  it('access token carries sub/email/role and refresh cookie carries the refresh JWT', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: 'carol@example.com', password: 'Pass1234!' });
    expect(res.status).toBe(201);
    const access = JSON.parse(res.body.data.accessToken);
    const refreshCookie = res.headers['set-cookie']?.find((value: string) => value.startsWith('refreshToken='));
    const refresh = JSON.parse(decodeURIComponent(refreshCookie!.split(';', 1)[0].slice('refreshToken='.length)));
    expect(access).toEqual(
      expect.objectContaining({
        sub: expect.any(String),
        email: 'carol@example.com',
        role: 'user',
      }),
    );
    expect(refresh).toEqual(
      expect.objectContaining({ type: 'refresh', email: 'carol@example.com' }),
    );
  });

  // ---- edge: validation errors return the contract envelope ----

  it('signup with malformed email returns 400 with contract envelope', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: 'not-an-email', password: 'Pass1234!' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('statusCode', 400);
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('error');
  });

  it('signup with password shorter than 8 chars returns 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: 'dave@example.com', password: 'short' });
    expect(res.status).toBe(400);
  });

  it('signup with weak password (missing symbols/uppercase) returns 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: 'weak@example.com', password: 'password123' });
    expect(res.status).toBe(400);
  });

  it('signup with empty body returns 400', async () => {
    const res = await request(app.getHttpServer()).post('/auth/signup').send({});
    expect(res.status).toBe(400);
  });

  // ---- edge: duplicate email returns 409 ----

  it('signup with already-registered email returns 409', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: 'eve@example.com', password: 'Pass1234!' });
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: 'eve@example.com', password: 'Pass1234!' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual(expect.objectContaining({ statusCode: 409 }));
  });

  // ---- edge: login failures all return 401 with the contract envelope ----

  it('login with wrong password returns 401 with contract envelope', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'alice@example.com', password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual(
      expect.objectContaining({
        statusCode: 401,
        message: expect.any(String),
        error: expect.any(String),
      }),
    );
  });

  it('login with non-existent email returns 401 (no enumeration)', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/logout — guard edge cases', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: UsersService, useValue: {} },
        {
          provide: JwtService,
          useValue: {
            sign: () => 'tok',
            verify: (t: string) => {
              if (t === 'valid') return { sub: 'u1', role: 'user' };
              throw new Error('invalid');
            },
          },
        },
        JwtAuthGuard,
      ],
    }).compile();
    app = mod.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });
  afterAll(async () => app.close());

  it('logout with malformed Authorization header (not Bearer) returns 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', 'Token xyz')
      .send({});
    expect(res.status).toBe(401);
  });

  it('logout with Bearer + invalid token returns 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', 'Bearer garbage')
      .send({});
    expect(res.status).toBe(401);
  });

  it('logout with Bearer + empty token returns 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', 'Bearer ')
      .send({});
    expect(res.status).toBe(401);
  });
});
