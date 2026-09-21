import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebSearchService } from './web-search.service';
import { SystemSetting } from '../admin/system-setting.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SystemSetting])],
  providers: [WebSearchService],
  exports: [WebSearchService],
})
export class WebSearchModule {}
