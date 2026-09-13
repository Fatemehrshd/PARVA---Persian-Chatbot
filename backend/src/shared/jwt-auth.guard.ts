import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwt: JwtService) {}
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const h = req.headers['authorization'] as string;
    if (!h?.startsWith('Bearer ')) throw new UnauthorizedException('Missing or invalid access token');
    try {
      req.user = this.jwt.verify(h.slice(7));
      return true;
    } catch { throw new UnauthorizedException('Missing or invalid access token'); }
  }
}
