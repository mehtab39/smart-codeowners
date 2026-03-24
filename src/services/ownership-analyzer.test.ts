import { OwnershipAnalyzer } from './ownership-analyzer';
import { Config, FileCommitStats, CommitInfo } from '../types';

describe('OwnershipAnalyzer', () => {
  const mockConfig: Config = {
    majorityThreshold: 50,
    topContributorsCount: 2,
    recencyWeighting: false,
    minCommits: 1
  };

  const createMockCommit = (author: string, email: string, date: Date): CommitInfo => ({
    hash: 'abc123',
    author,
    email,
    date,
    message: 'test commit',
    filesChanged: ['test.ts'],
    isMerge: false
  });

  describe('analyze', () => {
    it('should determine clear majority owner', () => {
      const analyzer = new OwnershipAnalyzer(mockConfig);

      const fileStats = new Map<string, FileCommitStats>([
        ['test.ts', {
          file: 'test.ts',
          commits: [
            createMockCommit('Alice', 'alice@example.com', new Date()),
            createMockCommit('Alice', 'alice@example.com', new Date()),
            createMockCommit('Alice', 'alice@example.com', new Date()),
            createMockCommit('Bob', 'bob@example.com', new Date())
          ],
          contributors: new Map()
        }]
      ]);

      const results = analyzer.analyze(fileStats);

      expect(results).toHaveLength(1);
      expect(results[0].ownershipType).toBe('clear-majority');
      expect(results[0].owners).toHaveLength(1);
    });

    it('should list top contributors when no clear majority', () => {
      const config: Config = { ...mockConfig, majorityThreshold: 60 };
      const analyzer = new OwnershipAnalyzer(config);

      const fileStats = new Map<string, FileCommitStats>([
        ['test.ts', {
          file: 'test.ts',
          commits: [
            createMockCommit('Alice', 'alice@example.com', new Date()),
            createMockCommit('Alice', 'alice@example.com', new Date()),
            createMockCommit('Bob', 'bob@example.com', new Date()),
            createMockCommit('Bob', 'bob@example.com', new Date())
          ],
          contributors: new Map()
        }]
      ]);

      const results = analyzer.analyze(fileStats);

      expect(results).toHaveLength(1);
      expect(results[0].ownershipType).toBe('top-contributors');
      expect(results[0].owners.length).toBeGreaterThan(1);
    });

    it('should filter by minimum commits', () => {
      const config: Config = { ...mockConfig, minCommits: 3 };
      const analyzer = new OwnershipAnalyzer(config);

      const fileStats = new Map<string, FileCommitStats>([
        ['test.ts', {
          file: 'test.ts',
          commits: [
            createMockCommit('Alice', 'alice@example.com', new Date()),
            createMockCommit('Alice', 'alice@example.com', new Date()),
            createMockCommit('Alice', 'alice@example.com', new Date()),
            createMockCommit('Bob', 'bob@example.com', new Date()) // Only 1 commit
          ],
          contributors: new Map()
        }]
      ]);

      const results = analyzer.analyze(fileStats);

      expect(results).toHaveLength(1);
      expect(results[0].stats.length).toBe(1); // Only Alice qualifies
    });
  });

  describe('groupByFolder', () => {
    it('should group files by folder', () => {
      const analyzer = new OwnershipAnalyzer(mockConfig);

      const results = [
        {
          file: 'src/utils/test.ts',
          owners: ['@alice'],
          ownershipType: 'clear-majority' as const,
          stats: []
        },
        {
          file: 'src/utils/helper.ts',
          owners: ['@alice'],
          ownershipType: 'clear-majority' as const,
          stats: []
        },
        {
          file: 'src/services/api.ts',
          owners: ['@bob'],
          ownershipType: 'clear-majority' as const,
          stats: []
        }
      ];

      const grouped = analyzer.groupByFolder(results);

      expect(grouped.size).toBe(2);
      expect(grouped.get('src/utils')).toHaveLength(2);
      expect(grouped.get('src/services')).toHaveLength(1);
    });
  });

  describe('canConsolidateFolder', () => {
    it('should return true when all files have same owners', () => {
      const analyzer = new OwnershipAnalyzer(mockConfig);

      const files = [
        {
          file: 'test1.ts',
          owners: ['@alice', '@bob'],
          ownershipType: 'top-contributors' as const,
          stats: []
        },
        {
          file: 'test2.ts',
          owners: ['@alice', '@bob'],
          ownershipType: 'top-contributors' as const,
          stats: []
        }
      ];

      expect(analyzer.canConsolidateFolder(files)).toBe(true);
    });

    it('should return false when files have different owners', () => {
      const analyzer = new OwnershipAnalyzer(mockConfig);

      const files = [
        {
          file: 'test1.ts',
          owners: ['@alice'],
          ownershipType: 'clear-majority' as const,
          stats: []
        },
        {
          file: 'test2.ts',
          owners: ['@bob'],
          ownershipType: 'clear-majority' as const,
          stats: []
        }
      ];

      expect(analyzer.canConsolidateFolder(files)).toBe(false);
    });
  });
});
