import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  Res,
  UsePipes,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { SignupDto, LoginDto, LogoutDto, RefreshTokenDto } from './dto';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };
  }

  private setRefreshCookie(res: Response, refreshToken: string) {
    res.cookie('refreshToken', refreshToken, this.cookieOptions());
  }

  private readRefreshCookie(req: any): string | undefined {
    const rawCookie = req.headers?.cookie;
    if (typeof rawCookie !== 'string') return undefined;
    const pair = rawCookie.split(';').map((part: string) => part.trim()).find((part: string) => part.startsWith('refreshToken='));
    if (!pair) return undefined;
    try {
      return decodeURIComponent(pair.slice('refreshToken='.length));
    } catch {
      return undefined;
    }
  }

  private publicAuthResponse(result: any, res: Response) {
    this.setRefreshCookie(res, result.refreshToken);
    const { refreshToken: _refreshToken, ...publicResult } = result;
    return publicResult;
  }

  @Post('signup')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  signup(@Body() d: SignupDto, @Req() req: any, @Res({ passthrough: true }) res: Response) {
    const clientInfo = {
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers?.['user-agent'],
    };
    return this.auth.signup(d.email, d.password, d.displayName, clientInfo).then((result) => this.publicAuthResponse(result, res));
  }

  // The OpenAPI contract specifies 200 for /auth/login. NestJS defaults POST
  // to 201 Created, so we override that explicitly.
  @Post('login')
  @HttpCode(200)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  login(@Body() d: LoginDto, @Req() req: any, @Res({ passthrough: true }) res: Response) {
    const clientInfo = {
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers?.['user-agent'],
    };
    return this.auth.login(d.email, d.password, clientInfo).then((result) => this.publicAuthResponse(result, res));
  }

  @Post('refresh')
  @HttpCode(200)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  refresh(@Body() d: RefreshTokenDto, @Req() req: any, @Res({ passthrough: true }) res: Response) {
    const clientInfo = {
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers?.['user-agent'],
    };
    const refreshToken = this.readRefreshCookie(req) || d.refreshToken;
    return this.auth.refresh(refreshToken || '', clientInfo).then((result) => this.publicAuthResponse(result, res));
  }

  // The OpenAPI contract secures every endpoint under /auth with bearerAuth
  // (only signup, login and refresh override it). The caller is identified by their
  // access token, and can optionally pass refreshToken to invalidate it in the DB.
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(204)
  logout(@Req() req: any, @Body() d: LogoutDto, @Res({ passthrough: true }) res: Response) {
    const authHeader = req.headers?.['authorization'] as string;
    const token = req.token || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined);
    this.auth.logout(token, this.readRefreshCookie(req) || d?.refreshToken);
    const { maxAge: _maxAge, ...clearCookieOptions } = this.cookieOptions();
    res.clearCookie('refreshToken', clearCookieOptions);
  }
}
