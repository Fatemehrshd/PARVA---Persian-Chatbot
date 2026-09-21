import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { User } from './user.entity';
import { UsersService } from './users.service';
import { ProfileService } from './profile.service';
import { UsersController, AvatarsStaticController } from './users.controller';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';
import { QuotaInterceptor } from '../../shared/response-envelope.interceptor';
import { ChatModule } from '../chat/chat.module';
@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    forwardRef(() => ChatModule),
    JwtModule.register({ secret: process.env.JWT_SECRET ?? 'dev-secret' }),
  ],
  controllers: [UsersController, AvatarsStaticController],
  providers: [UsersService, ProfileService, JwtAuthGuard, QuotaInterceptor],
  exports: [UsersService],
})
export class UsersModule {}
