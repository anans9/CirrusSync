import { invoke } from "@tauri-apps/api/core";

/**
 * SecureStorageService - A wrapper around Tauri's secure storage mechanism
 * This simulates a system keychain by using secured file storage
 */
class SecureStorageService {
  private serviceName: string;

  constructor() {
    // This will be used as the "service" in the storage
    this.serviceName = "cirrussync";
  }

  /**
   * Store a secret in the secure storage
   * @param key The username/key to associate with the secret
   * @param value The secret value to store
   */
  async setSecret(key: string, value: string): Promise<void> {
    try {
      await invoke("set_password", {
        service: this.serviceName,
        username: key,
        password: value,
      });
    } catch (error) {
      throw new Error("Failed to store secure data");
    }
  }

  /**
   * Retrieve a secret from the secure storage
   * @param key The username/key associated with the secret
   * @returns The secret value or null if not found
   */
  async getSecret(key: string): Promise<string | null> {
    try {
      return await invoke<string>("get_password", {
        service: this.serviceName,
        username: key,
      });
    } catch (error) {
      return null;
    }
  }

  /**
   * Delete a secret from the secure storage
   * @param key The username/key to delete
   */
  async deleteSecret(key: string): Promise<void> {
    try {
      await invoke("delete_password", {
        service: this.serviceName,
        username: key,
      });
    } catch (error) {
      // We don't throw here because the key might not exist
    }
  }

  /**
   * Store the derived key for a user
   * @param userId The user ID
   * @param derivedKey The derived key to store
   */
  async storeDerivedKey(userId: string, derivedKey: string): Promise<void> {
    await this.setSecret(`user_${userId}_derived_key`, derivedKey);
  }

  /**
   * Get the derived key for a user
   * @param userId The user ID
   * @returns The derived key or null if not found
   */
  async getDerivedKey(userId: string): Promise<string | null> {
    return await this.getSecret(`user_${userId}_derived_key`);
  }

  /**
   * Delete the derived key for a user
   * @param userId The user ID
   */
  async deleteDerivedKey(userId: string): Promise<void> {
    await this.deleteSecret(`user_${userId}_derived_key`);
  }
}

// Export a singleton instance
export const secureStorage = new SecureStorageService();
export default secureStorage;
