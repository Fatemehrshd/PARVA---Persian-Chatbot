import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { ResponseEnvelopeInterceptor } from '../src/shared/response-envelope.interceptor';

describe('Health endpoint', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();
    app = mod.createNestApplication();
    app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
    await app.init();
  });
  afterAll(async () => app.close());

  it('GET /health returns 200 with status ok and envelope', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toHaveProperty('status', 'ok');
    expect(res.body.data).toHaveProperty('uptime');
    expect(res.body.data).toHaveProperty('timestamp');
  });
});
