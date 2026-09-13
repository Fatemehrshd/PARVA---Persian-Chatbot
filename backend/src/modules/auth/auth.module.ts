import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
import { AdminGuard } from '../../shared/admin.guard';
@Module({ imports: [UsersModule, JwtModule.register({ secret: process.env.JWT_SECRET ?? 'dev-secret', signOptions: {} })], controllers: [AuthController], providers: [AuthService, JwtAuthGuard, AdminGuard], exports: [JwtAuthGuard, AdminGuard] })
export class AuthModule {}
