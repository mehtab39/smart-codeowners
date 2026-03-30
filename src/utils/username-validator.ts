import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

/**
 * GitHub username validation regex
 * Rules: 1-39 characters, alphanumeric or hyphens, cannot start/end with hyphen
 */
const GITHUB_USERNAME_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;

export class UsernameValidator {
  private validUsers: Set<string> | null = null;

  constructor(validUsers?: string[]) {
    if (validUsers && validUsers.length > 0) {
      this.validUsers = new Set(validUsers.map(u => u.toLowerCase()));
    }
  }

  /**
   * Load valid users from file or curl command
   */
  static async loadValidUsers(
    filePath?: string,
    curlCommand?: string
  ): Promise<string[]> {
    let users: string[] = [];

    // Load from file
    if (filePath) {
      try {
        users = this.loadFromFile(filePath);
        console.log(`Loaded ${users.length} valid users from file`);
      } catch (error) {
        console.warn(`Failed to load valid users from file ${filePath}:`, error);
      }
    }

    // Load from curl command
    if (curlCommand) {
      try {
        const curlUsers = this.loadFromCurl(curlCommand);
        // Merge with file users
        users = [...new Set([...users, ...curlUsers])];
        console.log(`Loaded ${curlUsers.length} valid users from curl command`);
      } catch (error) {
        console.warn(`Failed to load valid users from curl command:`, error);
      }
    }

    return users;
  }

  /**
   * Load valid users from a JSON file
   */
  private static loadFromFile(filePath: string): string[] {
    const fullPath = resolve(process.cwd(), filePath);

    if (!existsSync(fullPath)) {
      throw new Error(`Valid users file not found: ${filePath}`);
    }

    const content = readFileSync(fullPath, 'utf-8');
    const data = JSON.parse(content);

    // Support both array format and object with "users" key
    if (Array.isArray(data)) {
      return data;
    } else if (data.users && Array.isArray(data.users)) {
      return data.users;
    }

    throw new Error('Valid users file must contain an array or an object with "users" array');
  }

  /**
   * Load valid users from a curl command
   */
  private static loadFromCurl(curlCommand: string): string[] {
    try {
      const output = execSync(curlCommand, {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
        timeout: 30000
      });

      const data = JSON.parse(output);

      // Support both array format and object with "users" key
      if (Array.isArray(data)) {
        return data;
      } else if (data.users && Array.isArray(data.users)) {
        return data.users;
      }

      throw new Error('Curl response must be an array or an object with "users" array');
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to execute curl command: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Validate if a username is a valid GitHub username format
   */
  isValidFormat(username: string): boolean {
    // Remove @ prefix if present
    const cleanUsername = username.startsWith('@') ? username.substring(1) : username;

    // Check against GitHub username regex
    return GITHUB_USERNAME_REGEX.test(cleanUsername);
  }

  /**
   * Check if a username is in the valid users list
   */
  isValidUser(username: string): boolean {
    // If no valid users list configured, accept all usernames with valid format
    if (this.validUsers === null) {
      return this.isValidFormat(username);
    }

    // Remove @ prefix if present
    const cleanUsername = username.startsWith('@') ? username.substring(1) : username;

    // Check both format and presence in valid users list
    return this.isValidFormat(cleanUsername) && this.validUsers.has(cleanUsername.toLowerCase());
  }

  /**
   * Validate and filter a list of usernames
   * Returns only valid usernames
   */
  filterValidUsernames(usernames: string[]): string[] {
    return usernames.filter(username => {
      const isValid = this.isValidUser(username);
      if (!isValid) {
        const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
        if (!this.isValidFormat(cleanUsername)) {
          console.warn(`Skipping invalid username format: ${username}`);
        } else if (this.validUsers !== null) {
          console.warn(`Skipping user not in valid users list: ${username}`);
        }
      }
      return isValid;
    });
  }
}
