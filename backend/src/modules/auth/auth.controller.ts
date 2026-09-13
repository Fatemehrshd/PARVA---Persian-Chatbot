import { Controller, Post, Body, HttpCode, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto, LoginDto, LogoutDto } from './dto';
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}
  @Post('signup') @UsePipes(new ValidationPipe({ whitelist: true })) signup(@Body() d: SignupDto) { return this.auth.signup(d.email, d.password, d.displayName); }
  @Post('login') @UsePipes(new ValidationPipe({ whitelist: true })) login(@Body() d: LoginDto) { return this.auth.login(d.email, d.password); }
  @Post('logout') @HttpCode(204) logout(@Body() d: LogoutDto) { return this.auth.logout(d?.refreshToken); }
}
