import * as fs from 'fs';
import * as path from 'path';
import { SeededRandom } from './seeded-random';

/**
 * Generates deeply nested JSON config files and a large feature-flags file.
 * Config errors are injected separately by bug-injector.
 */
export function generateConfigs(outputDir: string, rng: SeededRandom): number {
  let fileCount = 0;

  // Environment configs
  const environments = ['production', 'staging', 'development', 'testing'];
  const configTypes = ['database', 'cache', 'api-gateway', 'logging', 'security', 'messaging'];

  for (const env of environments) {
    for (const configType of configTypes) {
      // Skip configs that bug-injector will create for production
      if (env === 'production' && ['database', 'cache', 'api-gateway'].includes(configType)) {
        continue;
      }

      const configDir = path.join(outputDir, 'config', 'environments', env);
      fs.mkdirSync(configDir, { recursive: true });

      const config = generateConfigContent(configType, env, rng);
      fs.writeFileSync(
        path.join(configDir, `${configType}.json`),
        JSON.stringify(config, null, 2)
      );
      fileCount++;
    }
  }

  // Feature flags file (~2MB)
  const featureFlags: Record<string, any> = {};
  for (let i = 0; i < 2000; i++) {
    featureFlags[`flag_${rng.identifier(12)}_${i}`] = {
      enabled: rng.next() > 0.5,
      description: `Feature flag ${i}: ${rng.identifier(20)}`,
      rollout: {
        percentage: rng.int(0, 100),
        strategy: rng.pick(['percentage', 'user-list', 'region', 'gradual']),
        regions: Array.from({ length: rng.int(1, 5) }, () =>
          rng.pick(['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1', 'sa-east-1'])
        ),
      },
      metadata: {
        createdBy: `user-${rng.identifier(6)}`,
        createdAt: new Date(2026, rng.int(0, 2), rng.int(1, 28)).toISOString(),
        tags: Array.from({ length: rng.int(1, 5) }, () => rng.identifier(8)),
      },
    };
  }

  const flagsPath = path.join(outputDir, 'config', 'feature-flags.json');
  fs.writeFileSync(flagsPath, JSON.stringify(featureFlags, null, 2));
  fileCount++;

  console.log(`  Generated ${fileCount} config files`);
  return fileCount;
}

function generateConfigContent(configType: string, env: string, rng: SeededRandom): any {
  const base: any = {
    environment: env,
    version: '1.0.0',
    updatedAt: new Date(2026, 2, rng.int(1, 12)).toISOString(),
  };

  switch (configType) {
    case 'database':
      return {
        ...base,
        primary: {
          host: `db-primary.${env}.internal`,
          port: 5432,
          pool: { min: env === 'production' ? 5 : 1, max: env === 'production' ? 50 : 10, idleTimeoutMs: 10000 },
          credentials: { user: `app_${env}`, database: `app_${env}` },
        },
        replica: {
          host: `db-replica.${env}.internal`,
          port: 5432,
          pool: { min: 1, max: env === 'production' ? 20 : 5 },
        },
      };
    case 'cache':
      return {
        ...base,
        redis: {
          cluster: {
            nodes: Array.from({ length: 3 }, (_, i) => `cache-${i + 1}.${env}:6379`),
            options: { maxRedirections: 16, retryDelayMs: 100 },
          },
          ttl: { default: 3600, session: 86400 },
        },
      };
    case 'logging':
      return {
        ...base,
        level: env === 'production' ? 'info' : 'debug',
        outputs: ['stdout', 'file', 'datadog'],
        file: { path: `/var/log/app/${env}.log`, maxSize: '100MB', maxFiles: 10 },
        sampling: { rate: env === 'production' ? 0.1 : 1.0 },
      };
    case 'security':
      return {
        ...base,
        jwt: { issuer: `app-${env}`, expiresIn: '1h', algorithm: 'RS256' },
        cors: { origins: [`https://${env}.example.com`], maxAge: 86400 },
        rateLimit: { windowMs: 60000, max: env === 'production' ? 100 : 1000 },
      };
    case 'messaging':
      return {
        ...base,
        queue: {
          provider: 'rabbitmq',
          host: `mq.${env}.internal`,
          exchanges: ['events', 'commands', 'notifications'],
          prefetch: env === 'production' ? 10 : 1,
        },
      };
    default:
      return {
        ...base,
        settings: Object.fromEntries(
          Array.from({ length: rng.int(5, 15) }, () => [rng.identifier(8), rng.identifier(12)])
        ),
      };
  }
}
