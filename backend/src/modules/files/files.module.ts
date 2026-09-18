import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileAttachment } from './file-attachment.entity';
import { User } from '../users/user.entity';
import { StorageModule } from '../storage/storage.module';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { AdminFilesController } from '../admin/admin-files.controller';
import { MalwareScannerService } from './malware-scanner.service';
import { FileProcessorService } from './file-processor.service';
import { QueueManagerService } from './queue-manager.service';
import { FileCleanupService } from './file-cleanup.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([FileAttachment, User]),
    StorageModule,
    forwardRef(() => AdminModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [FilesController, AdminFilesController],
  providers: [
    FilesService,
    MalwareScannerService,
    FileProcessorService,
    QueueManagerService,
    FileCleanupService,
  ],
  exports: [FilesService, FileProcessorService, QueueManagerService],
})
export class FilesModule {}

