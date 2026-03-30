import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { Config } from '../types';
import { EmailMappingLoader } from './email-mapping-loader';
import { UsernameValidator } from './username-validator';

const DEFAULT_CONFIG: Config = {
  repoPath: process.cwd(),
  outputPath: '.github/CODEOWNERS',
  majorityThreshold: 50,
  topContributorsCount: 2,
  recencyWeighting: true,
  recencyHalfLife: 180, // 6 months
  excludeMergeCommits: true,
  excludeBotCommits: true,
  bulkChangeThreshold: 50,
  excludePatterns: [
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    '*.log',
    'dist/**',
    'build/**',
    'node_modules/**'
  ],
  includePatterns: [],
  branch: 'main',
  maxCommitAge: 0, // 0 means all history
  preferFolderLevel: true,
  minCommits: 3,
  maxOwnersPerFile: 1, // Default to single owner
  botPatterns: [
    'bot',
    'Bot',
    'BOT',
    'dependabot',
    'renovate',
    'github-actions',
    'automation'
  ]
};

export class ConfigLoader {
  static load(configPath?: string): Config {
    let config: Partial<Config> = {};

    // Try to load from specified path or default locations
    const possiblePaths = configPath
      ? [configPath]
      : [
          '.codeowners-config.json',
          'codeowners.config.json',
          '.github/codeowners-config.json'
        ];

    for (const path of possiblePaths) {
      const fullPath = resolve(process.cwd(), path);
      if (existsSync(fullPath)) {
        try {
          const fileContent = readFileSync(fullPath, 'utf-8');
          config = JSON.parse(fileContent);
          console.log(`Loaded configuration from: ${path}`);
          break;
        } catch (error) {
          console.warn(`Failed to load config from ${path}:`, error);
        }
      }
    }

    // Merge with defaults
    return { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Load and merge email mappings from all configured sources
   */
  static async loadEmailMappings(config: Config): Promise<Record<string, string>> {
    const mappings = await EmailMappingLoader.loadMappings(
      config.emailMappings,
      config.emailMappingsFile,
      config.emailMappingsCurl
    );

    return EmailMappingLoader.normalizeMappings(mappings);
  }

  /**
   * Load valid GitHub users list from configured sources
   */
  static async loadValidUsers(config: Config): Promise<string[]> {
    return await UsernameValidator.loadValidUsers(
      config.validUsersFile,
      config.validUsersCurl
    );
  }

  static validate(config: Config): void {
    if (config.majorityThreshold && (config.majorityThreshold < 0 || config.majorityThreshold > 100)) {
      throw new Error('majorityThreshold must be between 0 and 100');
    }

    if (config.topContributorsCount && config.topContributorsCount < 1) {
      throw new Error('topContributorsCount must be at least 1');
    }

    if (config.recencyHalfLife && config.recencyHalfLife < 1) {
      throw new Error('recencyHalfLife must be at least 1 day');
    }

    if (config.bulkChangeThreshold && config.bulkChangeThreshold < 1) {
      throw new Error('bulkChangeThreshold must be at least 1');
    }

    if (config.minCommits && config.minCommits < 1) {
      throw new Error('minCommits must be at least 1');
    }
  }
}
