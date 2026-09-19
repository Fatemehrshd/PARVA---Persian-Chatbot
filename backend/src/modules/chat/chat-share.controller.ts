import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Req,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { ChatShareService } from './chat-share.service';
import { JwtAuthGuard } from '../../shared/jwt-auth.guard';

@Controller('chat')
export class ChatShareController {
  constructor(private readonly shareService: ChatShareService) {}

  /**
   * Create or update a frozen snapshot for a conversation (Authenticated)
   */
  @UseGuards(JwtAuthGuard)
  @Post('conversations/:id/share')
  async createOrUpdateShare(@Req() req: any, @Param('id') id: string) {
    return this.shareService.createOrUpdateShare(req.user.sub, id);
  }

  /**
   * Get existing share information for a conversation (Authenticated)
   */
  @UseGuards(JwtAuthGuard)
  @Get('conversations/:id/share')
  async getUserShare(@Req() req: any, @Param('id') id: string) {
    return this.shareService.getUserShare(req.user.sub, id);
  }

  /**
   * Revoke public share link for a conversation (Authenticated)
   */
  @UseGuards(JwtAuthGuard)
  @Delete('conversations/:id/share')
  @HttpCode(200)
  async revokeShare(@Req() req: any, @Param('id') id: string) {
    return this.shareService.revokeShare(req.user.sub, id);
  }

  /**
   * Public endpoint to view a frozen chat snapshot (No authentication required)
   */
  @Get('shares/:shareCode')
  async getPublicShare(@Param('shareCode') shareCode: string) {
    return this.shareService.getPublicShare(shareCode);
  }

  /**
   * Fork/clone a shared conversation to the authenticated user's account (Authenticated)
   */
  @UseGuards(JwtAuthGuard)
  @Post('shares/:shareCode/fork')
  async forkShare(@Req() req: any, @Param('shareCode') shareCode: string) {
    return this.shareService.forkShare(req.user.sub, shareCode);
  }
}
