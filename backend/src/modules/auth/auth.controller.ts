import {
  Controller,
  Post,
  Body,
  HttpCode,
  UsePipes,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto, LoginDto, LogoutDto } from './dto';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('signup')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  signup(@Body() d: SignupDto) {
    return this.auth.signup(d.email, d.password, d.displayName);
  }

  @Post('login')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  login(@Body() d: LoginDto) {
    return this.auth.login(d.email, d.password);
  }

  // The OpenAPI contract secures every endpoint under /auth with bearerAuth
  // (only signup and login override it). The caller is identified by their
  // access token, so the body is no longer trusted for revocation.
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(204)
  logout(@Body() _d: LogoutDto) {
    this.auth.logout();
  }
}
