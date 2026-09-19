import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TtsModule } from '../src/modules/tts/tts.module';
import { ResponseEnvelopeInterceptor } from '../src/shared/response-envelope.interceptor';
import { Readable } from 'node:stream';
import { TtsService } from '../src/modules/tts/tts.service';

describe('TTS (Text-to-Speech) API', () => {
  let app: INestApplication;
  let ttsService: TtsService;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [TtsModule],
    }).compile();

    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
    await app.init();

    ttsService = mod.get<TtsService>(TtsService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/tts/voices returns available engines and voices', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/tts/voices');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    const data = res.body.data;
    expect(data).toHaveProperty('engines');
    expect(data.engines).toBeInstanceOf(Array);
    expect(data.engines.some((e: any) => e.id === 'edge')).toBe(true);
    expect(data.engines.some((e: any) => e.id === 'openai')).toBe(true);
  });

  it('POST /api/v1/tts/synthesize rejects request with empty text (400)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/tts/synthesize')
      .send({ text: '' });

    expect(res.status).toBe(400);
  });

  it('POST /api/v1/tts/synthesize streams audio/mpeg binary chunks', async () => {
    const mockAudioStream = new Readable({
      read() {
        this.push(Buffer.from([0xff, 0xfb, 0x90, 0x64])); // MP3 frame header
        this.push(null);
      },
    });

    const spy = jest
      .spyOn(ttsService, 'synthesizeStream')
      .mockResolvedValueOnce(mockAudioStream);

    const res = await request(app.getHttpServer())
      .post('/api/v1/tts/synthesize')
      .send({ text: 'سلام دنیا', engine: 'edge', voice: 'dilara' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('audio/mpeg');
    expect(res.body).toBeInstanceOf(Buffer);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'سلام دنیا', engine: 'edge', voice: 'dilara' }),
    );
  });

  it('GET /api/v1/tts/synthesize streams audio with query parameters', async () => {
    const mockAudioStream = new Readable({
      read() {
        this.push(Buffer.from([0xff, 0xfb, 0x90, 0x64]));
        this.push(null);
      },
    });

    const spy = jest
      .spyOn(ttsService, 'synthesizeStream')
      .mockResolvedValueOnce(mockAudioStream);

    const res = await request(app.getHttpServer())
      .get('/api/v1/tts/synthesize')
      .query({ text: 'خداحافظ', engine: 'openai', voice: 'nova' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('audio/mpeg');
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'خداحافظ', engine: 'openai', voice: 'nova' }),
    );
  });
});
