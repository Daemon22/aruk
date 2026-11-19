// Seeds shared provider reference data only. It never creates users, credentials,
// vault records, usage history, or other customer-shaped demo data.
import { db } from '@/lib/db';

const PROVIDERS = [
  { name: 'OpenAI', description: 'OpenAI API services' },
  { name: 'Anthropic', description: 'Anthropic API services' },
  { name: 'Google', description: 'Google AI services' },
  { name: 'Groq', description: 'Groq API services' },
  { name: 'OpenRouter', description: 'OpenRouter API services' },
  { name: 'DeepSeek', description: 'DeepSeek API services' },
  { name: 'Mistral', description: 'Mistral AI services' },
  { name: 'Together', description: 'Together AI services' },
  { name: 'Local Models', description: 'Self-hosted model services' },
];

async function seed() {
  for (const provider of PROVIDERS) {
    await db.provider.upsert({ where: { name: provider.name }, update: provider, create: provider });
  }
  console.log(`Seeded ${PROVIDERS.length} shared provider records. No user or vault data was created.`);
}

seed().catch((error) => {
  console.error('Provider catalog seed failed:', error);
  process.exitCode = 1;
}).finally(() => db.$disconnect());
