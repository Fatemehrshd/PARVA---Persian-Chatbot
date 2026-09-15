/**
 * Standalone DataSource for the TypeORM CLI (migration:generate / migrate:run).
 * The runtime app keeps using TypeOrmModule.forRoot in app.module.ts with
 * DB_SYNC for local development; production uses these migrations.
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();
import { DataSource } from 'typeorm';
import { User } from './modules/users/user.entity';
import { Conversation } from './modules/chat/conversation.entity';
import { Message } from './modules/chat/message.entity';
import { AiModel } from './modules/models-admin/ai-model.entity';
import { AiProvider } from './modules/models-admin/ai-provider.entity';
import { SystemSetting } from './modules/admin/system-setting.entity';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  database: process.env.DB_NAME || 'codeless',
  entities: [User, Conversation, Message, AiModel, AiProvider, SystemSetting],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
});
