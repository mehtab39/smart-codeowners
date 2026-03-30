import simpleGit, { SimpleGit, DefaultLogFields } from 'simple-git';
import { Config, CommitInfo, FileCommitStats } from '../types';
import { resolve } from 'path';

export class GitAnalyzer {
  private git: SimpleGit;
  private config: Config;
  private emailMappings: Record<string, string> = {};

  constructor(config: Config, emailMappings?: Record<string, string>) {
    this.config = config;
    this.emailMappings = emailMappings || config.emailMappings || {};
    const repoPath = resolve(config.repoPath || process.cwd());
    this.git = simpleGit(repoPath);
  }

  async analyze(): Promise<Map<string, FileCommitStats>> {
    const commits = await this.getCommits();
    const fileStats = new Map<string, FileCommitStats>();

    for (const commit of commits) {
      if (this.shouldExcludeCommit(commit)) {
        continue;
      }

      for (const file of commit.filesChanged) {
        if (this.shouldExcludeFile(file)) {
          continue;
        }

        if (!fileStats.has(file)) {
          fileStats.set(file, {
            file,
            commits: [],
            contributors: new Map()
          });
        }

        const stats = fileStats.get(file)!;
        stats.commits.push(commit);
      }
    }

    return fileStats;
  }

  private async getCommits(): Promise<CommitInfo[]> {
    const branch = this.config.branch || 'main';
    const commits: CommitInfo[] = [];

    // Check if branch exists, fallback to master if main doesn't exist
    let targetBranch = branch;
    try {
      await this.git.revparse([targetBranch]);
    } catch {
      targetBranch = 'master';
      try {
        await this.git.revparse([targetBranch]);
      } catch {
        // Get current branch if neither main nor master exists
        const branches = await this.git.branch();
        targetBranch = branches.current;
      }
    }

    const logOptions: string[] = [
      targetBranch,
      '--name-only',
      '--no-merges'
    ];

    if (this.config.maxCommitAge && this.config.maxCommitAge > 0) {
      logOptions.push(`--since="${this.config.maxCommitAge} days ago"`);
    }

    const log = await this.git.log(logOptions);

    for (const entry of log.all) {
      // Get file changes for this commit
      let filesChanged: string[] = [];

      try {
        const diffSummary = await this.git.diffSummary([`${entry.hash}^`, entry.hash]);
        filesChanged = diffSummary.files.map(f => f.file);
      } catch (error) {
        // Handle root commit (no parent) - get all files in the commit
        try {
          const showResult = await this.git.show([entry.hash, '--name-only', '--format=']);
          filesChanged = showResult.split('\n').filter(f => f.trim().length > 0);
        } catch (showError) {
          // Skip this commit if we can't get files
          continue;
        }
      }

      const commitInfo: CommitInfo = {
        hash: entry.hash,
        author: this.normalizeAuthor(entry.author_name),
        email: entry.author_email,
        date: new Date(entry.date),
        message: entry.message,
        filesChanged,
        isMerge: entry.message.toLowerCase().startsWith('merge')
      };

      commits.push(commitInfo);
    }

    return commits;
  }

  private shouldExcludeCommit(commit: CommitInfo): boolean {
    // Exclude merge commits
    if (this.config.excludeMergeCommits && commit.isMerge) {
      return true;
    }

    // Exclude bot commits
    if (this.config.excludeBotCommits && this.isBotCommit(commit)) {
      return true;
    }

    // Exclude bulk changes
    if (
      this.config.bulkChangeThreshold &&
      commit.filesChanged.length > this.config.bulkChangeThreshold
    ) {
      return true;
    }

    return false;
  }

  private isBotCommit(commit: CommitInfo): boolean {
    const botPatterns = this.config.botPatterns || [];
    const checkString = `${commit.author} ${commit.email}`.toLowerCase();

    return botPatterns.some(pattern => {
      const regex = new RegExp(pattern, 'i');
      return regex.test(checkString);
    });
  }

  private shouldExcludeFile(file: string): boolean {
    // Check exclude patterns
    if (this.config.excludePatterns) {
      for (const pattern of this.config.excludePatterns) {
        if (this.matchPattern(file, pattern)) {
          return true;
        }
      }
    }

    // Check include patterns (if specified, file must match at least one)
    if (this.config.includePatterns && this.config.includePatterns.length > 0) {
      let matched = false;
      for (const pattern of this.config.includePatterns) {
        if (this.matchPattern(file, pattern)) {
          matched = true;
          break;
        }
      }
      if (!matched) {
        return true;
      }
    }

    return false;
  }

  private matchPattern(file: string, pattern: string): boolean {
    // Simple glob pattern matching
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(file);
  }

  private normalizeAuthor(author: string): string {
    // Check if we have email mappings
    if (this.emailMappings && Object.keys(this.emailMappings).length > 0) {
      for (const [email, username] of Object.entries(this.emailMappings)) {
        if (author.toLowerCase().includes(email.toLowerCase())) {
          // Remove @ prefix if present, formatOwner will add it later
          return username.startsWith('@') ? username.substring(1) : username;
        }
      }
    }

    return author;
  }

  async getCurrentBranch(): Promise<string> {
    const branch = await this.git.branch();
    return branch.current;
  }
}
