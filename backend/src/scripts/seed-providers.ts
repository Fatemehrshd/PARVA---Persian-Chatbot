/**
 * Idempotent provider-registry backfill.
 *
 * Before this feature `AiModel.provider` was just a free-text label.
 * This script materializes one ai_providers row per distinct label, links
 * existing models via providerId, seeds each provider's defaultModelId
 * from the legacy platform default (first hit per provider), and copies a
 * model's stored apiKey/baseUrl up to its provider only when the provider
 * has none. Safe to re-run.
 *
 * Usage:
 *   npm run seed:providers
 */
import * as dotenv from 'dotenv';
dotenv.config();
import { DataSource } from 'typeorm';
import { User } from '../modules/users/user.entity';
import { Conversation } from '../modules/chat/conversation.entity';
import { Message } from '../modules/chat/message.entity';
import { AiModel } from '../modules/models-admin/ai-model.entity';
import { AiProvider } from '../modules/models-admin/ai-provider.entity';

async function main(): Promise<void> {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'postgres',
    database: process.env.DB_NAME || 'codeless',
    entities: [User, Conversation, Message, AiModel, AiProvider],
    synchronize: (process.env.DB_SYNC ?? 'true') === 'true',
  });
  await ds.initialize();

  const providers = ds.getRepository(AiProvider);
  const models = ds.getRepository(AiModel);
  const all = await models.find({ order: { createdAt: 'ASC' } });

  const byName = new Map<string, AiProvider>();
  for (const m of all) {
    if (!m.provider) continue;
    let p = byName.get(m.provider);
    if (!p) {
      p =
        (await providers.findOne({ where: { name: m.provider } })) ||
        (await providers.save(providers.create({ name: m.provider, isActive: true })));
      byName.set(m.provider, p);
    }
    if (!m.providerId) {
      m.providerId = p.id;
      await models.save(m);
    }
    if (!p.apiKey && m.apiKey) {
      p.apiKey = m.apiKey;
      await providers.save(p);
    }
    if (!p.baseUrl && m.baseUrl) {
      p.baseUrl = m.baseUrl;
      await providers.save(p);
    }
    if (!p.defaultModelId && m.isDefault) {
      p.defaultModelId = m.id;
      await providers.save(p);
    }
  }

  console.log(
    `Providers ensured: ${byName.size}; models scanned: ${all.length}. Re-running is safe.`,
  );
  await ds.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
