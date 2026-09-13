/**
 * Idempotent admin bootstrap.
 *
 * The /admin/models endpoints cannot be reached without an admin user,
 * and there is no API to create the first one. This script reads
 * ADMIN_EMAIL and ADMIN_PASSWORD from env and creates the user with
 * role='admin' if it does not already exist. Re-running it is safe.
 *
 * Usage:
 *   npm run seed:admin
 */
import * as dotenv from 'dotenv';
dotenv.config();
import { DataSource } from 'typeorm';
import bcrypt from 'bcryptjs';
import { User } from '../modules/users/user.entity';
import { Conversation } from '../modules/chat/conversation.entity';
import { Message } from '../modules/chat/message.entity';
import { AiModel } from '../modules/models-admin/ai-model.entity';

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in the environment.');
    process.exit(2);
  }
  if (password.length < 8) {
    console.error('ADMIN_PASSWORD must be at least 8 characters.');
    process.exit(2);
  }

  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASS ?? 'postgres',
    database: process.env.DB_NAME ?? 'codeless',
    entities: [User, Conversation, Message, AiModel],
    synchronize: (process.env.DB_SYNC ?? 'true') === 'true',
  });
  await ds.initialize();

  const repo = ds.getRepository(User);
  const existing = await repo.findOne({ where: { email } });
  if (existing) {
    if (existing.role === 'admin') {
      console.log(`Admin already exists: ${email}`);
    } else {
      existing.role = 'admin';
      await repo.save(existing);
      console.log(`Promoted existing user to admin: ${email}`);
    }
    await ds.destroy();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const u = repo.create({
    email,
    passwordHash,
    role: 'admin',
    displayName: 'Admin',
  });
  await repo.save(u);
  console.log(`Admin created: ${email}`);
  await ds.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
