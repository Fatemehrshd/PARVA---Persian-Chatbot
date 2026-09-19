import { Test } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminFilesController } from '../src/modules/admin/admin-files.controller';
import { FileAttachment } from '../src/modules/files/file-attachment.entity';
import { User } from '../src/modules/users/user.entity';
import { FilesService } from '../src/modules/files/files.service';
import { QueueManagerService } from '../src/modules/files/queue-manager.service';
import { JwtAuthGuard } from '../src/shared/jwt-auth.guard';
import { AdminGuard } from '../src/shared/admin.guard';
import { testAdminGuard } from './test-utils';
import { HttpExceptionFilter } from '../src/shared/http-exception.filter';
import { ResponseEnvelopeInterceptor } from '../src/shared/response-envelope.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';

describe('AdminFilesController E2E / Integration', () => {
  let app: INestApplication;
  let currentUserId = 'admin-id';
  let currentUserRole = 'admin';

  const mockFileAttachments: any[] = [
    {
      id: 'file-1',
      originalName: 'report.pdf',
      mimeType: 'application/pdf',
      fileType: 'pdf',
      fileSize: 102400,
      status: 'ready',
      extractedText: 'Extracted PDF text content',
      errorMessage: null,
      isDeleted: false,
      userId: 'u1',
      conversationId: 'c1',
      messageId: 'm1',
      createdAt: new Date('2026-09-17T10:00:00Z'),
      updatedAt: new Date('2026-09-17T10:00:05Z'),
      user: { id: 'u1', email: 'user@test.com', displayName: 'Ali User' },
      conversation: { id: 'c1', title: 'Conversation with PDF' },
      metadata: { processingDurationMs: 450 },
    },
    {
      id: 'file-2',
      originalName: 'corrupt.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileType: 'excel',
      fileSize: 204800,
      status: 'error',
      extractedText: null,
      errorMessage: 'Invalid excel archive structure',
      isDeleted: false,
      userId: 'u2',
      conversationId: 'c2',
      messageId: 'm2',
      createdAt: new Date('2026-09-17T11:00:00Z'),
      updatedAt: new Date('2026-09-17T11:00:02Z'),
      user: { id: 'u2', email: 'sara@test.com', displayName: 'Sara' },
      conversation: { id: 'c2', title: 'Excel Test' },
      metadata: { processingDurationMs: 120, errorDetails: 'Bad zip header' },
    },
  ];

  const mockFileRepo = {
    count: jest.fn().mockImplementation(async ({ where }: any) => {
      let filtered = mockFileAttachments.filter((f) => !f.isDeleted);
      if (where?.status) {
        filtered = filtered.filter((f) => f.status === where.status);
      }
      return filtered.length;
    }),
    createQueryBuilder: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ totalBytes: 307200 }),
      getManyAndCount: jest.fn().mockResolvedValue([mockFileAttachments, mockFileAttachments.length]),
    }),
    findOne: jest.fn().mockImplementation(async ({ where }: any) => {
      const found = mockFileAttachments.find((f) => f.id === where.id && !f.isDeleted);
      return found ? { ...found } : null;
    }),
    save: jest.fn().mockImplementation(async (entity: any) => entity),
  };

  const mockUserRepo = {
    findOne: jest.fn(),
  };

  const mockFilesService = {
    deleteFile: jest.fn().mockResolvedValue(undefined),
    getFileBuffer: jest.fn().mockResolvedValue(Buffer.from('PDF_DUMMY_BINARY_DATA')),
  };

  const mockQueueManager = {
    enqueueFileProcessing: jest.fn().mockResolvedValue('job-123'),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminFilesController],
      providers: [
        {
          provide: getRepositoryToken(FileAttachment),
          useValue: mockFileRepo,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
        {
          provide: FilesService,
          useValue: mockFilesService,
        },
        {
          provide: QueueManagerService,
          useValue: mockQueueManager,
        },
        JwtAuthGuard,
        { provide: AdminGuard, useValue: testAdminGuard },
        {
          provide: JwtService,
          useValue: {
            verify: () => ({ sub: currentUserId, role: currentUserRole, email: 'admin@test.com' }),
          },
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: ResponseEnvelopeInterceptor,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /admin/files/stats returns file aggregated counts and total storage size', async () => {
    currentUserRole = 'admin';
    const res = await request(app.getHttpServer())
      .get('/admin/files/stats')
      .set('Authorization', 'Bearer admin-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      totalFiles: 2,
      readyFiles: 1,
      errorFiles: 1,
      totalSizeBytes: 307200,
    });
  });

  it('GET /admin/files returns paginated file list with user details', async () => {
    currentUserRole = 'admin';
    const res = await request(app.getHttpServer())
      .get('/admin/files?page=1&limit=10&status=all')
      .set('Authorization', 'Bearer admin-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.items[0]).toMatchObject({
      id: 'file-1',
      originalName: 'report.pdf',
      fileType: 'pdf',
      status: 'ready',
      user: {
        email: 'user@test.com',
      },
    });
  });

  it('GET /admin/files/:id returns detailed file info including extractedText', async () => {
    currentUserRole = 'admin';
    const res = await request(app.getHttpServer())
      .get('/admin/files/file-1')
      .set('Authorization', 'Bearer admin-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: 'file-1',
      originalName: 'report.pdf',
      extractedText: 'Extracted PDF text content',
      status: 'ready',
    });
  });

  it('GET /admin/files/:id returns 404 when file does not exist', async () => {
    currentUserRole = 'admin';
    const res = await request(app.getHttpServer())
      .get('/admin/files/non-existent-file')
      .set('Authorization', 'Bearer admin-token');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('POST /admin/files/:id/retry enqueues file to processing queue', async () => {
    currentUserRole = 'admin';
    const res = await request(app.getHttpServer())
      .post('/admin/files/file-2/retry')
      .set('Authorization', 'Bearer admin-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('processing');
    expect(mockQueueManager.enqueueFileProcessing).toHaveBeenCalledWith('file-2');
  });

  it('DELETE /admin/files/:id deletes file through filesService', async () => {
    currentUserRole = 'admin';
    const res = await request(app.getHttpServer())
      .delete('/admin/files/file-1')
      .set('Authorization', 'Bearer admin-token');

    expect(res.status).toBe(204);
    expect(mockFilesService.deleteFile).toHaveBeenCalledWith('u1', 'file-1');
  });

  it('GET /admin/files returns 403 Forbidden for non-admin user', async () => {
    currentUserRole = 'user';
    const res = await request(app.getHttpServer())
      .get('/admin/files')
      .set('Authorization', 'Bearer user-token');

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('GET /admin/files/:id/content streams file buffer with proper headers for admin', async () => {
    currentUserRole = 'admin';
    const res = await request(app.getHttpServer())
      .get('/admin/files/file-1/content')
      .set('Authorization', 'Bearer admin-token');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain("filename*=UTF-8''");
    expect(res.body.toString()).toBe('PDF_DUMMY_BINARY_DATA');
  });

  it('GET /admin/files/:id/content allows auth via query token for new browser tab downloads', async () => {
    currentUserRole = 'admin';
    const res = await request(app.getHttpServer())
      .get('/admin/files/file-1/content?token=admin-token');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.body.toString()).toBe('PDF_DUMMY_BINARY_DATA');
  });

  it('GET /admin/files/:id/content returns 404 for non-existent file', async () => {
    currentUserRole = 'admin';
    const res = await request(app.getHttpServer())
      .get('/admin/files/non-existent-file/content')
      .set('Authorization', 'Bearer admin-token');

    expect(res.status).toBe(404);
  });
});
