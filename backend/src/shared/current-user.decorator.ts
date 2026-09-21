import { createParamDecorator, ExecutionContext } from '@nestjs/common';
export const CurrentUser = createParamDecorator(
  (_d: unknown, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest().user;
    if (user && typeof user === 'object') {
      user.id = user.id || user.sub;
    }
    return user;
  },
);
