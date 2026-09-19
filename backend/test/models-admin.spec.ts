import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { ModelsAdminController } from '../src/modules/models-admin/models-admin.controller';
import { ModelsAdminService } from '../src/modules/models-admin/models-admin.service';
import { JwtAuthGuard } from '../src/shared/jwt-auth.guard';
import { AdminGuard } from '../src/shared/admin.guard';
import { testAdminGuard } from './test-utils';
import { HttpExceptionFilter } from '../src/shared/http-exception.filter';
import { ResponseEnvelopeInterceptor } from '../src/shared/response-envelope.interceptor';

/**
 * /admin/models invariants:
 *  - Every endpoint requires a valid bearer token AND role === 'admin'.
 *  - The order is: 401 (no token) → 403 (authenticated but not admin) → handler.
 *  - At most one model can be the platform default at any time.
 *  - Validation rejects requests missing required fields with 400 + envelope.
 */

const ADMIN_ID = 'admin-1';
const USER_ID = 'user-1';

function makeModelsService() {
  const models = [
    {
      id: 'm1',
      name: 'gpt-4',
      provider: 'openai',
      apiIdentifier: 'gpt-4',
      isActive: true,
      isDefault: true,
    },
    {
      id: 'm2',
      name: 'claude',
      provider: 'anthropic',
      apiIdentifier: 'claude-3',
      isActive: true,
      isDefault: false,
    },
  ];
  return {
    list: async () => [...models],
    create: async (d: any) => {
      const m = { id: 'm-new', isActive: true, isDefault: false, ...d };
      models.push(m);
      return m;
    },
    remove: async (id: string) => {
      const idx = models.findIndex((m) => m.id === id);
      if (idx < 0) throw new NotFoundException('Resource not found');
      models.splice(idx, 1);
    },
    setDefault: async (id: string) => {
      const m = models.find((x) => x.id === id);
      if (!m) throw new NotFoundException('Resource not found');
      models.forEach((x) => (x.isDefault = false));
      m.isDefault = true;
      return m;
    },
    updateStatus: async (id: string, isActive: boolean) => {
      const m = models.find((x) => x.id === id);
      if (!m) throw new NotFoundException('Resource not found');
      m.isActive = isActive;
      return m;
    },
    getDefault: async () => models.find((m) => m.isDefault) ?? null,
  };
}

import { NotFoundException } from '@nestjs/common';

async function makeApp(role: 'admin' | 'user' | null) {
  const svc = makeModelsService();
  const mod = await Test.createTestingModule({
    controllers: [ModelsAdminController],
    providers: [
      { provide: ModelsAdminService, useValue: svc },
      JwtAuthGuard,
      { provide: AdminGuard, useValue: testAdminGuard },
      {
        provide: JwtService,
        useValue: {
          verify: () => {
            if (role === null) throw new Error('no token');
            return { sub: role === 'admin' ? ADMIN_ID : USER_ID, role };
          },
        },
      },
    ],
  }).compile();
  const app = mod.createNestApplication();
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
}

describe('/admin/models — auth guards order', () => {
  it('without bearer token returns 401 (Unauthorized, not 403)', async () => {
    const app = await makeApp(null);
    try {
      const res = await request(app.getHttpServer()).get('/admin/models');
      expect(res.status).toBe(401);
      expect(res.body).toEqual(
        expect.objectContaining({
          statusCode: 401,
          message: expect.any(String),
          error: 'Unauthorized',
        }),
      );
    } finally {
      await app.close();
    }
  });

  it('authenticated but non-admin returns 403 (Forbidden)', async () => {
    const app = await makeApp('user');
    try {
      const res = await request(app.getHttpServer())
        .get('/admin/models')
        .set('Authorization', 'Bearer x');
      expect(res.status).toBe(403);
      expect(res.body).toEqual(
        expect.objectContaining({
          statusCode: 403,
          message: expect.any(String),
          error: 'Forbidden',
        }),
      );
    } finally {
      await app.close();
    }
  });

  it('admin can list models', async () => {
    const app = await makeApp('admin');
    try {
      const res = await request(app.getHttpServer())
        .get('/admin/models')
        .set('Authorization', 'Bearer admin-token');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect((res.body.data as any[]).map((m) => m.name)).toEqual(['gpt-4', 'claude']);
    } finally {
      await app.close();
    }
  });
});

describe('/admin/models — request validation', () => {
  it('create with missing required fields returns 400 with envelope', async () => {
    const app = await makeApp('admin');
    try {
      const res = await request(app.getHttpServer())
        .post('/admin/models')
        .set('Authorization', 'Bearer admin-token')
        .send({ name: 'foo' }); // missing provider + apiIdentifier
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('statusCode', 400);
      expect(res.body).toHaveProperty('message');
      expect(Array.isArray(res.body.message)).toBe(true);
    } finally {
      await app.close();
    }
  });

  it('create with empty body returns 400', async () => {
    const app = await makeApp('admin');
    try {
      const res = await request(app.getHttpServer())
        .post('/admin/models')
        .set('Authorization', 'Bearer admin-token')
        .send({});
      expect(res.status).toBe(400);
    } finally {
      await app.close();
    }
  });
});

describe('/admin/models — setDefault invariant', () => {
  it('setDefault makes exactly one model default at a time', async () => {
    const app = await makeApp('admin');
    try {
      // First m1 is default (per seed). Set m2 as default.
      const res = await request(app.getHttpServer())
        .patch('/admin/models/m2/default')
        .set('Authorization', 'Bearer admin-token');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('isDefault', true);

      // Now list and verify only m2 is default
      const list = await request(app.getHttpServer())
        .get('/admin/models')
        .set('Authorization', 'Bearer admin-token');
      const models = list.body.data as { id: string; isDefault: boolean }[];
      const defaults = models.filter((m) => m.isDefault);
      expect(defaults.length).toBe(1);
      expect(defaults[0].id).toBe('m2');
    } finally {
      await app.close();
    }
  });

  it('setDefault on non-existent model returns 404 with envelope', async () => {
    const app = await makeApp('admin');
    try {
      const res = await request(app.getHttpServer())
        .patch('/admin/models/nope/default')
        .set('Authorization', 'Bearer admin-token');
      expect(res.status).toBe(404);
      expect(res.body).toEqual(
        expect.objectContaining({
          statusCode: 404,
          message: expect.any(String),
          error: 'Not Found',
        }),
      );
    } finally {
      await app.close();
    }
  });

  it('remove non-existent model returns 404', async () => {
    const app = await makeApp('admin');
    try {
      const res = await request(app.getHttpServer())
        .delete('/admin/models/nope')
        .set('Authorization', 'Bearer admin-token');
      expect(res.status).toBe(404);
    } finally {
      await app.close();
    }
  });

  it('remove existing model returns 204', async () => {
    const app = await makeApp('admin');
    try {
      const res = await request(app.getHttpServer())
        .delete('/admin/models/m2')
        .set('Authorization', 'Bearer admin-token');
      expect(res.status).toBe(204);
    } finally {
      await app.close();
    }
  });

  it('updateStatus toggles active state of a model', async () => {
    const app = await makeApp('admin');
    try {
      const res = await request(app.getHttpServer())
        .patch('/admin/models/m2/status')
        .set('Authorization', 'Bearer admin-token')
        .send({ isActive: false });
      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    } finally {
      await app.close();
    }
  });
});
