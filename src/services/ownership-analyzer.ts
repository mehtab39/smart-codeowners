import { Config, FileCommitStats, ContributorStats, OwnershipResult } from '../types';

export class OwnershipAnalyzer {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  analyze(fileStats: Map<string, FileCommitStats>): OwnershipResult[] {
    const results: OwnershipResult[] = [];

    for (const [file, stats] of fileStats) {
      const ownership = this.determineOwnership(stats);
      results.push(ownership);
    }

    return results;
  }

  private determineOwnership(fileStats: FileCommitStats): OwnershipResult {
    const { file, commits } = fileStats;

    // Calculate contributor stats with recency weighting
    const contributorMap = new Map<string, ContributorStats>();

    for (const commit of commits) {
      const key = commit.author;

      if (!contributorMap.has(key)) {
        contributorMap.set(key, {
          author: commit.author,
          email: commit.email,
          commitCount: 0,
          weightedScore: 0,
          percentage: 0,
          lastCommitDate: commit.date
        });
      }

      const stats = contributorMap.get(key)!;
      stats.commitCount++;

      // Calculate weighted score based on recency
      const weight = this.calculateRecencyWeight(commit.date);
      stats.weightedScore += weight;

      // Update last commit date
      if (commit.date > stats.lastCommitDate) {
        stats.lastCommitDate = commit.date;
      }
    }

    // Calculate total weighted score
    const totalWeightedScore = Array.from(contributorMap.values())
      .reduce((sum, stats) => sum + stats.weightedScore, 0);

    // Calculate percentages
    for (const stats of contributorMap.values()) {
      stats.percentage = (stats.weightedScore / totalWeightedScore) * 100;
    }

    // Filter contributors by minimum commits
    const minCommits = this.config.minCommits || 3;
    const qualifiedContributors = Array.from(contributorMap.values())
      .filter(stats => stats.commitCount >= minCommits)
      .sort((a, b) => b.weightedScore - a.weightedScore);

    // Determine ownership type and owners
    const majorityThreshold = this.config.majorityThreshold || 50;
    const topContributorsCount = this.config.topContributorsCount || 2;

    let owners: string[] = [];
    let ownershipType: 'clear-majority' | 'top-contributors' | 'default';

    if (qualifiedContributors.length === 0) {
      // No qualified contributors, use default
      ownershipType = 'default';
      if (this.config.defaultOwner) {
        owners = [this.config.defaultOwner];
      }
    } else if (qualifiedContributors[0].percentage >= majorityThreshold) {
      // Clear majority owner
      ownershipType = 'clear-majority';
      owners = [this.formatOwner(qualifiedContributors[0])];
    } else {
      // Multiple top contributors
      ownershipType = 'top-contributors';
      owners = qualifiedContributors
        .slice(0, topContributorsCount)
        .map(stats => this.formatOwner(stats));
    }

    return {
      file,
      owners,
      ownershipType,
      stats: qualifiedContributors
    };
  }

  private calculateRecencyWeight(commitDate: Date): number {
    if (!this.config.recencyWeighting) {
      return 1.0; // All commits weighted equally
    }

    const now = new Date();
    const daysSinceCommit = (now.getTime() - commitDate.getTime()) / (1000 * 60 * 60 * 24);
    const halfLife = this.config.recencyHalfLife || 180;

    // Exponential decay: weight = 2^(-days / halfLife)
    // Recent commits have higher weight, old commits decay exponentially
    const weight = Math.pow(2, -daysSinceCommit / halfLife);

    return weight;
  }

  private formatOwner(stats: ContributorStats): string {
    // Try to extract GitHub username from email
    const email = stats.email.toLowerCase();

    // Common patterns for GitHub emails
    if (email.endsWith('@users.noreply.github.com')) {
      // Format: username@users.noreply.github.com or 12345+username@users.noreply.github.com
      const match = email.match(/(?:\d+\+)?(.+)@users\.noreply\.github\.com/);
      if (match) {
        return `@${match[1]}`;
      }
    }

    // Check email mappings (check both author name and email)
    if (this.config.emailMappings) {
      const authorLower = stats.author.toLowerCase();
      for (const [pattern, username] of Object.entries(this.config.emailMappings)) {
        const patternLower = pattern.toLowerCase();
        if (email.includes(patternLower) || authorLower.includes(patternLower)) {
          return username.startsWith('@') ? username : `@${username}`;
        }
      }
    }

    // Fallback: use author name with @ prefix (not ideal for CODEOWNERS)
    // Users should configure email mappings for proper GitHub usernames
    // Check if author already has @ prefix (from normalization)
    if (stats.author.startsWith('@')) {
      return stats.author;
    }
    const author = stats.author.replace(/\s+/g, '-').toLowerCase();
    return `@${author}`;
  }

  groupByFolder(results: OwnershipResult[]): Map<string, OwnershipResult[]> {
    const folderMap = new Map<string, OwnershipResult[]>();

    for (const result of results) {
      const folder = this.getFolder(result.file);

      if (!folderMap.has(folder)) {
        folderMap.set(folder, []);
      }

      folderMap.get(folder)!.push(result);
    }

    return folderMap;
  }

  private getFolder(filePath: string): string {
    const parts = filePath.split('/');
    if (parts.length === 1) {
      return '.'; // Root directory
    }
    parts.pop(); // Remove filename
    return parts.join('/');
  }

  canConsolidateFolder(files: OwnershipResult[]): boolean {
    if (files.length === 0) {
      return false;
    }

    // Check if all files have the same owners
    const firstOwners = files[0].owners.sort().join(',');

    for (let i = 1; i < files.length; i++) {
      const currentOwners = files[i].owners.sort().join(',');
      if (currentOwners !== firstOwners) {
        return false;
      }
    }

    return true;
  }
}
