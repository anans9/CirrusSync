// src/utils/ServerChallengeHandler.ts
interface ChallengeData {
  challenge_id: string;
  challenge_string: string;
  expires_in: number;
}

interface PendingChallenge {
  challenge_string: string;
  expires_in: number;
  created_at: number;
  client_fingerprint?: string;
}

interface ChallengeInfo {
  challenge_id: string;
  solution: string;
}

class ServerChallengeHandler {
  private pendingChallenges: Map<string, PendingChallenge>;
  private deviceFingerprint: string | null = null;
  private fingerprintExpiry: number = 0;

  constructor() {
    this.pendingChallenges = new Map<string, PendingChallenge>();

    // Set up automatic cleanup of expired challenges
    if (typeof window !== "undefined") {
      setInterval(() => this.cleanupExpiredChallenges(), 60000); // Clean every minute
    }
  }

  /**
   * Process a server challenge received from the backend
   * @param challengeData - Challenge data from server
   * @returns Object with challenge ID and solution for verification
   */
  async processChallenge(challengeData: ChallengeData): Promise<ChallengeInfo> {
    const { challenge_id, challenge_string, expires_in } = challengeData;

    // Get device fingerprint for the challenge
    const deviceFingerprint = await this.getDeviceFingerprint();

    // Calculate solution immediately
    const solution = await this.calculateChallengeSolution(challenge_string);

    // Store challenge details in memory with device fingerprint
    this.pendingChallenges.set(challenge_id, {
      challenge_string,
      expires_in,
      created_at: Date.now(),
      client_fingerprint: deviceFingerprint,
    });

    return {
      challenge_id,
      solution,
    };
  }

  /**
   * Calculate the solution for a challenge string directly
   * @param challenge_string - The challenge string to solve
   * @returns Promise with the solution hash
   */
  async calculateChallengeSolution(challenge_string: string): Promise<string> {
    return this.sha256(challenge_string);
  }

  /**
   * Compute the challenge solution
   * @param challenge_id - ID of the challenge to solve
   * @returns Promise with solution for verification
   */
  async solveChallenge(challenge_id: string): Promise<string> {
    const challengeData = this.pendingChallenges.get(challenge_id);
    if (!challengeData) {
      throw new Error("Challenge not found");
    }

    // Check if challenge has expired
    const now = Date.now();
    const expiry = challengeData.created_at + challengeData.expires_in * 1000;
    if (now > expiry) {
      this.pendingChallenges.delete(challenge_id);
      throw new Error("Challenge has expired");
    }

    // Calculate solution hash
    return this.calculateChallengeSolution(challengeData.challenge_string);
  }

  /**
   * Get device fingerprint information for challenge verification
   * @returns Promise with device fingerprint hash
   */
  async getDeviceFingerprint(): Promise<string> {
    const now = Date.now();

    // Return cached fingerprint if still valid
    if (this.deviceFingerprint && now < this.fingerprintExpiry) {
      return this.deviceFingerprint;
    }

    try {
      // Collect device information
      const components = [
        navigator.userAgent,
        navigator.language,
        screen.colorDepth.toString(),
        `${screen.width}x${screen.height}`,
        new Date().getTimezoneOffset().toString(),
        navigator.platform || "browser",
        navigator.hardwareConcurrency?.toString() || "0",
        navigator.cookieEnabled ? "1" : "0",
        // Try to include canvas fingerprint if possible
        await this.getCanvasFingerprint(),
      ];

      // Create a string by joining components
      const fingerprintStr = components.join("||");

      // Hash the combined fingerprint data
      this.deviceFingerprint = await this.sha256(fingerprintStr);
      this.fingerprintExpiry = now + 30 * 60 * 1000; // Cache for 30 minutes

      return this.deviceFingerprint;
    } catch (error) {
      console.error("Error generating device fingerprint:", error);
      // Fall back to a basic fingerprint
      const basicFingerprint =
        navigator.userAgent + navigator.language + screen.width;
      return await this.sha256(basicFingerprint);
    }
  }

  /**
   * Get canvas fingerprint as a hash
   * @returns Promise with canvas fingerprint or empty string
   */
  private async getCanvasFingerprint(): Promise<string> {
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return "";

      canvas.width = 200;
      canvas.height = 50;

      // Draw text with different styles
      ctx.textBaseline = "top";
      ctx.font = "14px 'Arial'";
      ctx.fillStyle = "#f60";
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = "#069";
      ctx.fillText("Fingerprint", 2, 15);
      ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
      ctx.fillText("DeviceID", 4, 17);

      // Get canvas data and hash it
      const canvasData = canvas.toDataURL().substring(0, 100);
      return canvasData;
    } catch (e) {
      return "";
    }
  }

  /**
   * Compute SHA-256 hash of a string
   * @param message - String to hash
   * @returns Hex-encoded hash
   */
  private async sha256(message: string): Promise<string> {
    try {
      // Convert string to ArrayBuffer
      const msgBuffer = new TextEncoder().encode(message);
      // Hash the message
      const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
      // Convert ArrayBuffer to hex string
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return hashHex;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Clear a challenge from pending challenges
   * @param challenge_id - ID of the challenge to clear
   */
  clearChallenge(challenge_id: string): void {
    this.pendingChallenges.delete(challenge_id);
  }

  /**
   * Get the count of pending challenges
   * @returns Number of pending challenges
   */
  getPendingChallengeCount(): number {
    return this.pendingChallenges.size;
  }

  /**
   * Clean up expired challenges to prevent memory leaks
   */
  cleanupExpiredChallenges(): void {
    const now = Date.now();

    for (const [id, challengeData] of this.pendingChallenges.entries()) {
      const expiry = challengeData.created_at + challengeData.expires_in * 1000;
      if (now > expiry) {
        this.pendingChallenges.delete(id);
      }
    }
  }
}

// Create a singleton instance
const ServerChallengeHandlerInstance = new ServerChallengeHandler();
export default ServerChallengeHandlerInstance;
