#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigLoader } from '../utils/config-loader';
import { GitAnalyzer } from '../services/git-analyzer';
import { OwnershipAnalyzer } from '../services/ownership-analyzer';
import { CodeOwnersGenerator } from '../services/codeowners-generator';
import { Config } from '../types';

const program = new Command();

program
  .name('smart-codeowners')
  .description('Smart CODEOWNERS generator based on git commit history with recency weighting')
  .version('0.1.0');

program
  .command('generate')
  .description('Generate CODEOWNERS file based on git history')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-o, --output <path>', 'Output path for CODEOWNERS file')
  .option('-r, --repo <path>', 'Path to git repository')
  .option('-b, --branch <name>', 'Branch to analyze')
  .option('-t, --threshold <number>', 'Majority threshold percentage', parseFloat)
  .option('--no-recency', 'Disable recency weighting')
  .option('--file-level', 'Prefer file-level ownership over folder-level')
  .option('-v, --verbose', 'Enable verbose output')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🔍 Analyzing git history...\n'));

      // Load configuration
      const config = ConfigLoader.load(options.config);

      // Override with CLI options
      if (options.repo) config.repoPath = options.repo;
      if (options.output) config.outputPath = options.output;
      if (options.branch) config.branch = options.branch;
      if (options.threshold) config.majorityThreshold = options.threshold;
      if (options.recency === false) config.recencyWeighting = false;
      if (options.fileLevel) config.preferFolderLevel = false;

      // Validate configuration
      ConfigLoader.validate(config);

      // Load email mappings from all sources
      const emailMappings = await ConfigLoader.loadEmailMappings(config);
      if (Object.keys(emailMappings).length > 0 && options.verbose) {
        console.log(chalk.cyan(`✓ Loaded ${Object.keys(emailMappings).length} email mappings\n`));
      }

      // Display configuration
      if (options.verbose) {
        displayConfig(config);
      }

      // Analyze git history
      const gitAnalyzer = new GitAnalyzer(config, emailMappings);
      const fileStats = await gitAnalyzer.analyze();

      console.log(chalk.green(`✓ Analyzed ${fileStats.size} files\n`));

      // Analyze ownership
      const ownershipAnalyzer = new OwnershipAnalyzer(config, emailMappings);
      const ownershipResults = ownershipAnalyzer.analyze(fileStats);

      // Display statistics
      displayStatistics(ownershipResults, options.verbose);

      // Generate CODEOWNERS file
      const generator = new CodeOwnersGenerator(config);
      await generator.generateAndWrite(ownershipResults, options.output);

      console.log(chalk.green('\n✓ CODEOWNERS file generated successfully!'));
    } catch (error) {
      console.error(chalk.red('\n✗ Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('analyze')
  .description('Analyze git history and display ownership statistics without generating file')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-r, --repo <path>', 'Path to git repository')
  .option('-b, --branch <name>', 'Branch to analyze')
  .option('-f, --file <path>', 'Analyze specific file')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    try {
      // Load configuration
      const config = ConfigLoader.load(options.config);

      // Override with CLI options
      if (options.repo) config.repoPath = options.repo;
      if (options.branch) config.branch = options.branch;

      // Load email mappings from all sources
      const emailMappings = await ConfigLoader.loadEmailMappings(config);

      // Analyze git history
      const gitAnalyzer = new GitAnalyzer(config, emailMappings);
      const fileStats = await gitAnalyzer.analyze();

      // Analyze ownership
      const ownershipAnalyzer = new OwnershipAnalyzer(config, emailMappings);
      let ownershipResults = ownershipAnalyzer.analyze(fileStats);

      // Filter by file if specified
      if (options.file) {
        ownershipResults = ownershipResults.filter(r => r.file === options.file);
      }

      if (options.json) {
        // JSON output
        console.log(JSON.stringify(ownershipResults, null, 2));
      } else {
        // Human-readable output
        displayDetailedAnalysis(ownershipResults);
      }
    } catch (error) {
      console.error(chalk.red('\n✗ Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize configuration file')
  .option('-o, --output <path>', 'Output path for config file', '.codeowners-config.json')
  .action((options) => {
    const fs = require('fs');
    const defaultConfig = {
      repoPath: '.',
      outputPath: '.github/CODEOWNERS',
      majorityThreshold: 50,
      topContributorsCount: 2,
      recencyWeighting: true,
      recencyHalfLife: 180,
      excludeMergeCommits: true,
      excludeBotCommits: true,
      bulkChangeThreshold: 50,
      branch: 'main',
      preferFolderLevel: true,
      minCommits: 3,
      excludePatterns: [
        'package-lock.json',
        'yarn.lock',
        'pnpm-lock.yaml',
        '*.log',
        'dist/**',
        'build/**'
      ],
      emailMappings: {
        'example@company.com': '@github-username'
      }
    };

    fs.writeFileSync(options.output, JSON.stringify(defaultConfig, null, 2));
    console.log(chalk.green(`✓ Configuration file created: ${options.output}`));
    console.log(chalk.yellow('\nPlease review and update the configuration, especially:'));
    console.log('  - emailMappings: Map email addresses to GitHub usernames');
    console.log('  - excludePatterns: Add patterns for files to exclude');
    console.log('  - majorityThreshold: Adjust ownership threshold');
  });

function displayConfig(config: Config): void {
  console.log(chalk.cyan('Configuration:'));
  console.log(`  Repository: ${config.repoPath}`);
  console.log(`  Branch: ${config.branch}`);
  console.log(`  Output: ${config.outputPath}`);
  console.log(`  Majority threshold: ${config.majorityThreshold}%`);
  console.log(`  Recency weighting: ${config.recencyWeighting ? 'enabled' : 'disabled'}`);
  if (config.recencyWeighting) {
    console.log(`  Recency half-life: ${config.recencyHalfLife} days`);
  }
  console.log(`  Folder-level grouping: ${config.preferFolderLevel ? 'enabled' : 'disabled'}`);
  console.log(`  Minimum commits: ${config.minCommits}`);
  console.log('');
}

function displayStatistics(results: any[], verbose: boolean): void {
  const clearMajority = results.filter(r => r.ownershipType === 'clear-majority').length;
  const topContributors = results.filter(r => r.ownershipType === 'top-contributors').length;
  const defaultOwner = results.filter(r => r.ownershipType === 'default').length;
  const noOwner = results.filter(r => r.owners.length === 0).length;

  console.log(chalk.cyan('Ownership Statistics:'));
  console.log(`  Clear majority: ${clearMajority} files`);
  console.log(`  Multiple contributors: ${topContributors} files`);
  console.log(`  Default owner: ${defaultOwner} files`);
  console.log(`  No owner: ${noOwner} files`);

  if (verbose) {
    console.log('\n' + chalk.cyan('Top Files by Contributors:'));
    const topFiles = results
      .filter(r => r.stats && r.stats.length > 0)
      .sort((a, b) => b.stats.length - a.stats.length)
      .slice(0, 10);

    for (const file of topFiles) {
      console.log(`  ${file.file}: ${file.stats.length} contributors`);
    }
  }
}

function displayDetailedAnalysis(results: any[]): void {
  for (const result of results) {
    console.log(chalk.cyan(`\n${result.file}`));
    console.log(chalk.yellow(`Ownership: ${result.ownershipType}`));
    console.log(chalk.green(`Owners: ${result.owners.join(', ') || 'None'}`));

    if (result.stats && result.stats.length > 0) {
      console.log('\nContributors:');
      for (const stat of result.stats) {
        console.log(
          `  ${stat.author}: ${stat.commitCount} commits, ` +
          `${stat.percentage.toFixed(1)}% ownership, ` +
          `last commit: ${stat.lastCommitDate.toLocaleDateString()}`
        );
      }
    }
  }
}

program.parse();
