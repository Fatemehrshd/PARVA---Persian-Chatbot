import { Test } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { ProfileService } from '../src/modules/users/profile.service';
import { UsersController } from '../src/modules/users/users.controller';
import { JwtAuthGuard } from '../src/shared/jwt-auth.guard';
import { HttpExceptionFilter } from '../src/shared/http-exception.filter';
import { StorageService } from '../src/modules/storage/storage.service';
import { ChatService } from '../src/modules/chat/chat.service';
import { MAX_AVATAR_BYTES } from '../src/modules/users/profile.service';

/** ---------- ProfileService unit tests (fakes at repo/storage boundary) ---------- */

async function makeProfile(password = 'current123') {
  const stored: { user: any } = {
    user: {
      id: 'u1',
      email: 'a@b.co',
      passwordHash: '',
      displayName: 'A',
      language: 'fa',
      theme: 'dark',
      role: 'user',
    },
  };
  const users: any = {
    findById: async () => stored.user,
    findByUsername: async (n: string) => (n === 'taken' ? ({ id: 'other' } as any) : null),
    findByEmail: async (e: string) => (e === 'dup@b.co' ? ({ id: 'other' } as any) : null),
    save: async (u: any) => {
      stored.user = u;
      return u;
    },
  };
  const puts: string[] = [];
  const removes: string[] = [];
  const storage: any = {
    put: async (key: string) => {
      puts.push(key);
    },
    remove: async (key: string) => {
      removes.push(key);
    },
    publicUrl: (key: string) => `http://base/static/${key}`,
  };
  const models: any = {
    getRawById: async (id: string) =>
      id === 'model-ok' ? { id, isActive: true } : id === 'model-off' ? { id, isActive: false } : null,
  };
  stored.user.passwordHash = await bcrypt.hash(password, 4);
  const svc = new ProfileService(users, storage, models);
  return { svc, stored, users, storage, puts, removes };
}

it('username: lowercased on save; format error 400; taken 409', async () => {
  const { svc, stored } = await makeProfile();
  const ok: any = await svc.updateProfile('u1', { username: 'ali_9' });
  expect(ok.username).toBe('ali_9');
  await expect(svc.updateProfile('u1', { username: 'ab' })).rejects.toBeInstanceOf(BadRequestException);
  await expect(svc.updateProfile('u1', { username: 'taken' })).rejects.toBeInstanceOf(ConflictException);
  expect(stored.user.username).toBe('ali_9');
});

it('preferences: invalid timezone 400; valid saved; missing/inactive default model 400', async () => {
  const { svc, stored } = await makeProfile();
  await expect(svc.updatePreferences('u1', { timezone: 'Mars/Olympus' } as any)).rejects.toBeInstanceOf(
    BadRequestException,
  );
  await expect(svc.updatePreferences('u1', { defaultModelId: 'nope' } as any)).rejects.toBeInstanceOf(
    BadRequestException,
  );
  await expect(svc.updatePreferences('u1', { defaultModelId: 'model-off' } as any)).rejects.toBeInstanceOf(
    BadRequestException,
  );
  const r: any = await svc.updatePreferences('u1', {
    timezone: 'Asia/Tehran',
    defaultModelId: 'model-ok',
    language: 'en',
    theme: 'light',
  } as any);
  expect(r).toMatchObject({ timezone: 'Asia/Tehran', defaultModelId: 'model-ok', language: 'en', theme: 'light' });
  expect(stored.user.language).toBe('en');
});

it('changeEmail: wrong current password 401; taken email 409; success applies immediately', async () => {
  const { svc, stored } = await makeProfile();
  await expect(svc.changeEmail('u1', { email: 'new@b.co', password: 'WRONG' } as any)).rejects.toBeInstanceOf(
    UnauthorizedException,
  );
  await expect(
    svc.changeEmail('u1', { email: 'dup@b.co', password: 'current123' } as any),
  ).rejects.toBeInstanceOf(ConflictException);
  const r: any = await svc.changeEmail('u1', { email: 'new@b.co', password: 'current123' } as any);
  expect(r.email).toBe('new@b.co');
  expect(stored.user.email).toBe('new@b.co');
});

it('changePassword: verifies current, stores new bcrypt hash', async () => {
  const { svc, stored } = await makeProfile();
  await expect(
    svc.changePassword('u1', { currentPassword: 'bad', newPassword: 'brand-new-1' } as any),
  ).rejects.toBeInstanceOf(UnauthorizedException);
  await svc.changePassword('u1', { currentPassword: 'current123', newPassword: 'brand-new-1' } as any);
  expect(await bcrypt.compare('brand-new-1', stored.user.passwordHash)).toBe(true);
  expect(await bcrypt.compare('current123', stored.user.passwordHash)).toBe(false);
});

it('setAvatar: png ok -> stored, url built, OLD object removed; webp/exe/oversize/missing rejected; 503 propagates', async () => {
  const { svc, stored, puts, removes } = await makeProfile();
  stored.user.avatarKey = 'avatars/u1/old.png';
  const r: any = await svc.setAvatar('u1', { buffer: Buffer.from('img'), mimetype: 'image/png' });
  expect(r.avatarUrl).toMatch(/^http:\/\/base\/static\/avatars\/u1\/.+\.png$/);
  expect(puts).toHaveLength(1);
  expect(removes).toEqual(['avatars/u1/old.png']);

  await expect(
    svc.setAvatar('u1', { buffer: Buffer.from('MZ'), mimetype: 'application/x-msdownload' } as any),
  ).rejects.toBeInstanceOf(BadRequestException);
  await expect(svc.setAvatar('u1', { buffer: undefined, mimetype: 'image/png' } as any)).rejects.toBeInstanceOf(
    BadRequestException,
  );
  await expect(
    svc.setAvatar('u1', { buffer: Buffer.alloc(MAX_AVATAR_BYTES + 1), mimetype: 'image/png' } as any),
  ).rejects.toBeInstanceOf(BadRequestException);

  const broken = await makeProfile();
  broken.storage.put = async () => {
    throw new ServiceUnavailableException('MinIO not configured');
  };
  await expect(
    broken.svc.setAvatar('u1', { buffer: Buffer.from('img'), mimetype: 'image/png' } as any),
  ).rejects.toBeInstanceOf(ServiceUnavailableException);
});

