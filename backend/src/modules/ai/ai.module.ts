import { Module } from '@nestjs/common';
import { OpenAiCompatForwarder } from './openai-compat.forwarder';

@Module({
  providers: [OpenAiCompatForwarder],
  exports: [OpenAiCompatForwarder],
})
export class AiModule {}
