import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  UsePipes,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto, LoginDto, LogoutDto, RefreshTokenDto } from './dto';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('signup')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  signup(@Body() d: SignupDto, @Req() req: any) {
    const clientInfo = {
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers?.['user-agent'],
    };
    return this.auth.signup(d.email, d.password, d.displayName, clientInfo);
  }

  // The OpenAPI contract specifies 200 for /auth/login. NestJS defaults POST
  // to 201 Created, so we override that explicitly.
  @Post('login')
  @HttpCode(200)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  login(@Body() d: LoginDto, @Req() req: any) {
    const clientInfo = {
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers?.['user-agent'],
    };
    return this.auth.login(d.email, d.password, clientInfo);
  }

  @Post('refresh')
  @HttpCode(200)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  refresh(@Body() d: RefreshTokenDto, @Req() req: any) {
    const clientInfo = {
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers?.['user-agent'],
    };
    return this.auth.refresh(d.refreshToken, clientInfo);
  }

  // The OpenAPI contract secures every endpoint under /auth with bearerAuth
  // (only signup, login and refresh override it). The caller is identified by their
  // access token, and can optionally pass refreshToken to invalidate it in the DB.
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(204)
  logout(@Req() req: any, @Body() d: LogoutDto) {
    const authHeader = req.headers?.['authorization'] as string;
    const token = req.token || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined);
    this.auth.logout(token, d?.refreshToken);
  }
}
