import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

export class EmailMappingLoader {
  /**
   * Load email mappings from all configured sources and merge them
   */
  static async loadMappings(
    directMappings?: Record<string, string>,
    filePath?: string,
    curlCommand?: string
  ): Promise<Record<string, string>> {
    const mappings: Record<string, string> = {};

    // 1. Load from direct mappings (highest priority)
    if (directMappings) {
      Object.assign(mappings, directMappings);
    }

    // 2. Load from file
    if (filePath) {
      try {
        const fileMappings = this.loadFromFile(filePath);
        // Direct mappings override file mappings
        Object.assign(mappings, { ...fileMappings, ...directMappings });
      } catch (error) {
        console.warn(`Failed to load email mappings from file ${filePath}:`, error);
      }
    }

    // 3. Load from curl command
    if (curlCommand) {
      try {
        const curlMappings = this.loadFromCurl(curlCommand);
        // Direct mappings and file mappings override curl mappings
        Object.assign(mappings, { ...curlMappings, ...mappings });
      } catch (error) {
        console.warn(`Failed to load email mappings from curl command:`, error);
      }
    }

    return mappings;
  }

  /**
   * Load email mappings from a JSON file
   */
  private static loadFromFile(filePath: string): Record<string, string> {
    const fullPath = resolve(process.cwd(), filePath);

    if (!existsSync(fullPath)) {
      throw new Error(`Email mappings file not found: ${filePath}`);
    }

    const content = readFileSync(fullPath, 'utf-8');
    const data = JSON.parse(content);

    // Validate that it's a simple key-value object
    if (typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Email mappings file must contain a JSON object with email-to-username mappings');
    }

    return data;
  }

  /**
   * Load email mappings from a curl command
   */
  private static loadFromCurl(curlCommand: string): Record<string, string> {
    try {
      // Execute curl command and capture output
      const output = execSync(curlCommand, {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024, // 10MB max
        timeout: 30000 // 30 second timeout
      });

      // Parse JSON response
      const data = JSON.parse(output);

      // Validate that it's a simple key-value object
      if (typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Curl response must be a JSON object with email-to-username mappings');
      }

      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to execute curl command: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Normalize email mappings to ensure consistent format
   * Removes @ prefix from usernames if present (will be added later)
   */
  static normalizeMappings(mappings: Record<string, string>): Record<string, string> {
    const normalized: Record<string, string> = {};

    for (const [email, username] of Object.entries(mappings)) {
      const normalizedEmail = email.toLowerCase().trim();
      const normalizedUsername = username.startsWith('@')
        ? username.substring(1)
        : username;

      normalized[normalizedEmail] = normalizedUsername;
    }

    return normalized;
  }
}
