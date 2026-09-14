import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { User } from './user.entity';
import { UsersService } from './users.service';
import { ProfileService } from './profile.service';
import { UsersController, AvatarsStaticController } from './users.controller';
import { ModelsAdminModule } from '../models-admin/models-admin.module';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    ModelsAdminModule,
    JwtModule.register({ secret: process.env.JWT_SECRET ?? 'dev-secret' }),
  ],
  controllers: [UsersController, AvatarsStaticController],
  providers: [UsersService, ProfileService, JwtAuthGuard],
  exports: [UsersService],
})
export class UsersModule {}
