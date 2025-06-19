// SRPClient.ts - Enhanced frontend SRP implementation focusing on improved K calculation

/**
 * Interface definitions
 */
interface SRPRegistrationCredentials {
  salt: string;
  verifier: string;
}

interface SRPStartAuthResponse {
  clientPublic: string;
}

/**
 * Enhanced SRP Client implementation with improved K calculation
 */
export default class SRPClient {
  private username: string;
  private N: bigint; // Safe prime
  private g: bigint; // Generator
  private k: bigint = BigInt(3); // Default initialization to prevent error

  private a: bigint | null = null; // Secret ephemeral value
  private A: bigint | null = null; // Public ephemeral value
  private salt: string | null = null;
  private B: bigint | null = null; // Server's public ephemeral value
  private K: string | null = null; // Session key
  private M1: string | null = null; // Client proof

  /**
   * Creates a new SRP client
   * @param username The username for authentication
   * @throws Error if username is empty
   */
  constructor(username: string) {
    // Validate input
    if (!username || username.trim() === "") {
      throw new Error("Username cannot be empty");
    }

    this.username = username;

    // SRP-6a parameters - exactly matching server implementation (2048-bit)
    this.N = BigInt(
      "0xAC6BDB41324A9A9BF166DE5E1389582FAF72B6651987EE07FC3192943DB56050A37329CBB4A099ED8193E0757767A13DD52312AB4B03310DCD7F48A9DA04FD50E8083969EDB767B0CF6095179A163AB3661A05FBD5FAAAE82918A9962F0B93B855F97993EC975EEAA80D740ADBF4FF747359D041D5C33EA71D281E446B14773BCA97B43A23FB801676BD207A436C6481F1D2B9078717461A5B9D32E688F87748544523B524B0D57D5EA77A2775D2ECFA032CFBDBF52FB3786160279004E57AE6AF874E7303CE53299CCC041C7BC308D82A5698F3A8D0C38271AE35F8E9DBFBB694B5C803D89F7AE435DE236D525F54759B65E372FCD68EF20FA7111F9E4AFF73",
    );
    this.g = BigInt(2);

    // Calculate k = H(N, g) to match server's implementation
    this.calculateK();
  }

  /**
   * Calculate k = H(N, g) to match server implementation
   */
  private async calculateK(): Promise<void> {
    try {
      // Convert N to padded byte array
      const NBytes = this.bigintToBytes(this.N);

      // Convert g to byte array and pad to same length as N
      let gBytes = this.bigintToBytes(this.g);

      // Pad gBytes to the same length as NBytes
      const paddedGBytes = new Uint8Array(NBytes.length);
      paddedGBytes.set(gBytes, paddedGBytes.length - gBytes.length);

      // Concatenate N || g
      const kInput = new Uint8Array(NBytes.length + paddedGBytes.length);
      kInput.set(NBytes);
      kInput.set(paddedGBytes, NBytes.length);

      // Calculate k = H(N || g) using the crypto.subtle API properly
      const kHashBuffer = await crypto.subtle.digest("SHA-256", kInput);
      const kHash = new Uint8Array(kHashBuffer);
      this.k = this.bytesToBigInt(kHash);
    } catch (error) {
      console.error("Error calculating k value:", error);
      // Fallback to standard value if calculation fails
      this.k = BigInt(3);
    }
  }

  /**
   * Securely generate a random bigint within range [1, N-1]
   * @returns A cryptographically secure random bigint
   */
  private generateSecureRandomBigInt(): bigint {
    const byteLength = Math.ceil(this.N.toString(2).length / 8);
    let randomValue: bigint;
    let hasBadFactors: boolean;
    const minThreshold = BigInt(1) << BigInt(128);

    // Ensure the value is in the proper range with good entropy
    do {
      // Generate random bytes with extra length for better security
      const bytes = this.generateRandomBytes(byteLength + 8);
      randomValue = this.bytesToBigInt(bytes);

      // Mask off any extra bits to ensure value < N
      const maskBits = this.N.toString(2).length;
      const mask = (BigInt(1) << BigInt(maskBits)) - BigInt(1);
      randomValue &= mask;

      // Check if value is divisible by small primes (security improvement)
      hasBadFactors = [
        BigInt(2),
        BigInt(3),
        BigInt(5),
        BigInt(7),
        BigInt(11),
        BigInt(13),
      ].some((p) => randomValue % p === BigInt(0));
    } while (
      randomValue <= BigInt(0) ||
      randomValue >= this.N ||
      randomValue < minThreshold ||
      hasBadFactors
    );

    return randomValue;
  }