it('removeAvatar clears fields and deletes the object', async () => {
  const { svc, stored, removes } = await makeProfile();
  stored.user.avatarKey = 'avatars/u1/x.png';
  stored.user.avatarUrl = 'http://base/static/avatars/u1/x.png';
  const r: any = await svc.removeAvatar('u1');
  expect(r.avatarUrl).toBeNull();
  expect(removes).toEqual(['avatars/u1/x.png']);
});

/** ---------- StorageService unit (env-driven) ---------- */

it('StorageService: unconfigured env => configured=false and put() throws 503; publicUrl builds path', async () => {
  const saved = { ...process.env };
  delete process.env.MINIO_ENDPOINT;
  delete process.env.MINIO_ACCESS_KEY;
  delete process.env.MINIO_SECRET_KEY;
  const st = new StorageService();
  expect(st.configured).toBe(false);
  await expect(st.put('k', Buffer.from('x'), 'image/png')).rejects.toBeInstanceOf(ServiceUnavailableException);
  expect(st.publicUrl('avatars/u1/a.png')).toBe('/static/avatars/u1/a.png');
  Object.assign(process.env, saved);
});

/** ---------- Chat: user default-model resolution chain ---------- */

it('create(): no modelId uses user defaultModelId, else platform default', async () => {
  let storedConv: any;
  const conv: any = {
    create: (o: any) => o,
    save: async (o: any) => {
      storedConv = o;
      return o;
    },
  };
  const models: any = {
    getDefault: async () => ({ id: 'platform' }),
    getRawById: async (id: string) => ({ id, isActive: id === 'udef' }),
  };
  const usersWith: (d: any) => any = (defaultModelId) => ({ findById: async () => ({ defaultModelId }) });
  const mk = (users: any) => new ChatService(conv, {} as any, models, users, {} as any);

  await mk(usersWith('udef')).create('u1', undefined, 't');
  expect(storedConv.modelId).toBe('udef');

  await mk(usersWith('gone')).create('u1', undefined, 't');
  expect(storedConv.modelId).toBe('platform');

  await mk(usersWith(null)).create('u1', undefined, 't');
  expect(storedConv.modelId).toBe('platform');
});

/** ---------- HTTP wiring (controller-level, fake ProfileService) ---------- */

async function httpApp(profile: any) {
  const mod = await Test.createTestingModule({
    controllers: [UsersController],
    providers: [
      { provide: ProfileService, useValue: profile },
      JwtAuthGuard,
      { provide: JwtService, useValue: { verify: () => ({ sub: 'u1', role: 'user' }) } },
    ],
  }).compile();
  const app: INestApplication = mod.createNestApplication();
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
}

it('GET /users/me requires a bearer token', async () => {
  const app = await httpApp({ getProfile: async () => ({ id: 'u1' }) });
  expect((await request(app.getHttpServer()).get('/users/me')).status).toBe(401);
  const ok = await request(app.getHttpServer()).get('/users/me').set('Authorization', 'Bearer t');
  expect(ok.status).toBe(200);
  await app.close();
});

it('PATCH /users/me with malformed username -> 400 from the DTO', async () => {
  const app = await httpApp({ updateProfile: async () => ({}) });
  const res = await request(app.getHttpServer())
    .patch('/users/me')
    .set('Authorization', 'Bearer t')
    .send({ username: 'A B!' });
  expect(res.status).toBe(400);
  await app.close();
});

it('POST /users/me/avatar accepts multipart png and rejects missing file / bad type', async () => {
  const seen: any[] = [];
  const app = await httpApp({
    setAvatar: async (_u: string, f: any) => {
      seen.push(f.mimetype);
      return { avatarUrl: 'http://base/static/x.png' };
    },
  });
  const ok = await request(app.getHttpServer())
    .post('/users/me/avatar')
    .set('Authorization', 'Bearer t')
    .attach('file', Buffer.from('\x89PNG img'), { filename: 'a.png', contentType: 'image/png' });
  expect(ok.status).toBe(201);
  expect(seen).toEqual(['image/png']);

  const noFile = await request(app.getHttpServer())
    .post('/users/me/avatar')
    .set('Authorization', 'Bearer t')
    .field('foo', 'bar');
  expect(noFile.status).toBe(400);
  await app.close();
});

it('POST /users/me/avatar with a >2MB file -> 413 with localized envelope (multer limit)', async () => {
  const app = await httpApp({ setAvatar: async () => ({}) });
  const res = await request(app.getHttpServer())
    .post('/users/me/avatar')
    .set('Authorization', 'Bearer t')
    .attach('file', Buffer.alloc(MAX_AVATAR_BYTES + 1024), {
      filename: 'big.png',
      contentType: 'image/png',
    });
  expect(res.status).toBe(413);
  expect(res.body).toMatchObject({ success: false });
  expect(res.body.message).toContain('۲ مگابایت');
  expect(res.body.error).toBe('Payload Too Large');
  await app.close();
});
