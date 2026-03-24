# smart-codeowners

Smart CODEOWNERS generator based on git commit history with recency weighting. Automatically assign code owners based on actual contribution patterns instead of manual assignment.

## Features

- **Intelligent Ownership Detection**: Automatically determines code owners based on git commit history
- **Recency Weighting**: Recent commits are weighted more heavily using exponential decay (configurable half-life)
- **Majority Detection**: Identifies clear majority owners vs. multiple top contributors
- **Folder-Level Consolidation**: Automatically groups files with consistent ownership at folder level
- **Smart Filtering**: Excludes merge commits, bot commits, and bulk changes
- **Configurable Thresholds**: Customize majority thresholds, minimum commits, and more
- **GitHub Format**: Generates standard GitHub CODEOWNERS file format
- **CLI & Programmatic API**: Use as CLI tool or integrate into your build process

## Installation

```bash
npm install -g smart-codeowners
```

Or use with npx:

```bash
npx smart-codeowners generate
```

## Quick Start

1. **Initialize configuration** (optional):
   ```bash
   smart-codeowners init
   ```

2. **Generate CODEOWNERS file**:
   ```bash
   smart-codeowners generate
   ```

3. **Analyze ownership** without generating file:
   ```bash
   smart-codeowners analyze
   ```

## Usage

### Generate CODEOWNERS

Generate a CODEOWNERS file based on your git history:

```bash
smart-codeowners generate
```

**Options:**
- `-c, --config <path>` - Path to configuration file
- `-o, --output <path>` - Output path for CODEOWNERS file (default: .github/CODEOWNERS)
- `-r, --repo <path>` - Path to git repository (default: current directory)
- `-b, --branch <name>` - Branch to analyze (default: main)
- `-t, --threshold <number>` - Majority threshold percentage (default: 50)
- `--no-recency` - Disable recency weighting
- `--file-level` - Prefer file-level ownership over folder-level
- `-v, --verbose` - Enable verbose output

**Examples:**

```bash
# Generate with custom threshold
smart-codeowners generate -t 60

# Generate for specific branch
smart-codeowners generate -b develop

# Generate with custom output path
smart-codeowners generate -o CODEOWNERS

# Disable recency weighting
smart-codeowners generate --no-recency

# Use custom config file
smart-codeowners generate -c my-config.json
```

### Analyze Ownership

Analyze git history and display ownership statistics:

```bash
smart-codeowners analyze
```

**Options:**
- `-c, --config <path>` - Path to configuration file
- `-r, --repo <path>` - Path to git repository
- `-b, --branch <name>` - Branch to analyze
- `-f, --file <path>` - Analyze specific file
- `--json` - Output in JSON format

**Examples:**

```bash
# Analyze entire repository
smart-codeowners analyze

# Analyze specific file
smart-codeowners analyze -f src/index.ts

# Output as JSON
smart-codeowners analyze --json
```

### Initialize Configuration

Create a configuration file with default settings:

```bash
smart-codeowners init
```

**Options:**
- `-o, --output <path>` - Output path for config file (default: .codeowners-config.json)

## Configuration

Create a `.codeowners-config.json` file in your repository root:

