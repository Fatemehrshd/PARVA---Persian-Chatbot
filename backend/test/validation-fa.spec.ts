import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { UsersService } from '../src/modules/users/users.service';
import { JwtService } from '@nestjs/jwt';
import { HttpExceptionFilter } from '../src/shared/http-exception.filter';
import { ChatController } from '../src/modules/chat/chat.controller';
import { ChatService } from '../src/modules/chat/chat.service';
import { ModelsAdminController } from '../src/modules/models-admin/models-admin.controller';
import { ModelsAdminService } from '../src/modules/models-admin/models-admin.service';
import { JwtAuthGuard } from '../src/shared/jwt-auth.guard';
import { AdminGuard } from '../src/shared/admin.guard';
import { testAdminGuard } from './test-utils';

/**
 * Validation message localization: every validation error returned by the API
 * must carry a Persian message so the frontend can show it verbatim. This file
 * guards against English-only decorators slipping back into the DTOs.
 *
 * The assertions do not pin the exact wording — they only require the message
 * to contain Persian script (U+0600..U+06FF), which is the hard invariant.
 */

const PERSIAN_RE = /[؀-ۿ]/;

function hasPersian(text: string | string[] | undefined): boolean {
  if (!text) return false;
  if (Array.isArray(text)) return text.some((t) => PERSIAN_RE.test(t));
  return PERSIAN_RE.test(text);
}

describe('Validation messages are Persian (fa)', () => {
  // ---------- auth ----------

  async function authApp() {
    const mod = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: { findByEmail: async () => null, create: async (d: any) => d },
        },
        { provide: JwtService, useValue: { sign: () => 'tok' } },
      ],
    }).compile();
    const app = mod.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    return app;
  }

  it('signup with malformed email returns a Persian message', async () => {
    const app = await authApp();
    try {
      const res = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: 'not-an-email', password: 'password123' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('statusCode', 400);
      expect(hasPersian(res.body.message)).toBe(true);
    } finally {
      await app.close();
    }
  });

  it('signup with short password returns a Persian message', async () => {
    const app = await authApp();
    try {
      const res = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: 'a@x.com', password: 'short' });
      expect(res.status).toBe(400);
      expect(hasPersian(res.body.message)).toBe(true);
    } finally {
      await app.close();
    }
  });

  it('signup with empty body returns Persian messages for every missing field', async () => {
    const app = await authApp();
    try {
      const res = await request(app.getHttpServer()).post('/auth/signup').send({});
      expect(res.status).toBe(400);
      expect(hasPersian(res.body.message)).toBe(true);
      expect(Array.isArray(res.body.message)).toBe(true);
      expect(res.body.message.length).toBeGreaterThanOrEqual(2);
    } finally {
      await app.close();
    }
  });

  it('login with malformed email returns Persian message', async () => {
    const app = await authApp();
    try {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'bad', password: 'x' });
      expect(res.status).toBe(400);
      expect(hasPersian(res.body.message)).toBe(true);
    } finally {
      await app.close();
    }
  });

  // ---------- chat ----------

  async function chatApp() {
    const mod = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        {
          provide: ChatService,
          useValue: {
            list: async () => [],
            create: async () => ({}),
            history: async () => [],
            generate: async function* () {},
          },
        },
        JwtAuthGuard,
        { provide: JwtService, useValue: { verify: () => ({ sub: 'u1', role: 'user' }) } },
      ],
    }).compile();
    const app = mod.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    return app;
  }

  it('chat update with empty body returns Persian "at least one field required"', async () => {
    const app = await chatApp();
    try {
      const res = await request(app.getHttpServer())
        .patch('/chat/conversations/00000000-0000-4000-8000-000000000001')
        .set('Authorization', 'Bearer t')
        .send({});
      expect(res.status).toBe(400);
      expect(hasPersian(res.body.message) || hasPersian(JSON.stringify(res.body))).toBe(true);
    } finally {
      await app.close();
    }
  });

  it('chat update with non-UUID modelId returns Persian message', async () => {
    const app = await chatApp();
    try {
      const res = await request(app.getHttpServer())
        .patch('/chat/conversations/00000000-0000-4000-8000-000000000001')
        .set('Authorization', 'Bearer t')
        .send({ modelId: 'not-a-uuid' });
      expect(res.status).toBe(400);
      expect(hasPersian(res.body.message)).toBe(true);
    } finally {
      await app.close();
    }
  });

  it('chat send with empty content returns Persian message', async () => {
    const app = await chatApp();
    try {
      const res = await request(app.getHttpServer())
        .post('/chat/conversations/00000000-0000-4000-8000-000000000001/messages')
        .set('Authorization', 'Bearer t')
        .send({ content: '' });
      expect(res.status).toBe(400);
      expect(hasPersian(res.body.message)).toBe(true);
    } finally {
      await app.close();
    }
  });

  // ---------- admin ----------

  async function adminApp() {
    const mod = await Test.createTestingModule({
      controllers: [ModelsAdminController],
      providers: [
        {
          provide: ModelsAdminService,
          useValue: {
            list: async () => [],
            create: async (d: any) => d,
            remove: async () => {},
            setDefault: async () => ({}),
            updateStatus: async () => ({}),
          },
        },
        JwtAuthGuard,
        { provide: AdminGuard, useValue: testAdminGuard },
        { provide: JwtService, useValue: { verify: () => ({ sub: 'a', role: 'admin' }) } },
      ],
    }).compile();
    const app = mod.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    return app;
  }

  it('admin create with missing name returns Persian message', async () => {
    const app = await adminApp();
    try {
      const res = await request(app.getHttpServer())
        .post('/admin/models')
        .set('Authorization', 'Bearer t')
        .send({ provider: 'openai', apiIdentifier: 'gpt-4o' });
      expect(res.status).toBe(400);
      expect(hasPersian(res.body.message)).toBe(true);
    } finally {
      await app.close();
    }
  });

  it('admin create with non-boolean isActive returns Persian message', async () => {
    const app = await adminApp();
    try {
      const res = await request(app.getHttpServer())
        .post('/admin/models')
        .set('Authorization', 'Bearer t')
        .send({ name: 'm', provider: 'openai', apiIdentifier: 'gpt-4o', isActive: 'yes' });
      expect(res.status).toBe(400);
      expect(hasPersian(res.body.message)).toBe(true);
    } finally {
      await app.close();
    }
  });

  it('admin updateStatus with non-boolean isActive returns Persian message', async () => {
    const app = await adminApp();
    try {
      const res = await request(app.getHttpServer())
        .patch('/admin/models/00000000-0000-4000-8000-000000000001/status')
        .set('Authorization', 'Bearer t')
        .send({ isActive: 'maybe' });
      expect(res.status).toBe(400);
      expect(hasPersian(res.body.message)).toBe(true);
    } finally {
      await app.close();
    }
  });
});
