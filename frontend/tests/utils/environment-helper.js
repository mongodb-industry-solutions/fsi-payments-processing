import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Environment Helper for managing app URLs across different environments
 */
export class EnvironmentHelper {
  static #appsConfig = null;

  /**
   * Load apps configuration from apps.json
   * @returns {Object} Apps configuration object
   */
  static #loadAppsConfig() {
    if (!this.#appsConfig) {
      const configPath = resolve(__dirname, '../config/apps.json');
      try {
        const configData = readFileSync(configPath, 'utf8');
        this.#appsConfig = JSON.parse(configData);
      } catch (error) {
        throw new Error(`Failed to load apps configuration from ${configPath}: ${error.message}`);
      }
    }
    return this.#appsConfig;
  }

  /**
   * Get all URLs for a specific app and environment
   * @param {string} appName - Name of the application
   * @param {string} environment - Environment name (staging, qa, production)
   * @returns {Object} Object containing backend and frontend URLs
   */
  static getAppUrls(appName, environment = 'staging') {
    const appsConfig = this.#loadAppsConfig();
    const app = appsConfig[appName];
    
    if (!app) {
      throw new Error(`App '${appName}' not found in configuration. Available apps: ${Object.keys(appsConfig).join(', ')}`);
    }
    
    if (!app[environment]) {
      const availableEnvs = Object.keys(app).filter(key => key !== 'name');
      throw new Error(`Environment '${environment}' not found for app '${appName}'. Available environments: ${availableEnvs.join(', ')}`);
    }
    
    return app[environment];
  }

  /**
   * Get frontend URL for a specific app and environment
   * @param {string} appName - Name of the application
   * @param {string} environment - Environment name (staging, qa, production)
   * @returns {string} Frontend URL
   */
  static getFrontendUrl(appName, environment = 'staging') {
    const urls = this.getAppUrls(appName, environment);
    if (!urls.frontend) {
      throw new Error(`Frontend URL not configured for app '${appName}' in environment '${environment}'`);
    }
    return urls.frontend;
  }

  /**
   * Get app name for display purposes
   * @param {string} appName - Name of the application
   * @returns {string} Display name of the app
   */
  static getAppDisplayName(appName) {
    const appsConfig = this.#loadAppsConfig();
    const app = appsConfig[appName];
    
    if (!app) {
      throw new Error(`App '${appName}' not found in configuration`);
    }
    
    return app.name || appName;
  }

  /**
   * Get all available app names
   * @returns {string[]} Array of app names
   */
  static getAvailableApps() {
    const appsConfig = this.#loadAppsConfig();
    return Object.keys(appsConfig);
  }

  /**
   * Get all available environments for a specific app
   * @param {string} appName - Name of the application
   * @returns {string[]} Array of environment names
   */
  static getAvailableEnvironments(appName) {
    const appsConfig = this.#loadAppsConfig();
    const app = appsConfig[appName];
    
    if (!app) {
      throw new Error(`App '${appName}' not found in configuration`);
    }
    
    return Object.keys(app).filter(key => typeof app[key] === 'object' && app[key] !== null);
  }

  /**
   * Check if an app and environment combination exists
   * @param {string} appName - Name of the application
   * @param {string} environment - Environment name
   * @returns {boolean} True if combination exists
   */
  static isValidAppEnvironment(appName, environment) {
    try {
      this.getAppUrls(appName, environment);
      return true;
    } catch {
      return false;
    }
  }
}
