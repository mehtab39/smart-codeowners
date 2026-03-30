export interface Config {
  /** Path to the repository (default: current directory) */
  repoPath?: string;

  /** Output path for CODEOWNERS file (default: .github/CODEOWNERS) */
  outputPath?: string;

  /** Threshold percentage for clear majority (default: 50) */
  majorityThreshold?: number;

  /** Number of top contributors to list when no clear majority (default: 2) */
  topContributorsCount?: number;

  /** Enable recency weighting (default: true) */
  recencyWeighting?: boolean;

  /** Half-life in days for recency weighting (default: 180) */
  recencyHalfLife?: number;

  /** Exclude merge commits (default: true) */
  excludeMergeCommits?: boolean;

  /** Exclude bot commits (default: true) */
  excludeBotCommits?: boolean;

  /** Maximum files changed threshold for bulk commits (default: 50) */
  bulkChangeThreshold?: number;

  /** Patterns to exclude from analysis */
  excludePatterns?: string[];

  /** Patterns to include in analysis */
  includePatterns?: string[];

  /** Default team/owner for fallback */
  defaultOwner?: string;

  /** Branch to analyze (default: main/master) */
  branch?: string;

  /** Maximum age of commits in days (0 = all history) */
  maxCommitAge?: number;

  /** Prefer folder-level ownership when possible (default: true) */
  preferFolderLevel?: boolean;

  /** Minimum commits required to be considered an owner (default: 3) */
  minCommits?: number;

  /** Email domain to username mappings */
  emailMappings?: Record<string, string>;

  /** Path to external email mappings file (JSON key-value) */
  emailMappingsFile?: string;

  /** Curl command to fetch email mappings from API */
  emailMappingsCurl?: string;

  /** Path to valid GitHub users file (JSON with users array) */
  validUsersFile?: string;

  /** Curl command to fetch valid GitHub users list from API */
  validUsersCurl?: string;

  /** Maximum number of owners per file/folder (default: 1) */
  maxOwnersPerFile?: number;

  /** Repository owner - gets assigned to wildcard (*) rule at bottom of CODEOWNERS */
  repositoryOwner?: string;

  /** Bot author patterns (regex) */
  botPatterns?: string[];
}

export interface CommitInfo {
  hash: string;
  author: string;
  email: string;
  date: Date;
  message: string;
  filesChanged: string[];
  isMerge: boolean;
}

export interface FileCommitStats {
  file: string;
  commits: CommitInfo[];
  contributors: Map<string, ContributorStats>;
}

export interface ContributorStats {
  author: string;
  email: string;
  commitCount: number;
  weightedScore: number;
  percentage: number;
  lastCommitDate: Date;
}

export interface OwnershipResult {
  file: string;
  owners: string[];
  ownershipType: 'clear-majority' | 'top-contributors' | 'default';
  stats: ContributorStats[];
}

export interface FolderOwnership {
  path: string;
  owners: string[];
  files: string[];
  consistency: number; // 0-1, how consistent ownership is across files
}

export interface CodeOwnersEntry {
  pattern: string;
  owners: string[];
  comment?: string;
}
