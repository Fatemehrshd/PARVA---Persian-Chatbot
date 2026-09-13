import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { UsersService } from '../src/modules/users/users.service';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../src/shared/jwt-auth.guard';
import { HttpExceptionFilter } from '../src/shared/http-exception.filter';

describe('POST /auth/logout (contract)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: UsersService, useValue: {} },
        { provide: JwtService, useValue: { sign: () => 'tok', verify: () => ({ sub: 'u1', role: 'user' }) } },
        JwtAuthGuard,
      ],
    }).compile();
    app = mod.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => app.close());

  it('logout without bearer token returns 401 with contract error envelope', async () => {
    const res = await request(app.getHttpServer()).post('/auth/logout').send({});
    expect(res.status).toBe(401);
    expect(res.body).toEqual(
      expect.objectContaining({
        statusCode: 401,
        message: expect.any(String),
        error: expect.any(String),
      }),
    );
  });

  it('logout with a valid bearer token returns 204', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', 'Bearer faketok')
      .send({});
    expect(res.status).toBe(204);
  });
});
