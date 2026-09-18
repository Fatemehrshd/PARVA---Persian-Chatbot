import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../modules/auth/auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwt: JwtService) {}
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const h = req.headers['authorization'] as string;
    const token = h?.startsWith('Bearer ') ? h.slice(7) : (req.query?.token as string);
    if (!token)
      throw new UnauthorizedException('Missing or invalid access token');
    if (AuthService.isTokenRevoked(token)) {
      throw new UnauthorizedException('Missing or invalid access token');
    }
    try {
      req.user = this.jwt.verify(token);
      req.token = token;
      return true;
    } catch {
      throw new UnauthorizedException('Missing or invalid access token');
    }
  }
}