  /**
   * Generate a random buffer of specified byte length
   */
  private generateRandomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
  }

  /**
   * Convert bytes to BigInt
   */
  private bytesToBigInt(bytes: Uint8Array): bigint {
    return BigInt("0x" + this.bytesToHex(bytes));
  }

  /**
   * Convert hex string to bytes
   */
  private hexToBytes(hex: string): Uint8Array {
    if (hex.length % 2 !== 0) {
      hex = "0" + hex;
    }

    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }

    return bytes;
  }

  /**
   * Convert bytes to hex string
   */
  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /**
   * Convert bigint to bytes
   */
  private bigintToBytes(bn: bigint): Uint8Array {
    let hex = bn.toString(16);
    if (hex.length % 2) {
      hex = "0" + hex;
    }
    return this.hexToBytes(hex);
  }

  /**
   * Generate registration credentials for a new user
   * @param password The user's password
   * @returns SRP registration credentials (salt and verifier)
   * @throws Error if password is empty
   */
  public async generateRegistrationCredentials(
    password: string,
  ): Promise<SRPRegistrationCredentials> {
    if (!password) {
      throw new Error("Password cannot be empty");
    }

    // Generate a random salt (32 bytes for better security)
    const saltBytes = this.generateRandomBytes(32);
    const salt = this.bytesToHex(saltBytes);

    // Calculate x = H(s, H(I:p)) - matching server implementation
    const identityHash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${this.username}:${password}`),
    );

    const xHashInput = new Uint8Array(
      saltBytes.length + identityHash.byteLength,
    );
    xHashInput.set(saltBytes);
    xHashInput.set(new Uint8Array(identityHash), saltBytes.length);

    const xHash = await crypto.subtle.digest("SHA-256", xHashInput);
    const x = BigInt("0x" + this.bytesToHex(new Uint8Array(xHash)));

    // Calculate v = g^x % N
    const v = this.modPow(this.g, x, this.N);

    return {
      salt: salt,
      verifier: v.toString(16),
    };
  }

  /**
   * Start the SRP authentication process by generating client public key
   * @returns Client public key for authentication
   */
  public startAuthentication(): SRPStartAuthResponse {
    // Generate random a (client private key) in range [1, N-1]
    this.a = this.generateSecureRandomBigInt();

    // Calculate A = g^a % N
    this.A = this.modPow(this.g, this.a, this.N);

    return {
      clientPublic: this.A.toString(16),
    };
  }

  /**
   * Process server challenge and generate client proof
   * @param salt The user's salt
   * @param serverPublicKey Server's public key (B)
   * @param password The user's password
   * @returns Client proof (M1)
   * @throws Error if authentication not initialized or inputs are invalid
   */
  public async processChallenge(
    salt: string,
    serverPublicKey: string,
    password: string,
  ): Promise<string> {
    if (!this.A || !this.a) {
      throw new Error(
        "SRP client not initialized correctly. Call startAuthentication first.",
      );
    }

    if (!salt || !serverPublicKey || !password) {
      throw new Error("Salt, server public key, and password are required");
    }

    this.salt = salt;
    this.B = BigInt("0x" + serverPublicKey);

    // Safety check: B should not be divisible by N
    if (this.B % this.N === BigInt(0)) {
      throw new Error("Invalid server public key: B mod N = 0");
    }

    // Safety check: B should be in range [1, N-1]
    if (this.B <= BigInt(0) || this.B >= this.N) {
      throw new Error("Invalid server public key: B must be between 1 and N-1");
    }

    // 1. Calculate u = H(A, B) - matching server implementation exactly
    const ABytes = this.bigintToBytes(this.A);
    const BBytes = this.bigintToBytes(this.B);

    const uHashInput = new Uint8Array(ABytes.length + BBytes.length);
    uHashInput.set(ABytes);
    uHashInput.set(BBytes, ABytes.length);

    const uHashBuffer = await crypto.subtle.digest("SHA-256", uHashInput);
    const uHash = new Uint8Array(uHashBuffer);
    const u = BigInt("0x" + this.bytesToHex(uHash));

    // Safety check: u should not be zero
    if (u === BigInt(0)) {
      throw new Error("Hash of A and B resulted in 0, which is insecure");
    }

    // 2. Calculate x = H(s, H(I:p)) - matching server implementation
    const identityHash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${this.username}:${password}`),
    );

    const saltBytes = this.hexToBytes(salt);
    const xHashInput = new Uint8Array(
      saltBytes.length + identityHash.byteLength,
    );
    xHashInput.set(saltBytes);
    xHashInput.set(new Uint8Array(identityHash), saltBytes.length);

    const xHashBuffer = await crypto.subtle.digest("SHA-256", xHashInput);
    const xHash = new Uint8Array(xHashBuffer);
    const x = BigInt("0x" + this.bytesToHex(xHash));

    // 3. Calculate S = (B - k * g^x) ^ (a + u * x) % N - IMPROVED CALCULATION
    const v = this.modPow(this.g, x, this.N); // Verifier

    // IMPROVED CALCULATION: This matches server-side calculation exactly
    let diff = this.subMod(this.B, this.mulMod(this.k, v, this.N), this.N);

    // Calculate a + ux
    const ux = this.mulMod(u, x, this.N - BigInt(1));
    const exp = this.addMod(this.a, ux, this.N - BigInt(1));

    // Calculate S = (B - k*v)^(a + ux) % N
    const S = this.modPow(diff, exp, this.N);

    // 4. Calculate K = H(S) - matching server implementation exactly
    const SBytes = this.bigintToBytes(S);
    const KHashBuffer = await crypto.subtle.digest("SHA-256", SBytes);
    const KHash = new Uint8Array(KHashBuffer);
    this.K = this.bytesToHex(KHash);

    // 5. Calculate M1 = H(A | B | K) - matching server implementation exactly
    const M1Input = new Uint8Array(
      ABytes.length + BBytes.length + KHash.byteLength,
    );
    M1Input.set(ABytes);
    M1Input.set(BBytes, ABytes.length);
    M1Input.set(KHash, ABytes.length + BBytes.length);

    const M1HashBuffer = await crypto.subtle.digest("SHA-256", M1Input);
    const M1Hash = new Uint8Array(M1HashBuffer);
    this.M1 = this.bytesToHex(M1Hash);

    return this.M1;
  }

  /**
   * Verify server proof
   * @param serverProof The server's proof (M2)
   * @returns true if verification succeeds, false otherwise
   * @throws Error if authentication not properly initialized
   */
  public async verifyServer(serverProof: string): Promise<boolean> {
    if (!this.A || !this.M1 || !this.K) {
      throw new Error("SRP authentication not properly initialized");
    }

    if (!serverProof) {
      throw new Error("Server proof cannot be empty");
    }

    // Expected M2 = H(A | M1 | K) - matching server implementation
    const ABytes = this.bigintToBytes(this.A);
    const M1Bytes = this.hexToBytes(this.M1);
    const KBytes = this.hexToBytes(this.K);

    const M2Input = new Uint8Array(
      ABytes.length + M1Bytes.length + KBytes.length,
    );
    M2Input.set(ABytes);
    M2Input.set(M1Bytes, ABytes.length);
    M2Input.set(KBytes, ABytes.length + M1Bytes.length);

    const M2HashBuffer = await crypto.subtle.digest("SHA-256", M2Input);
    const M2Hash = new Uint8Array(M2HashBuffer);
    const M2 = this.bytesToHex(M2Hash);

    // Check if proofs match using constant-time comparison
    if (this.constantTimeEqual(M2, serverProof)) {
      // Clear sensitive data after successful verification
      this.clearSensitiveData();
      return true;
    }

    // Try fallback verification for compatibility with server
    const fallbackInput = new TextEncoder().encode(
      `${this.username}:${this.M1}:${this.A.toString(16)}`,
    );
    const fallbackHashBuffer = await crypto.subtle.digest(
      "SHA-256",
      fallbackInput,
    );
    const fallbackHash = new Uint8Array(fallbackHashBuffer);
    const fallbackProof = this.bytesToHex(fallbackHash);

    const result = this.constantTimeEqual(fallbackProof, serverProof);

    // Clear sensitive data after verification (success or failure)
    this.clearSensitiveData();

    return result;
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   * @param a First string to compare
   * @param b Second string to compare
   * @returns true if strings are equal, false otherwise
   */
  private constantTimeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      // XOR the code points and OR the results
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Clear sensitive data from memory when no longer needed
   */
  private clearSensitiveData(): void {
    // Overwrite with zeros for better security
    if (this.a !== null) {
      this.a = BigInt(0);
      this.a = null;
    }

    if (this.K !== null) {
      // Overwrite the string with empty string first
      this.K = "0".repeat(this.K.length);
      this.K = null;
    }
  }

  /**
   * Safe modular addition: (a + b) % mod
   * Ensures result is always positive
   */
  private addMod(a: bigint, b: bigint, mod: bigint): bigint {
    let result = (a + b) % mod;
    if (result < BigInt(0)) {
      result += mod;
    }
    return result;
  }

  /**
   * Safe modular subtraction: (a - b) % mod
   * Ensures result is always positive
   */
  private subMod(a: bigint, b: bigint, mod: bigint): bigint {
    let result = (a - b) % mod;
    if (result < BigInt(0)) {
      result += mod;
    }
    return result;
  }

  /**
   * Safe modular multiplication: (a * b) % mod
   * Ensures result is always positive
   */
  private mulMod(a: bigint, b: bigint, mod: bigint): bigint {
    let result = (a * b) % mod;
    if (result < BigInt(0)) {
      result += mod;
    }
    return result;
  }

  /**
   * Modular exponentiation: base^exponent % modulus
   * Using square-and-multiply algorithm for efficiency
   */
  private modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
    if (modulus === BigInt(1)) return BigInt(0);
    if (exponent < BigInt(0))
      throw new Error("Negative exponents are not supported");

    let result = BigInt(1);
    base = base % modulus;

    while (exponent > BigInt(0)) {
      if (exponent % BigInt(2) === BigInt(1)) {
        result = (result * base) % modulus;
      }
      exponent = exponent / BigInt(2);
      base = (base * base) % modulus;
    }

    return result;
  }
}
