import { ConfigLoader } from './config-loader';

describe('ConfigLoader', () => {
  describe('validate', () => {
    it('should accept valid configuration', () => {
      const config = {
        majorityThreshold: 50,
        topContributorsCount: 2,
        recencyHalfLife: 180,
        bulkChangeThreshold: 50,
        minCommits: 3
      };

      expect(() => ConfigLoader.validate(config)).not.toThrow();
    });

    it('should reject invalid majorityThreshold', () => {
      const config = { majorityThreshold: 150 };
      expect(() => ConfigLoader.validate(config)).toThrow('majorityThreshold must be between 0 and 100');
    });

    it('should reject invalid topContributorsCount', () => {
      const config = { topContributorsCount: 0 };
      expect(() => ConfigLoader.validate(config)).toThrow('topContributorsCount must be at least 1');
    });

    it('should reject invalid recencyHalfLife', () => {
      const config = { recencyHalfLife: 0 };
      expect(() => ConfigLoader.validate(config)).toThrow('recencyHalfLife must be at least 1 day');
    });

    it('should reject invalid bulkChangeThreshold', () => {
      const config = { bulkChangeThreshold: 0 };
      expect(() => ConfigLoader.validate(config)).toThrow('bulkChangeThreshold must be at least 1');
    });

    it('should reject invalid minCommits', () => {
      const config = { minCommits: 0 };
      expect(() => ConfigLoader.validate(config)).toThrow('minCommits must be at least 1');
    });
  });
});