```json
{
  "repoPath": ".",
  "outputPath": ".github/CODEOWNERS",
  "majorityThreshold": 50,
  "topContributorsCount": 2,
  "recencyWeighting": true,
  "recencyHalfLife": 180,
  "excludeMergeCommits": true,
  "excludeBotCommits": true,
  "bulkChangeThreshold": 50,
  "branch": "main",
  "maxCommitAge": 0,
  "preferFolderLevel": true,
  "minCommits": 3,
  "excludePatterns": [
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "*.log",
    "dist/**",
    "build/**",
    "node_modules/**"
  ],
  "includePatterns": [],
  "emailMappings": {
    "alice@company.com": "@alice-github",
    "bob@company.com": "@bob-github"
  },
  "defaultOwner": "@default-team",
  "botPatterns": [
    "bot",
    "dependabot",
    "renovate",
    "github-actions"
  ]
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `repoPath` | string | `"."` | Path to git repository |
| `outputPath` | string | `".github/CODEOWNERS"` | Output path for CODEOWNERS file |
| `majorityThreshold` | number | `50` | Percentage of commits needed for clear majority (0-100) |
| `topContributorsCount` | number | `2` | Number of top contributors to list when no clear majority |
| `recencyWeighting` | boolean | `true` | Enable recency weighting for commits |
| `recencyHalfLife` | number | `180` | Half-life in days for recency weighting (6 months default) |
| `excludeMergeCommits` | boolean | `true` | Exclude merge commits from analysis |
| `excludeBotCommits` | boolean | `true` | Exclude commits from bots |
| `bulkChangeThreshold` | number | `50` | Exclude commits that change more than N files |
| `branch` | string | `"main"` | Branch to analyze |
| `maxCommitAge` | number | `0` | Only consider commits from last N days (0 = all history) |
| `preferFolderLevel` | boolean | `true` | Consolidate ownership at folder level when consistent |
| `minCommits` | number | `3` | Minimum commits required to be considered an owner |
| `excludePatterns` | string[] | `[]` | File patterns to exclude from analysis |
| `includePatterns` | string[] | `[]` | File patterns to include (empty = all files) |
| `emailMappings` | object | `{}` | Map email addresses to GitHub usernames |
| `defaultOwner` | string | `undefined` | Default owner/team for files without clear ownership |
| `botPatterns` | string[] | `["bot", "dependabot", ...]` | Regex patterns to identify bot commits |

## How It Works

### 1. Git History Analysis

The tool analyzes your git repository's commit history to understand who has contributed to each file:

- Retrieves all commits from the specified branch
- Identifies file changes in each commit
- Filters out merge commits, bot commits, and bulk changes

### 2. Recency Weighting

Recent contributions are weighted more heavily using exponential decay:

```
weight = 2^(-days_since_commit / half_life)
```

For example, with a 180-day half-life:
- Commits from today: 100% weight
- Commits from 180 days ago: 50% weight
- Commits from 360 days ago: 25% weight
- Commits from 540 days ago: 12.5% weight

This ensures that current maintainers are recognized over historical contributors who may have moved on.

### 3. Ownership Determination

For each file, the tool calculates each contributor's ownership percentage:

1. **Clear Majority**: If one contributor has ≥ threshold% of weighted commits, they are the sole owner
2. **Top Contributors**: If no clear majority, list the top N contributors
3. **Default Owner**: If no contributors meet the minimum commit threshold, use default owner

### 4. Folder-Level Consolidation

When `preferFolderLevel` is enabled:

- Groups files by folder
- Checks if all files in a folder have identical ownership
- Creates folder-level rules (`folder/**`) instead of individual file rules
- Reduces CODEOWNERS file size and improves maintainability

### 5. CODEOWNERS Generation

Generates a GitHub-compatible CODEOWNERS file with:

- Header with generation timestamp
- Default owner rule (if configured)
- Organized by folder with comments
- Ownership percentages and commit counts as inline comments

## Example Output

```
# CODEOWNERS
# Auto-generated by smart-codeowners
# Generated on: 2024-01-15T10:30:00.000Z
#
# This file defines code ownership for this repository.

# Default owner for everything
* @default-team

# src/
src/utils/**                    @alice @bob                # Folder-level ownership (5 files)
src/services/api.ts             @charlie                   # 75.3% (12 commits)
src/services/database.ts        @alice                     # 82.1% (18 commits)

# tests/
tests/**                        @bob                       # Folder-level ownership (8 files)

# docs/
docs/README.md                  @alice @charlie            # Top 2 contributors
```

## Best Practices

### 1. Email Mappings

Configure `emailMappings` to map company emails to GitHub usernames:

```json
{
  "emailMappings": {
    "alice.smith@company.com": "@alice",
    "bob.jones@company.com": "@bob-jones",
    "engineering@company.com": "@engineering-team"
  }
}
```

### 2. Exclude Patterns

Exclude generated files and dependencies:

```json
{
  "excludePatterns": [
    "package-lock.json",
    "yarn.lock",
    "dist/**",
    "build/**",
    "coverage/**",
    "*.generated.*"
  ]
}
```

### 3. Adjust Recency Half-Life

Choose half-life based on your team's dynamics:

- **Fast-moving teams**: 90-120 days
- **Stable teams**: 180-270 days
- **Long-term projects**: 365+ days

### 4. Set Appropriate Thresholds

- **High threshold (60-70%)**: Ensures only dominant contributors are owners
- **Medium threshold (50%)**: Balanced approach
- **Low threshold (40%)**: More inclusive, recognizes shared ownership

### 5. Regular Updates

Run the tool periodically (e.g., monthly) to keep CODEOWNERS up-to-date:

```bash
# Add to CI/CD or use a cron job
smart-codeowners generate && git diff .github/CODEOWNERS
```

## Programmatic Usage

Use smart-codeowners as a library:

```typescript
import {
  ConfigLoader,
  GitAnalyzer,
  OwnershipAnalyzer,
  CodeOwnersGenerator
} from 'smart-codeowners';

async function generateCodeOwners() {
  // Load configuration
  const config = ConfigLoader.load('.codeowners-config.json');

  // Analyze git history
  const gitAnalyzer = new GitAnalyzer(config);
  const fileStats = await gitAnalyzer.analyze();

  // Determine ownership
  const ownershipAnalyzer = new OwnershipAnalyzer(config);
  const ownershipResults = ownershipAnalyzer.analyze(fileStats);

  // Generate CODEOWNERS file
  const generator = new CodeOwnersGenerator(config);
  const content = generator.generate(ownershipResults);

  console.log(content);
}
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Author

Mehtab Singh Gill

## Links

- [GitHub Repository](https://github.com/mehtab39/smart-codeowners)
- [npm Package](https://www.npmjs.com/package/smart-codeowners)
- [GitHub CODEOWNERS Documentation](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
