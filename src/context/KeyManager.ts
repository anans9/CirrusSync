// import * as openpgp from "openpgp";
// import { invoke } from "@tauri-apps/api/core";

// interface KeyPair {
//   publicKey: string;
//   privateKey: string;
// }

// interface KeyInfo {
//   version: number;
//   passphrase: string;
//   passphrase_signature: string;
//   private_key: string;
//   public_key: string;
//   fingerprint: string;
// }

// interface SignupKeysResult {
//   email: string;
//   username: string;
//   keys: KeyInfo;
//   derived_key: string;
//   recovery_phrase: string;
// }

// interface ShareKeys {
//   share_key: string; // Private key of the share
//   share_passphrase: string; // Encrypted private key
//   share_passphrase_signature: string; // Signature for the encrypted private key
//   share_key_packet: string; // Encrypted session key data
//   key_packet_signature: string; // Signature for the key packet
//   session_key_signature: string; // Signature for the session key
// }

// interface FolderKeys {
//   name_hash: string; // Hash of the folder name
//   folder_name: string; // Encrypted folder name
//   node_passphrase: string; // Encrypted private key
//   node_passphrase_signature: string; // Signature for the encrypted private key
//   node_key: string; // Private key
//   node_hash_key: string; // Encrypted hash key
//   node_hash_key_signature?: string; // Signature for the hash key
// }

// interface FileKeys extends FolderKeys {
//   content_key: string; // Raw content encryption key
//   content_key_packet: string; // Encrypted content key
//   content_key_signature: string; // Signature for the content key
//   xattrs: string; // Encrypted metadata
// }

// class KeyManager {
//   // Enhanced random bytes generation
//   getRandomBytes = (size: number): Uint8Array => {
//     // Increase entropy by combining multiple sources when possible
//     const primary = new Uint8Array(size);
//     window.crypto.getRandomValues(primary);

//     // Add time-based entropy
//     const timeEntropy = new Uint8Array(8);
//     const now = Date.now();
//     const perfNow = performance.now();

//     // Use both Date.now() and performance.now() for better entropy
//     new DataView(timeEntropy.buffer).setBigUint64(
//       0,
//       BigInt(Math.floor(now)) ^ BigInt(Math.floor(perfNow * 1000)),
//     );

//     // XOR the primary random values with the time entropy
//     for (let i = 0; i < Math.min(size, 8); i++) {
//       primary[i] ^= timeEntropy[i];
//     }

//     return primary;
//   };

//   // Improved SHA-256 function
//   sha256 = async (buffer: Uint8Array | ArrayBuffer): Promise<Uint8Array> => {
//     const hashBuffer = await window.crypto.subtle.digest("SHA-256", buffer);
//     return new Uint8Array(hashBuffer);
//   };

//   // Faster array concatenation
//   concatArrays = (...arrays: Uint8Array[]): Uint8Array => {
//     const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
//     const result = new Uint8Array(totalLength);
//     let offset = 0;
//     for (const arr of arrays) {
//       result.set(arr, offset);
//       offset += arr.length;
//     }
//     return result;
//   };

//   // Optimized BigInt to byte array conversion
//   bigIntToByteArray = (bigInt: BigInt): Uint8Array => {
//     // Convert BigInt to hex string, padded to even length
//     const hex = bigInt.toString(16).padStart(2, "0");
//     const len = Math.ceil(hex.length / 2);
//     const array = new Uint8Array(len);

//     // Process 2 characters (1 byte) at a time for better performance
//     for (let i = 0; i < len; i++) {
//       const bytePos = hex.length - i * 2 - 2;
//       if (bytePos >= 0) {
//         array[len - i - 1] = parseInt(hex.substring(bytePos, 2), 16);
//       } else {
//         // Handle odd length hex strings
//         array[len - i - 1] = parseInt(hex.charAt(0), 16);
//       }
//     }

//     return array;
//   };

//   // Helper method for array to base64
//   arrayToBase64(array: Uint8Array): string {
//     return btoa(String.fromCharCode.apply(null, Array.from(array)));
//   }

//   // Helper method for base64 to array
//   base64ToArray(base64: string): Uint8Array {
//     return new Uint8Array(
//       atob(base64)
//         .split("")
//         .map((c) => c.charCodeAt(0)),
//     );
//   }

//   hexToBytes(hex: string): Uint8Array {
//     const bytes = new Uint8Array(hex.length / 2);
//     for (let i = 0; i < hex.length; i += 2) {
//       bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
//     }
//     return bytes;
//   }

//   async hashPassword(
//     password: string,
//     salt: string,
//   ): Promise<{
//     seed: string;
//   }> {
//     try {
//       // Call Rust backend to hash password with Argon2
//       const result = await invoke<{
//         seed: string;
//       }>("derive_seed_from_password", {
//         password,
//         saltHex: salt,
//       });

//       // Transform the result to match the expected format in frontend
//       return {
//         seed: result.seed,
//       };
//     } catch (error) {
//       throw new Error("Password hashing failed");
//     }
//   }

//   generateRecoveryFile = async (
//     passwordSeed: string,
//     salt: string,
//     privateKeyObj: any,
//     username: string,
//     email: string,
//   ): Promise<{
//     recovery_secret: string;
//     recovery_key: string;
//     recovery_key_signature: string;
//   }> => {
//     const recoverySecret = await this.arrayToBase64(array);
//     const { seed } = await this.hashPassword(
//       JSON.stringify(`${username} + '_' + '${email}' + '_' + ''`),
//       salt,
//     );

//     const passphraseEncrypted = await openpgp.encrypt({
//       message: await openpgp.createMessage({ text: passwordSeed }),
//       passwords: [seed],
//       format: "armored",
//       config: {
//         preferredCompressionAlgorithm: openpgp.enums.compression.zlib,
//         preferredSymmetricAlgorithm: openpgp.enums.symmetric.aes256,
//       },
//     });

//     const passphraseEncryptedSignature = await openpgp.sign({
//       message: await openpgp.createMessage({ text: passphraseEncrypted }),
//       signingKeys: privateKeyObj,
//       signingUserIDs: [{ name: username, email: email }],
//       detached: true,
//     });

//     return {
//       recovery_secret: recoverySecret,
//       recovery_key: passphraseEncrypted,
//       recovery_key_signature: passphraseEncryptedSignature,
//     };
//   };

//   generateRecoveryKey = async (): Promise<{
//     recovery_phrase: string;
//     seed: string;
//   }> => {
//     const result = await invoke<{
//       recovery_phrase: string;
//       seed: string;
//     }>("generate_recovery_phrase");

//     return {
//       recovery_phrase: result.recovery_phrase,
//       seed: result.seed,
//     };
//   };

//   // Improved key generation with additional parameters
//   async generateKeys(
//     username: string,
//     email: string,
//     config?: {
//       passphrase?: string;
//     },
//   ): Promise<KeyPair> {
//     const passphrase = config?.passphrase; // Optional passphrase

//     const userKeyPair = (await openpgp.generateKey({
//       type: "ecc",
//       curve: "ed25519Legacy",
//       userIDs: [{ name: username, email: email }],
//       format: "armored",
//       ...(passphrase ? { passphrase } : {}),
//     })) as KeyPair;

//     return userKeyPair;
//   }

//   async encryptUserPrivateKeyPassphrase(
//     passwordSeed: string,
//     recoverySeed: string,
//     privateKeyObj: any,
//     username: string,
//     email: string,
//   ): Promise<{
//     passphraseEncrypted: string;
//     passphraseEncryptedSignature: string;
//   }> {
//     const passphraseEncrypted = await openpgp.encrypt({
//       message: await openpgp.createMessage({
//         text: `${passwordSeed}_${recoverySeed}`,
//       }),
//       passwords: [passwordSeed, recoverySeed],
//       format: "armored",
//       config: {
//         preferredCompressionAlgorithm: openpgp.enums.compression.zlib,
//         preferredSymmetricAlgorithm: openpgp.enums.symmetric.aes256,
//       },
//     });

//     // Sign the encrypted passphrase
//     const passphraseEncryptedSignature = await openpgp.sign({
//       message: await openpgp.createMessage({ text: passphraseEncrypted }),
//       signingKeys: privateKeyObj,
//       signingUserIDs: [{ name: username, email: email }],
//       detached: true,
//     });

//     return {
//       passphraseEncrypted,
//       passphraseEncryptedSignature,
//     };
//   }

//   // Enhanced signup keys generation
//   async generateSignupKeys(
//     email: string,
//     username: string,
//     password: string,
//     salt: string,
//   ): Promise<SignupKeysResult> {
//     if (!email || !password) {
//       throw new Error("Missing required parameters for key generation");
//     }

//     try {
//       // Hash password with Argon2 via Rust backend
//       const { seed: passwordSeed } = await this.hashPassword(password, salt);

//       // Generate recovery phrase and its associated seed
//       const { recovery_phrase, seed: recoverySeed } =
//         await this.generateRecoveryKey();

//       // Generate user keys with the master key
//       const userKeyPair = await this.generateKeys(username, email, {
//         passphrase: passwordSeed,
//       });

//       // Get private key object for signing
//       const privateKeyObj = await openpgp.decryptKey({
//         privateKey: await openpgp.readPrivateKey({
//           armoredKey: userKeyPair.privateKey,
//         }),
//         passphrase: passwordSeed,
//       });

//       // Encrypt the password with the master key
//       const { passphraseEncrypted, passphraseEncryptedSignature } =
//         await this.encryptUserPrivateKeyPassphrase(
//           passwordSeed,
//           recoverySeed,
//           privateKeyObj,
//           username,
//           email,
//         );

//       // Get key fingerprint
//       const key = await openpgp.readKey({ armoredKey: userKeyPair.publicKey });
//       const fingerprint = key.getFingerprint();

//       return {
//         email,
//         username,
//         keys: {
//           version: 1,
//           private_key: userKeyPair.privateKey,
//           passphrase: passphraseEncrypted,
//           passphrase_signature: passphraseEncryptedSignature,
//           public_key: userKeyPair.publicKey,
//           fingerprint: fingerprint,
//         },
//         derived_key: passwordSeed,
//         recovery_phrase,
//       };
//     } catch (error: any) {
//       throw new Error(`Failed to generate signup keys: ${error.message}`);
//     }
//   }

//   // Enhanced random session key generation
//   generateRandomSessionKey = () => {
//     // Generate 32 bytes (256 bits) for stronger session key
//     const array = this.getRandomBytes(32);
//     return this.arrayToBase64(array);
//   };

//   // Generate a unique ID for key packets
//   private generateUniqueId(): string {
//     // Generate a timestamp-based ID with random component
//     const timestamp = Date.now().toString(36);
//     const random = Math.random().toString(36).substring(2, 10);
//     return `${timestamp}-${random}`;
//   }

//   // =========================================================================
//   // HIERARCHICAL ENCRYPTION IMPLEMENTATION
//   // =========================================================================

//   /**
//    * Generate initial drive share keys with hierarchical encryption
//    * This is the first level in the encryption hierarchy
//    */
//   async generateInitialDriveShareKeys(
//     name: string,
//     email: string,
//     derivedKey: string,
//   ): Promise<ShareKeys> {
//     try {
//       const shareKeyPair = await this.generateKeys(name, email, {
//         passphrase: derivedKey,
//       });

//       const sharePrivateKeyObj = await openpgp.decryptKey({
//         privateKey: await openpgp.readPrivateKey({
//           armoredKey: shareKeyPair.privateKey,
//         }),
//         passphrase: derivedKey,
//       });

//       const sharePublicKeyObj = sharePrivateKeyObj.toPublic();

//       const sessionKey = this.generateRandomSessionKey();

//       const keyPacketObj = {
//         sessionKey,
//         created: new Date().toISOString(),
//         version: 1,
//         entropy: this.generateRandomSessionKey(),
//         id: this.generateUniqueId(),
//       };

//       // Execute these operations in parallel for better performance
//       const [keyPacket, shareKeyPromises] = await Promise.all([
//         (async () => {
//           const message = await openpgp.createMessage({
//             text: JSON.stringify(keyPacketObj),
//           });
//           return openpgp.encrypt({
//             message,
//             encryptionKeys: sharePublicKeyObj,
//             format: "armored",
//             config: {
//               preferredSymmetricAlgorithm: openpgp.enums.symmetric.aes256,
//             },
//           });
//         })(),
//         // Prepare for subsequent operations in parallel
//         Promise.all([openpgp.createMessage({ text: sessionKey })]),
//       ]);

//       // Now use the results from the parallel operations
//       const sharePassphrase = await openpgp.encrypt({
//         message: await openpgp.createMessage({ text: keyPacket }),
//         encryptionKeys: sharePublicKeyObj,
//         format: "armored",
//         config: {
//           preferredSymmetricAlgorithm: openpgp.enums.symmetric.aes256,
//         },
//       });

//       // Execute signature operations in parallel
//       const [
//         sharePassphraseSignature,
//         keyPacketSignature,
//         sessionKeySignature,
//       ] = await Promise.all([
//         openpgp.sign({
//           message: await openpgp.createMessage({ text: sharePassphrase }),
//           signingKeys: sharePrivateKeyObj,
//           signingUserIDs: [{ name: name, email: email }],
//           detached: true,
//         }),
//         openpgp.sign({
//           message: await openpgp.createMessage({ text: keyPacket }),
//           signingKeys: sharePrivateKeyObj,
//           signingUserIDs: [{ name: name, email: email }],
//           detached: true,
//         }),
//         openpgp.sign({
//           message: shareKeyPromises[0],
//           signingKeys: sharePrivateKeyObj,
//           signingUserIDs: [{ name: name, email: email }],
//           detached: true,
//         }),
//       ]);

//       return {
//         share_key: shareKeyPair.privateKey,
//         share_passphrase: sharePassphrase,
//         share_passphrase_signature: sharePassphraseSignature,
//         share_key_packet: keyPacket,
//         key_packet_signature: keyPacketSignature,
//         session_key_signature: sessionKeySignature,
//       };
//     } catch (error: any) {
//       throw new Error(`Failed to generate drive keys: ${error.message}`);
//     }
//   }

//   /**
//    * Generate root folder keys, encrypted with share keys
//    * This is the second level in the encryption hierarchy
//    */
//   async generateRootFolderKeys(
//     name: string,
//     email: string,
//     shareKeyPacket: string,
//     shareKeyPrivateKey: string,
//     derivedKey: string,
//   ): Promise<FolderKeys> {
//     try {
//       // 1. First, read the share's private key
//       const sharePrivateKey = await openpgp.readPrivateKey({
//         armoredKey: shareKeyPrivateKey,
//       });

//       const sharePrivateKeyObj = await openpgp.decryptKey({
//         privateKey: sharePrivateKey,
//         passphrase: derivedKey,
//       });

//       // 2. Decrypt the share key packet to get the session key
//       const encryptedKeyPacket = await openpgp.readMessage({
//         armoredMessage: shareKeyPacket,
//       });

//       const decryptedKeyPacket = await openpgp.decrypt({
//         message: encryptedKeyPacket,
//         decryptionKeys: sharePrivateKeyObj,
//       });

//       // 3. Parse the decrypted key packet to get the session key
//       const shareKeyData = JSON.parse(decryptedKeyPacket.data as string);
//       const shareSessionKey = shareKeyData.sessionKey;

//       // 4. Generate new keypair for the root folder WITH share's session key as passphrase
//       // This ensures the root private key is protected by the share's key packet
//       const rootKeyPair = await this.generateKeys(name, email, {
//         passphrase: shareSessionKey,
//       });

//       // Get decrypted version of the root private key for operations
//       const rootPrivateKeyObj = await openpgp.decryptKey({
//         privateKey: await openpgp.readPrivateKey({
//           armoredKey: rootKeyPair.privateKey,
//         }),
//         passphrase: shareSessionKey,
//       });

//       const rootPublicKeyObj = rootPrivateKeyObj.toPublic();

//       // 6. Create a root folder key packet with its own session key
//       const rootSessionKey = this.generateRandomSessionKey();
//       const rootKeyPacketData = {
//         sessionKey: rootSessionKey,
//         shareKeyPacketId: shareKeyData.id || this.generateUniqueId(), // Reference to parent
//         created: new Date().toISOString(),
//         version: 1,
//         keyType: "root",
//         id: this.generateUniqueId(), // Unique ID for this key packet
//       };

//       // Run operations in parallel where possible
//       const [rootKeyPacket, nameHash, nodeHashKeyBuffer] = await Promise.all([
//         // 7. Encrypt the root key packet with the share's session key
//         (async () => {
//           const message = await openpgp.createMessage({
//             text: JSON.stringify(rootKeyPacketData),
//           });
//           return openpgp.encrypt({
//             message,
//             passwords: [shareSessionKey], // Use share's session key
//             format: "armored",
//             config: {
//               preferredSymmetricAlgorithm: openpgp.enums.symmetric.aes256,
//             },
//           });
//         })(),

//         // Calculate name hash in parallel
//         this.calculateNameHash(name),

//         // Generate node hash key buffer in parallel
//         Promise.resolve(this.getRandomBytes(32)),
//       ]);

//       // More parallel operations with the results from above
//       const [rootKeyPacketSignature, nodeHashKey, encryptedName] =
//         await Promise.all([
//           // 8. Sign the root key packet with the root private key
//           (async () => {
//             const message = await openpgp.createMessage({
//               text: rootKeyPacket,
//             });
//             return openpgp.sign({
//               message,
//               signingKeys: rootPrivateKeyObj,
//               signingUserIDs: [{ name: name, email: email }],
//               detached: true,
//             });
//           })(),

//           // 9. Generate and encrypt a node hash key for the root folder
//           (async () => {
//             const message = await openpgp.createMessage({
//               binary: nodeHashKeyBuffer,
//             });
//             return openpgp.encrypt({
//               message,
//               passwords: [rootSessionKey], // Use root's session key
//               format: "armored",
//               config: {
//                 preferredSymmetricAlgorithm: openpgp.enums.symmetric.aes256,
//               },
//             });
//           })(),

//           // 10. Encrypt the folder name
//           (async () => {
//             const message = await openpgp.createMessage({ text: name });
//             return openpgp.encrypt({
//               message,
//               encryptionKeys: rootPublicKeyObj,
//               format: "armored",
//               config: {
//                 preferredSymmetricAlgorithm: openpgp.enums.symmetric.aes256,
//               },
//             });
//           })(),
//         ]);

//       // Sign the node hash key for integrity
//       const nodeHashKeySignature = await openpgp.sign({
//         message: await openpgp.createMessage({ text: nodeHashKey }),
//         signingKeys: rootPrivateKeyObj,
//         signingUserIDs: [{ name: name, email: email }],
//         detached: true,
//       });

//       // 11. Return the complete root folder keys object
//       return {
//         name_hash: nameHash,
//         folder_name: encryptedName,
//         node_passphrase: rootKeyPacket, // Use the key packet as the node passphrase
//         node_passphrase_signature: rootKeyPacketSignature,
//         node_key: rootKeyPair.privateKey, // Passphrase-protected private key
//         node_hash_key: nodeHashKey,
//         node_hash_key_signature: nodeHashKeySignature,
//       };
//     } catch (error: any) {
//       throw new Error(`Failed to generate root folder keys: ${error.message}`);
//     }
//   }

//   /**
//    * Generate subfolder or file keys with hierarchical encryption
//    * Each item's private key is protected by its parent's session key
//    * Optimized for performance with parallel operations
//    */
//   async generateSubFolderKeys(
//     name: string,
//     email: string,
//     parentPrivateKeyArmored: string,
//     parentKeyPacket: string,
//     parentPassphraseSignature: string,
//     parentSessionKey: string,
//     parentKeyPacketId: string,
//     xattrs: string = "",
//     isFile: boolean = false,
//   ): Promise<FolderKeys | FileKeys> {
//     try {
//       const parentPrivateKey = await openpgp.readPrivateKey({
//         armoredKey: parentPrivateKeyArmored,
//       });

//       // 4. Verify the parent passphrase signature only if provided (can be done in parallel)
//       let signatureVerificationPromise = Promise.resolve(true);
//       if (parentPassphraseSignature) {
//         signatureVerificationPromise = (async () => {
//           const parentKeyPacketMessage = await openpgp.createMessage({
//             text: parentKeyPacket,
//           });
//           const signature = await openpgp.readSignature({
//             armoredSignature: parentPassphraseSignature,
//           });

//           const verified = await openpgp.verify({
//             message: parentKeyPacketMessage,
//             signature: signature,
//             verificationKeys: parentPrivateKey,
//           });

//           const { verified: signatureValid } = verified.signatures[0];
//           console.log("Signature verification result:", signatureValid);
//           return signatureValid;
//         })();
//       }

//       // 5. Generate new keypair for the item using parent's session key as passphrase
//       // This maintains the cryptographic hierarchy
//       const itemSessionKey = this.generateRandomSessionKey();

//       const itemKeyPair = await this.generateKeys(name, email, {
//         passphrase: itemSessionKey,
//       });

//       // 6. Check if signature verification succeeded
//       const signatureValid = await signatureVerificationPromise;
//       if (!signatureValid) {
//         throw new Error("Parent key packet signature verification failed");
//       }

//       // 7. Get decrypted version of the item's private key for operations
//       const itemPrivateKeyObj = await openpgp.decryptKey({
//         privateKey: await openpgp.readPrivateKey({
//           armoredKey: itemKeyPair.privateKey,
//         }),
//         passphrase: itemSessionKey,
//       });

//       const itemPublicKeyObj = itemPrivateKeyObj.toPublic();

//       // 8. Create a new session key and key packet for this item
//       const itemKeyPacketData = {
//         sessionKey: itemSessionKey,
//         parentKeyPacketId: parentKeyPacketId || this.generateUniqueId(),
//         created: new Date().toISOString(),
//         version: 1,
//         keyType: isFile ? "file" : "folder",
//         id: this.generateUniqueId(),
//       };

//       // 9. Start multiple encryption operations in parallel for better performance
//       const [itemKeyPacketPromise, nodeHashKeyBuffer, nameHashPromise] =
//         await Promise.all([
//           // Encrypt the item's key packet with the parent session key
//           (async () => {
//             const message = await openpgp.createMessage({
//               text: JSON.stringify(itemKeyPacketData),
//             });
//             return openpgp.encrypt({
//               message,
//               passwords: [parentSessionKey],
//               format: "armored",
//               config: {
//                 preferredSymmetricAlgorithm: openpgp.enums.symmetric.aes256,
//               },
//             });
//           })(),

//           // Generate node hash key
//           Promise.resolve(this.getRandomBytes(32)),

//           // Calculate name hash for lookups
//           this.calculateNameHash(name),
//         ]);

//       // 10. Continue with more parallel operations
//       const [itemKeyPacket, nodeHashKey, encryptedName, nameHash] =
//         await Promise.all([
//           // Resolve the key packet promise
//           itemKeyPacketPromise,

//           // Encrypt the node hash key
//           (async () => {
//             const message = await openpgp.createMessage({
//               binary: nodeHashKeyBuffer,
//             });
//             return openpgp.encrypt({
//               message,
//               encryptionKeys: itemPublicKeyObj,
//               format: "armored",
//               config: {
//                 preferredSymmetricAlgorithm: openpgp.enums.symmetric.aes256,
//               },
//             });
//           })(),

//           // Encrypt the item name
//           (async () => {
//             const message = await openpgp.createMessage({ text: name });
//             return openpgp.encrypt({
//               message,
//               encryptionKeys: itemPublicKeyObj,
//               format: "armored",
//               config: {
//                 preferredSymmetricAlgorithm: openpgp.enums.symmetric.aes256,
//               },
//             });
//           })(),

//           // Resolve the name hash promise
//           nameHashPromise,
//         ]);

//       // 11. Sign the key packet and node hash key in parallel
//       const [itemKeyPacketSignature, nodeHashKeySignature] = await Promise.all([
//         (async () => {
//           const message = await openpgp.createMessage({ text: itemKeyPacket });
//           return openpgp.sign({
//             message,
//             signingKeys: itemPrivateKeyObj,
//             signingUserIDs: [{ name: name, email: email }],
//             detached: true,
//           });
//         })(),
//         (async () => {
//           const message = await openpgp.createMessage({ text: nodeHashKey });
//           return openpgp.sign({
//             message,
//             signingKeys: itemPrivateKeyObj,
//             signingUserIDs: [{ name: name, email: email }],
//             detached: true,
//           });
//         })(),
//       ]);

//       // 12. Build the common keys object for both folders and files
//       const keys: FolderKeys = {
//         name_hash: nameHash,
//         folder_name: encryptedName,
//         node_passphrase: itemKeyPacket,
//         node_passphrase_signature: itemKeyPacketSignature,
//         node_key: itemKeyPair.privateKey,
//         node_hash_key: nodeHashKey,
//         node_hash_key_signature: nodeHashKeySignature,
//       };

//       // 13. For files, add additional content encryption keys
//       if (isFile) {
//         // Generate content key operations in parallel
//         const contentKeyBuffer = this.getRandomBytes(32);
//         const contentKeyBase64 = this.arrayToBase64(contentKeyBuffer);

//         const contentMessage = await openpgp.createMessage({
//           binary: contentKeyBuffer,
//         });

//         const [contentKeyPacket, encryptedXattrs] = await Promise.all([
//           // Encrypt content key with item's public key
//           openpgp.encrypt({
//             message: contentMessage,
//             encryptionKeys: itemPublicKeyObj,
//             format: "armored",
//             config: {
//               preferredSymmetricAlgorithm: openpgp.enums.symmetric.aes256,
//             },
//           }),

//           // Handle extended attributes if provided
//           (async () => {
//             if (!xattrs) return "";

//             const xattrsMessage = await openpgp.createMessage({
//               text: xattrs,
//             });
//             return openpgp.encrypt({
//               message: xattrsMessage,
//               passwords: [itemSessionKey],
//               format: "armored",
//               config: {
//                 preferredSymmetricAlgorithm: openpgp.enums.symmetric.aes256,
//               },
//             });
//           })(),
//         ]);

//         // Sign the content key packet
//         const contentKeySignature = await openpgp.sign({
//           message: await openpgp.createMessage({
//             text: contentKeyPacket,
//           }),
//           signingKeys: itemPrivateKeyObj,
//           signingUserIDs: [{ name: name, email: email }],
//           detached: true,
//         });

//         const fileKeys = {
//           ...keys,
//           content_key: contentKeyBase64,
//           content_key_packet: contentKeyPacket,
//           content_key_signature: contentKeySignature,
//           xattrs: encryptedXattrs,
//         } as FileKeys;

//         return fileKeys;
//       }

//       // Return folder keys
//       return keys;
//     } catch (error: any) {
//       throw new Error(
//         `Failed to generate subfolder/file keys: ${error.message}`,
//       );
//     }
//   }

//   /**
//    * File keys generation (convenience method)
//    * Simplified wrapper around generateSubFolderKeys with isFile=true
//    */
//   async generateFileKeys(
//     name: string,
//     email: string,
//     parentPrivateKeyArmored: string,
//     parentKeyPacket: string,
//     parentPassphraseSignature: string,
//     parentSessionKey: string,
//     parentKeyPacketId: string,
//     xattrs: string = "",
//   ): Promise<FileKeys> {
//     return this.generateSubFolderKeys(
//       name,
//       email,
//       parentPrivateKeyArmored,
//       parentKeyPacket,
//       parentPassphraseSignature,
//       parentSessionKey,
//       parentKeyPacketId,
//       xattrs,
//       true, // Set isFile to true
//     ) as Promise<FileKeys>;
//   }

//   /**
//    * Share access with another user by re-encrypting the share key packet
//    * using the recipient's public key
//    */
//   async shareAccessWithUser(
//     shareKeyPacket: string,
//     sharePrivateKeyArmored: string,
//     recipientPublicKeyArmored: string,
//   ) {
//     try {
//       // 1. Read the keys in parallel
//       const [recipientPublicKey, sharePrivateKey] = await Promise.all([
//         openpgp.readKey({ armoredKey: recipientPublicKeyArmored }),
//         openpgp.readPrivateKey({ armoredKey: sharePrivateKeyArmored }),
//       ]);

//       // 2. Decrypt the share key packet
//       const encryptedShareKeyPacket = await openpgp.readMessage({
//         armoredMessage: shareKeyPacket,
//       });

//       const decryptedShareKeyPacket = await openpgp.decrypt({
//         message: encryptedShareKeyPacket,
//         decryptionKeys: sharePrivateKey,
//       });

//       // 3. Get the share key data from the decrypted key packet
//       const shareKeyData = JSON.parse(decryptedShareKeyPacket.data as string);

//       // 4. Create a new recipient-specific key packet with the same session key
//       const recipientKeyPacketData = {
//         ...shareKeyData,
//         sharedWith: recipientPublicKey.getFingerprint(), // Recipient's fingerprint
//         sharedBy: sharePrivateKey.getFingerprint(), // Sharer's fingerprint
//         sharedAt: new Date().toISOString(),
//         id: shareKeyData.id || this.generateUniqueId(), // Preserve the original ID if possible
//       };

//       // 5. Encrypt the key packet using the recipient's public key
//       const recipientKeyPacket = await openpgp.encrypt({
//         message: await openpgp.createMessage({
//           text: JSON.stringify(recipientKeyPacketData),
//         }),
//         encryptionKeys: recipientPublicKey,
//         format: "armored",
//         config: {
//           preferredSymmetricAlgorithm: openpgp.enums.symmetric.aes256,
//         },
//       });

//       // 6. Sign the recipient's key packet with the share private key
//       const recipientKeyPacketSignature = await openpgp.sign({
//         message: await openpgp.createMessage({
//           text: recipientKeyPacket,
//         }),
//         signingKeys: sharePrivateKey,
//         detached: true,
//       });

//       // 7. Return the shared access information
//       return {
//         recipient_key_packet: recipientKeyPacket,
//         recipient_key_packet_signature: recipientKeyPacketSignature,
//         shared_at: new Date().toISOString(),
//         shared_by: sharePrivateKey.getUserIDs()[0],
//         shared_with: recipientPublicKey.getUserIDs()[0],
//       };
//     } catch (error: any) {
//       throw new Error(`Failed to share access with user: ${error.message}`);
//     }
//   }

//   /**
//    * Decrypt a folder or file private key using the hierarchical key chain
//    * @param encryptedKeyPacket The encrypted key packet containing the session key
//    * @param parentPrivateKey The parent's private key used to decrypt the key packet
//    * @param itemPrivateKeyArmored The encrypted private key of the item to be decrypted
//    */
//   async decryptItemPrivateKey(
//     encryptedKeyPacket: string,
//     parentPrivateKey: any,
//     itemPrivateKeyArmored: string,
//   ): Promise<any> {
//     try {
//       // First decrypt the key packet to get the session key
//       const keyPacketMessage = await openpgp.readMessage({
//         armoredMessage: encryptedKeyPacket,
//       });

//       const decryptedKeyPacket = await openpgp.decrypt({
//         message: keyPacketMessage,
//         decryptionKeys: parentPrivateKey,
//         format: "utf8",
//       });

//       // Parse the decrypted key packet to get the session key
//       const keyPacketData = JSON.parse(decryptedKeyPacket.data);
//       const sessionKey = keyPacketData.sessionKey;

//       // Now use the session key to decrypt the item's private key
//       return await openpgp.decryptKey({
//         privateKey: await openpgp.readPrivateKey({
//           armoredKey: itemPrivateKeyArmored,
//         }),
//         passphrase: sessionKey,
//       });
//     } catch (error: any) {
//       throw new Error(`Failed to decrypt item private key: ${error.message}`);
//     }
//   }

//   /**
//    * Calculate a secure hash of a folder or file name for lookup purposes
//    */
//   async calculateNameHash(name: string): Promise<string> {
//     try {
//       const normalizedName = name.toLowerCase().trim();

//       // Create a simple hash of just the name itself
//       const encoder = new TextEncoder();
//       const nameBytes = encoder.encode(normalizedName);

//       // Hash the name bytes
//       const hashBuffer = await crypto.subtle.digest("SHA-256", nameBytes);

//       // Convert to hex string
//       const hashArray = Array.from(new Uint8Array(hashBuffer));
//       const hashHex = hashArray
//         .map((byte) => byte.toString(16).padStart(2, "0"))
//         .join("");

//       return hashHex;
//     } catch (error) {
//       throw error;
//     }
//   }

//   /**
//    * Decrypt encrypted name using private key
//    * @param encryptedName The encrypted name
//    * @param privateKey The private key to decrypt with
//    */
//   async decryptName(encryptedName: string, privateKey: any): Promise<string> {
//     try {
//       const message = await openpgp.readMessage({
//         armoredMessage: encryptedName,
//       });

//       const decrypted = await openpgp.decrypt({
//         message,
//         decryptionKeys: privateKey,
//         format: "utf8",
//       });

//       return decrypted.data;
//     } catch (error) {
//       console.error("Failed to decrypt name:", error);
//       return "Unnamed Item";
//     }
//   }

//   /**
//    * Decrypts a thumbnail that was encrypted by the Rust Tauri application
//    * @param encryptedData - The encrypted thumbnail data
//    * @param contentKey - Base64-encoded AES key used for encryption
//    * @param mimeType - The MIME type of the thumbnail (defaults to image/jpeg)
//    * @returns A blob URL for the decrypted thumbnail
//    */
//   async decryptThumbnail(
//     encryptedData: ArrayBuffer | Uint8Array,
//     contentKey: string,
//     mimeType: string = "image/jpeg",
//   ): Promise<string> {
//     try {
//       // Create a fixed nonce matching the one used in Rust (all zeros)
//       const nonceBytes = new Uint8Array(12).fill(0);

//       // Convert the content key from base64 to a key object
//       const keyBytes = this.base64ToArrayBuffer(contentKey);

//       // Make sure we have the right key length for AES-256-GCM
//       if (keyBytes.byteLength !== 32) {
//         throw new Error(
//           `Invalid key length: ${keyBytes.byteLength} bytes. Expected 32 bytes.`,
//         );
//       }

//       // Import the key for use with Web Crypto API
//       const key = await window.crypto.subtle.importKey(
//         "raw",
//         keyBytes,
//         { name: "AES-GCM", length: 256 },
//         false,
//         ["decrypt"],
//       );

//       // Make sure we have a Uint8Array for the encrypted data
//       const encryptedBytes =
//         encryptedData instanceof Uint8Array
//           ? encryptedData
//           : new Uint8Array(encryptedData);

//       // Decrypt the data
//       const decryptedData = await window.crypto.subtle.decrypt(
//         {
//           name: "AES-GCM",
//           iv: nonceBytes,
//           tagLength: 128,
//         },
//         key,
//         encryptedBytes,
//       );

//       // Create a blob from the decrypted data
//       const blob = new Blob([decryptedData], { type: mimeType });

//       // Create and return a blob URL
//       return URL.createObjectURL(blob);
//     } catch (error) {
//       console.error("Thumbnail decryption failed:", error);
//       throw error;
//     }
//   }

//   /**
//    * Converts a base64 string to an ArrayBuffer
//    * @param base64 - Base64-encoded string
//    * @returns The decoded data as ArrayBuffer
//    */
//   base64ToArrayBuffer(base64: string): ArrayBuffer {
//     const binaryString = atob(base64);
//     const bytes = new Uint8Array(binaryString.length);
//     for (let i = 0; i < binaryString.length; i++) {
//       bytes[i] = binaryString.charCodeAt(i);
//     }
//     return bytes.buffer;
//   }

//   /**
//    * Decrypts a thumbnail URL by fetching and decrypting the data
//    * @param url - The URL to fetch the encrypted thumbnail from
//    * @param contentKey - Base64-encoded AES key used for encryption
//    * @param mimeType - The MIME type of the thumbnail
//    * @returns A blob URL for the decrypted thumbnail
//    */
//   async decryptThumbnailUrl(
//     url: string,
//     contentKey: string,
//     mimeType: string = "image/jpeg",
//   ): Promise<string> {
//     try {
//       // Fetch the encrypted data
//       const response = await fetch(url);

//       // Check if the fetch was successful
//       if (!response.ok) {
//         throw new Error(
//           `Failed to fetch thumbnail: ${response.status} ${response.statusText}`,
//         );
//       }

//       // Get the encrypted data as ArrayBuffer
//       const encryptedData = await response.arrayBuffer();

//       // Decrypt the data and return the blob URL
//       return await this.decryptThumbnail(encryptedData, contentKey, mimeType);
//     } catch (error) {
//       console.error("Failed to fetch and decrypt thumbnail:", error);
//       throw error;
//     }
//   }

//   /**
//    * Integrated function for use in processFile to handle thumbnail decryption
//    * @param thumbnailUrl - The URL to fetch the encrypted thumbnail from
//    * @param contentKey - Base64-encoded AES key used for encryption
//    * @param mimeType - The MIME type of the original file
//    * @returns A blob URL for the decrypted thumbnail or null if it fails
//    */
//   async processFileThumbnail(
//     thumbnailUrl: string,
//     contentKey: string,
//     mimeType?: string,
//   ): Promise<string | null> {
//     // Default to image/jpeg for thumbnails if not specified or if non-image type
//     const thumbnailMimeType =
//       mimeType && mimeType.startsWith("image/") ? mimeType : "image/jpeg";

//     try {
//       // Use the decryptThumbnailUrl function to fetch and decrypt
//       const blobUrl = await this.decryptThumbnailUrl(
//         thumbnailUrl,
//         contentKey,
//         thumbnailMimeType,
//       );
//       console.log("Thumbnail decrypted successfully");
//       return blobUrl;
//     } catch (error) {
//       console.error("Thumbnail processing failed:", error);
//       return null;
//     }
//   }
// }

// const keyManager = new KeyManager();
// export default keyManager;

import * as openpgp from "openpgp";
import { invoke } from "@tauri-apps/api/core";
import { ApiService } from "../services/ApiService";

interface KeyPair {
  publicKey: string;
  privateKey: string;
}

interface KeyInfo {
  version: number;
  passphrase: string;
  passphraseSignature: string;
  privateKey: string;
  publicKey: string;
  fingerprint: string;
}

interface SignupKeysResult {
  email: string;
  username: string;
  keys: KeyInfo;
  derivedKey: string;
  recoveryPhrase: string;
}

interface ShareKeys {
  name: string;
  hash: string;
  shareKey: string;
  sharePassphrase: string;
  sharePassphraseSignature: string;
  shareKeyPacket: string;
  keyPacketSignature: string;
  sessionKeySignature: string;
}

interface FolderKeys {
  shareId?: string;
  hash: string;
  name: string;
  nodePassphrase: string;
  nodePassphraseSignature: string;
  nodeKey: string;
  nodeHashKey: string;
  nodeHashKeySignature?: string;
}

interface FileKeys extends FolderKeys {
  contentKey: string;
  contentKeyPacket: string;
  contentKeySignature: string;
  xattrs: string;
}

/**
 * Cryptographic Worker Pool
 * Manages a pool of web workers for offloading heavy cryptographic operations
 * with a FIFO (first-in-first-out) queue system
 */
class CryptoWorkerPool {
  private workers: Worker[] = [];
  private taskQueue: {
    id: string;
    task: string;
    args: any;
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }[] = [];
  private activeTaskMap: Map<
    string,
    {
      workerId: number;
      resolve: (value: any) => void;
      reject: (error: Error) => void;
    }
  > = new Map();
  private taskCounter = 0;
  private workerIdleStatus: boolean[] = [];
  private processingQueue = false;

  constructor(numWorkers = navigator.hardwareConcurrency || 4) {
    // Create the worker script as a blob
    const workerScript = `
      importScripts('https://unpkg.com/openpgp@6.1.0/dist/openpgp.min.js');

      self.onmessage = async function(e) {
        const { id, task, args } = e.data;

        try {
          let result;

          // =========== COMBINED HIGH-LEVEL OPERATIONS ===========
          switch(task) {
            case 'generateKey':
              result = await openpgp.generateKey(args);
              break;

            case 'decryptPrivateKeyAndEncrypt':
              // All-in-one: decrypt private key and use it to encrypt
              const privKey = await openpgp.readPrivateKey({ armoredKey: args.privateKeyArmored });
              const decryptedKey = await openpgp.decryptKey({
                privateKey: privKey,
                passphrase: args.passphrase
              });

              // Create message
              let messageToEncrypt;
              if (args.text !== undefined) {
                messageToEncrypt = await openpgp.createMessage({ text: args.text });
              } else if (args.binary !== undefined) {
                messageToEncrypt = await openpgp.createMessage({ binary: args.binary });
              }

              // Determine encryption keys or password
              let encryptionKeys = undefined;
              if (args.usePublicKey) {
                encryptionKeys = decryptedKey.toPublic();
              }

              // Encrypt
              result = await openpgp.encrypt({
                message: messageToEncrypt,
                encryptionKeys: encryptionKeys,
                passwords: args.passwords,
                format: 'armored',
                config: args.config || {
                  preferredSymmetricAlgorithm: openpgp.enums.symmetric.aes256,
                  preferredCompressionAlgorithm: openpgp.enums.compression.zlib,
                }
              });
              break;

            case 'decryptPrivateKeyAndSign':
              // All-in-one: decrypt private key and use it to sign
              const signingKey = await openpgp.readPrivateKey({ armoredKey: args.privateKeyArmored });
              const decryptedSigningKey = await openpgp.decryptKey({
                privateKey: signingKey,
                passphrase: args.passphrase
              });

              // Create message
              let messageToSign;
              if (args.text !== undefined) {
                messageToSign = await openpgp.createMessage({ text: args.text });
              } else if (args.binary !== undefined) {
                messageToSign = await openpgp.createMessage({ binary: args.binary });
              }

              // Sign
              result = await openpgp.sign({
                message: messageToSign,
                signingKeys: decryptedSigningKey,
                detached: args.detached !== false,
                signingUserIDs: args.signingUserIDs
              });
              break;

            case 'decryptMessageWithPrivateKey':
              // All-in-one: decrypt private key and use it to decrypt a message
              const decryptingKey = await openpgp.readPrivateKey({ armoredKey: args.privateKeyArmored });
              const decryptedDecryptingKey = await openpgp.decryptKey({
                privateKey: decryptingKey,
                passphrase: args.passphrase
              });

              // Read message
              const messageToDecrypt = await openpgp.readMessage({ armoredMessage: args.armoredMessage });

              // Decrypt
              result = await openpgp.decrypt({
                message: messageToDecrypt,
                decryptionKeys: decryptedDecryptingKey,
                format: args.format || 'utf8'
              });
              break;

            case 'passwordEncrypt':
              // Only encrypts with password, no keys involved
              let msgForPassword;
              if (args.text !== undefined) {
                msgForPassword = await openpgp.createMessage({ text: args.text });
              } else if (args.binary !== undefined) {
                msgForPassword = await openpgp.createMessage({ binary: args.binary });
              }

              result = await openpgp.encrypt({
                message: msgForPassword,
                passwords: args.passwords,
                format: 'armored',
                config: args.config || {
                  preferredSymmetricAlgorithm: openpgp.enums.symmetric.aes256,
                  preferredCompressionAlgorithm: openpgp.enums.compression.zlib,
                }
              });
              break;

            case 'encryptForPublicKey':
              // Only encrypts for a public key, no private key operations
              const pubKey = await openpgp.readKey({ armoredKey: args.publicKeyArmored });

              let msgForPublic;
              if (args.text !== undefined) {
                msgForPublic = await openpgp.createMessage({ text: args.text });
              } else if (args.binary !== undefined) {
                msgForPublic = await openpgp.createMessage({ binary: args.binary });
              }

              result = await openpgp.encrypt({
                message: msgForPublic,
                encryptionKeys: pubKey,
                format: 'armored',
                config: args.config || {
                  preferredSymmetricAlgorithm: openpgp.enums.symmetric.aes256,
                  preferredCompressionAlgorithm: openpgp.enums.compression.zlib,
                }
              });
              break;

            case 'getPublicKey':
              // Extract public key from private key
              const privateKeyForPublic = await openpgp.readPrivateKey({ armoredKey: args.armoredKey });
              const publicKey = privateKeyForPublic.toPublic();
              result = await publicKey.armor();
              break;

            case 'verifySignature':
              // Verify a detached signature with a public key
              console.log(args);
              const msgToVerify = await openpgp.createMessage({ text: args.message });
              const signature = await openpgp.readSignature({ armoredSignature: args.signature });
              const verifyKey = await openpgp.readKey({ armoredKey: args.publicKeyArmored });

              const response = await openpgp.verify({
                message: msgToVerify,
                signature: signature,
                verificationKeys: verifyKey
              });

              result = JSON.stringify(response);
              break;

            default:
              throw new Error('Unknown task: ' + task);
          }

          // Send successful result back to main thread
          self.postMessage({ id, result, error: null });
        } catch (error) {
          // Send error back to main thread
          console.error('Worker error in task ' + task + ':', error);
          self.postMessage({ id, result: null, error: error.toString() });
        }
      };
    `;

    const blob = new Blob([workerScript], { type: "application/javascript" });
    const workerUrl = URL.createObjectURL(blob);

    // Create the worker pool
    for (let i = 0; i < numWorkers; i++) {
      const worker = new Worker(workerUrl);
      worker.onmessage = this.handleWorkerMessage.bind(this, i);
      this.workers.push(worker);
      this.workerIdleStatus.push(true); // all workers start as idle
    }

    // Clean up the URL
    URL.revokeObjectURL(workerUrl);
  }

  /**
   * Handle messages from workers
   */
  private handleWorkerMessage(workerId: number, event: MessageEvent) {
    const { id, result, error } = event.data;

    // Get the task from the active task map
    const task = this.activeTaskMap.get(id);
    if (!task) {
      console.warn("Received response for unknown task ID:", id);
      return;
    }

    // Remove the task from the active map
    this.activeTaskMap.delete(id);

    // Mark the worker as idle
    this.workerIdleStatus[workerId] = true;

    // Resolve or reject the promise
    if (error) {
      task.reject(new Error(error));
    } else {
      task.resolve(result);
    }

    // Process the next task in the queue
    this.processQueue();
  }

  /**
   * Process the task queue in FIFO order
   */
  private processQueue() {
    // Prevent concurrent queue processing
    if (this.processingQueue) return;
    this.processingQueue = true;

    try {
      // Process all possible tasks
      while (this.taskQueue.length > 0) {
        const idleWorkerIndex = this.workerIdleStatus.findIndex((idle) => idle);

        // If no workers are idle, stop processing until one becomes available
        if (idleWorkerIndex === -1) break;

        // Get the next task (FIFO)
        const nextTask = this.taskQueue.shift();
        if (!nextTask) break;

        // Mark the worker as busy
        this.workerIdleStatus[idleWorkerIndex] = false;

        // Store the task in the active map
        this.activeTaskMap.set(nextTask.id, {
          workerId: idleWorkerIndex,
          resolve: nextTask.resolve,
          reject: nextTask.reject,
        });

        // Send the task to the worker
        this.workers[idleWorkerIndex].postMessage({
          id: nextTask.id,
          task: nextTask.task,
          args: nextTask.args,
        });
      }
    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * Execute a task in a worker
   */
  async execute(task: string, args: any): Promise<any> {
    return new Promise((resolve, reject) => {
      // Generate a unique task ID
      const id = `task_${++this.taskCounter}`;

      // Add the task to the queue
      this.taskQueue.push({
        id,
        task,
        args,
        resolve,
        reject,
      });

      // Start processing the queue
      this.processQueue();
    });
  }

  /**
   * Terminate all workers and clean up
   */
  terminate() {
    this.workers.forEach((worker) => worker.terminate());
    this.workers = [];
    this.workerIdleStatus = [];
    this.taskQueue = [];
    this.activeTaskMap.clear();
  }
}

// Create a global worker pool
const cryptoWorkerPool = new CryptoWorkerPool();

class KeyManager {
  // Enhanced random bytes generation
  getRandomBytes = (size: number): Uint8Array => {
    // Increase entropy by combining multiple sources when possible
    const primary = new Uint8Array(size);
    window.crypto.getRandomValues(primary);

    // Add time-based entropy
    const timeEntropy = new Uint8Array(8);
    const now = Date.now();
    const perfNow = performance.now();

    // Use both Date.now() and performance.now() for better entropy
    new DataView(timeEntropy.buffer).setBigUint64(
      0,
      BigInt(Math.floor(now)) ^ BigInt(Math.floor(perfNow * 1000)),
    );

    // XOR the primary random values with the time entropy
    for (let i = 0; i < Math.min(size, 8); i++) {
      primary[i] ^= timeEntropy[i];
    }

    return primary;
  };

  // Improved SHA-256 function - keep in main thread as it's quick
  sha256 = async (buffer: Uint8Array | ArrayBuffer): Promise<Uint8Array> => {
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", buffer);
    return new Uint8Array(hashBuffer);
  };

  // Faster array concatenation - simple utility function stays in main thread
  concatArrays = (...arrays: Uint8Array[]): Uint8Array => {
    const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  };

  // Optimized BigInt to byte array conversion - stays in main thread as it's simple
  bigIntToByteArray = (bigInt: BigInt): Uint8Array => {
    // Convert BigInt to hex string, padded to even length
    const hex = bigInt.toString(16).padStart(2, "0");
    const len = Math.ceil(hex.length / 2);
    const array = new Uint8Array(len);

    // Process 2 characters (1 byte) at a time for better performance
    for (let i = 0; i < len; i++) {
      const bytePos = hex.length - i * 2 - 2;
      if (bytePos >= 0) {
        array[len - i - 1] = parseInt(hex.substring(bytePos, bytePos + 2), 16);
      } else {
        // Handle odd length hex strings
        array[len - i - 1] = parseInt(hex.charAt(0), 16);
      }
    }

    return array;
  };

  // Simple utility function - stays in main thread
  arrayToBase64(array: Uint8Array): string {
    return btoa(String.fromCharCode.apply(null, Array.from(array)));
  }

  // Simple utility function - stays in main thread
  base64ToArray(base64: string): Uint8Array {
    return new Uint8Array(
      atob(base64)
        .split("")
        .map((c) => c.charCodeAt(0)),
    );
  }

  // Simple utility function - stays in main thread
  hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
  }

  // Main thread function since it calls Tauri invoke
  async hashPassword(
    password: string,
    salt: string,
  ): Promise<{
    seed: string;
  }> {
    try {
      // Call Rust backend to hash password with Argon2
      const result = await invoke<{
        seed: string;
      }>("derive_seed_from_password", {
        password,
        saltHex: salt,
      });

      // Transform the result to match the expected format in frontend
      return {
        seed: result.seed,
      };
    } catch (error) {
      throw new Error("Password hashing failed");
    }
  }

  // Main thread function for Tauri invoke
  generateRecoveryKey = async (): Promise<{
    recoveryPhrase: string;
    seed: string;
  }> => {
    const result = await invoke<{
      recovery_phrase: string;
      seed: string;
    }>("generate_recovery_phrase");

    return {
      recoveryPhrase: result.recovery_phrase,
      seed: result.seed,
    };
  };

  // Simple unique ID generator - stays in main thread
  private generateUniqueId(): string {
    // Generate a timestamp-based ID with random component
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `${timestamp}-${random}`;
  }

  // Enhanced random session key generation - simple, stays in main thread
  generateRandomSessionKey = () => {
    // Generate 32 bytes (256 bits) for stronger session key
    const array = this.getRandomBytes(32);
    return this.arrayToBase64(array);
  };

  /**
   * Calculate a secure hash of a folder or file name for lookup purposes
   * Single crypto operation, kept in main thread
   */
  async calculateNameHash(name: string): Promise<string> {
    try {
      const normalizedName = name.toLowerCase().trim();

      // Create a simple hash of just the name itself
      const encoder = new TextEncoder();
      const nameBytes = encoder.encode(normalizedName);

      // Hash the name bytes
      const hashBuffer = await crypto.subtle.digest("SHA-256", nameBytes);

      // Convert to hex string
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");

      return hashHex;
    } catch (error) {
      throw error;
    }
  }

  // Offload key generation to worker - already self-contained
  async generateKeys(
    username: string,
    email: string,
    config?: {
      passphrase?: string;
    },
  ): Promise<KeyPair> {
    const passphrase = config?.passphrase; // Optional passphrase

    // Offload the heavy key generation to worker
    return cryptoWorkerPool.execute("generateKey", {
      type: "ecc",
      curve: "ed25519Legacy",
      userIDs: [{ name: username, email: email }],
      format: "armored",
      ...(passphrase ? { passphrase } : {}),
    });
  }

  // Uses workers with the new combined operations
  async generateSignupKeys(
    email: string,
    username: string,
    password: string,
    salt: string,
  ): Promise<SignupKeysResult> {
    if (!email || !password) {
      throw new Error("Missing required parameters for key generation");
    }

    try {
      // Start multiple operations in parallel
      const passwordSeedPromise = this.hashPassword(password, salt);
      const recoveryKeyPromise = this.generateRecoveryKey();

      // Await the promises in parallel
      const [{ seed: passwordSeed }, { recoveryPhrase, seed: recoverySeed }] =
        await Promise.all([passwordSeedPromise, recoveryKeyPromise]);

      // Generate user keys with the master key (worker)
      const userKeyPair = await this.generateKeys(username, email, {
        passphrase: passwordSeed,
      });

      // Use the new combined encrypt operation - decrypt key and encrypt in one worker call
      const encryptResult = await cryptoWorkerPool.execute(
        "decryptPrivateKeyAndEncrypt",
        {
          privateKeyArmored: userKeyPair.privateKey,
          passphrase: passwordSeed,
          text: `${passwordSeed}_${recoverySeed}`,
          passwords: [passwordSeed, recoverySeed],
          config: {
            preferredSymmetricAlgorithm: openpgp.enums.symmetric.aes256,
            preferredCompressionAlgorithm: openpgp.enums.compression.zlib,
          },
        },
      );

      // Use the new combined sign operation - decrypt key and sign in one worker call
      const signatureResult = await cryptoWorkerPool.execute(
        "decryptPrivateKeyAndSign",
        {
          privateKeyArmored: userKeyPair.privateKey,
          passphrase: passwordSeed,
          text: encryptResult,
          signingUserIDs: [{ name: username, email: email }],
          detached: true,
        },
      );

      // Get the public key
      const publicKey = await cryptoWorkerPool.execute("getPublicKey", {
        armoredKey: userKeyPair.privateKey,
      });

      // Get the fingerprint separately
      const fingerprint = await this.calculateKeyFingerprint(publicKey);

      return {
        email,
        username,
        keys: {
          version: 1,
          privateKey: userKeyPair.privateKey,
          passphrase: encryptResult,
          passphraseSignature: signatureResult,
          publicKey: publicKey,
          fingerprint: fingerprint,
        },
        derivedKey: passwordSeed,
        recoveryPhrase,
      };
    } catch (error: any) {
      throw new Error(`Failed to generate signup keys: ${error.message}`);
    }
  }

  // Helper for calculating key fingerprint - should be compact, no worker needed
  async calculateKeyFingerprint(publicKeyArmored: string): Promise<string> {
    try {
      // Get key as binary
      let publicKey = publicKeyArmored;
      // Remove header, footer, and whitespace to get base64
      publicKey = publicKey.replace(/-----.*?-----|\s+/g, "");
      // Decode base64
      const binaryKey = atob(publicKey);
      // Convert to Uint8Array
      const keyBytes = new Uint8Array(binaryKey.length);
      for (let i = 0; i < binaryKey.length; i++) {
        keyBytes[i] = binaryKey.charCodeAt(i);
      }

      // Hash the key
      const hashBuffer = await crypto.subtle.digest("SHA-1", keyBytes);

      // Convert to hex string
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();
    } catch (error) {
      console.error("Failed to calculate fingerprint:", error);
      return "";
    }
  }

  // Uses workers with the new combined operations
  async generateRecoveryFile(
    passwordSeed: string,
    salt: string,
    privateKeyArmored: string,
    username: string,
    email: string,
  ): Promise<{
    recoverySecret: string;
    recoveryKey: string;
    recoveryKeySignature: string;
  }> {
    // Simple operations stay in main thread
    const array = this.getRandomBytes(32);
    const recoverySecret = this.arrayToBase64(array);

    // Uses main thread for invoke call
    const { seed } = await this.hashPassword(
      JSON.stringify(`${username} + '_' + '${email}' + '_' + ''`),
      salt,
    );

    // Use combined worker operation for encryption
    const passphraseEncrypted = await cryptoWorkerPool.execute(
      "decryptPrivateKeyAndEncrypt",
      {
        privateKeyArmored: privateKeyArmored,
        passphrase: passwordSeed,
        text: passwordSeed,
        passwords: [seed],
        config: {
          preferredSymmetricAlgorithm: openpgp.enums.symmetric.aes256,
          preferredCompressionAlgorithm: openpgp.enums.compression.zlib,
        },
      },
    );

    // Use combined worker operation for signing
    const passphraseEncryptedSignature = await cryptoWorkerPool.execute(
      "decryptPrivateKeyAndSign",
      {
        privateKeyArmored: privateKeyArmored,
        passphrase: passwordSeed,
        text: passphraseEncrypted,
        signingUserIDs: [{ name: username, email: email }],
        detached: true,
      },
    );

    return {
      recoverySecret: recoverySecret,
      recoveryKey: passphraseEncrypted,
      recoveryKeySignature: passphraseEncryptedSignature,
    };
  }

  /**
   * Generate initial drive share keys with hierarchical encryption
   * Uses the new combined worker operations
   */
  async generateInitialDriveShareKeys(
    name: string,
    user: User,
    derivedKey: string,
  ): Promise<ShareKeys> {
    try {
      const findActiveUserKeys = user.keys.find(
        (key) => key.primary && key.active,
      );

      // Generate session keys (simple operation in main thread)
      const sessionKey = this.generateRandomSessionKey();
      const shareSessionKey = this.generateRandomSessionKey();

      const keyPacketObj = {
        sessionKey,
        created: new Date().toISOString(),
        version: 1,
        entropy: this.generateRandomSessionKey(),
        id: this.generateUniqueId(),
      };

      const shareKeyPacketObj = {
        shareSessionKey,
        created: new Date().toISOString(),
        version: 1,
        entropy: this.generateRandomSessionKey(),
        id: this.generateUniqueId(),
      };

      // Start parallel operations
      const shareKeyPairPromise = this.generateKeys(user.username, user.email, {
        passphrase: sessionKey,
      });

      const nameHashPromise = this.calculateNameHash(name);

      // Wait for key pair generation
      const [shareKeyPair, nameHash] = await Promise.all([
        shareKeyPairPromise,
        nameHashPromise,
      ]);

      // Encrypt the name using combined operation
      const encryptedName = await cryptoWorkerPool.execute(
        "decryptPrivateKeyAndEncrypt",
        {
          privateKeyArmored: shareKeyPair.privateKey,
          passphrase: sessionKey,
          text: name,
          usePublicKey: true,
          config: {
            preferredSymmetricAlgorithm: openpgp.enums.symmetric.aes256,
            preferredCompressionAlgorithm: openpgp.enums.compression.zlib,
          },
        },
      );

      // Encrypt the key packet using combined operation
      const keyPacket = await cryptoWorkerPool.execute(
        "decryptPrivateKeyAndEncrypt",
        {
          privateKeyArmored: findActiveUserKeys?.privateKey,
          passphrase: derivedKey,
          text: JSON.stringify(keyPacketObj),
          usePublicKey: true,
          config: {
            preferredSymmetricAlgorithm: openpgp.enums.symmetric.aes256,
            preferredCompressionAlgorithm: openpgp.enums.compression.zlib,
          },
        },
      );

      // Encrypt and sign the share passphrase using combined operation
      const sharePassphraseResult = await cryptoWorkerPool.execute(
        "decryptPrivateKeyAndEncrypt",
        {
          privateKeyArmored: shareKeyPair.privateKey,
          passphrase: sessionKey,
          text: JSON.stringify(shareKeyPacketObj),
          usePublicKey: true,
          config: {
            preferredSymmetricAlgorithm: openpgp.enums.symmetric.aes256,
            preferredCompressionAlgorithm: openpgp.enums.compression.zlib,
          },
        },
      );

      // Sign the share passphrase
      const sharePassphraseSignature = await cryptoWorkerPool.execute(
        "decryptPrivateKeyAndSign",
        {
          privateKeyArmored: shareKeyPair.privateKey,
          passphrase: sessionKey,
          text: sharePassphraseResult,
          signingUserIDs: [{ name: user.username, email: user.email }],
          detached: true,
        },
      );

      // Sign the key packet using combined operation
      const keyPacketSignature = await cryptoWorkerPool.execute(
        "decryptPrivateKeyAndSign",
        {
          privateKeyArmored: findActiveUserKeys?.privateKey,
          passphrase: derivedKey,
          text: keyPacket,
          signingUserIDs: [{ name: user.username, email: user.email }],
          detached: true,
        },
      );

      // Sign the session key using combined operation
      const sessionKeySignature = await cryptoWorkerPool.execute(
        "decryptPrivateKeyAndSign",
        {
          privateKeyArmored: findActiveUserKeys?.privateKey,
          passphrase: derivedKey,
          text: sessionKey,
          signingUserIDs: [{ name: user.username, email: user.email }],
          detached: true,
        },
      );

      return {
        name: encryptedName,
        hash: nameHash,
        shareKey: shareKeyPair.privateKey,
        sharePassphrase: sharePassphraseResult,
        sharePassphraseSignature: sharePassphraseSignature,
        shareKeyPacket: keyPacket,
        keyPacketSignature: keyPacketSignature,
        sessionKeySignature: sessionKeySignature,
      };
    } catch (error: any) {
      throw new Error(`Failed to generate drive keys: ${error.message}`);
    }
  }

  /**
   * Generate root folder keys with hierarchical encryption
   * Uses the new combined worker operations
   */
  async generateRootFolderKeys(
    name: string,
    user: User,
    derivedKey: string,
  ): Promise<FolderKeys> {
    try {
      // Get user's shares
      const sharesResponse = await ApiService.getShares();
      if (!sharesResponse?.shares?.length) {
        throw new Error("Share not found");
      }

      // Get primary share
      const primaryShare = sharesResponse.shares.find(
        (share) => share.type === 1,
      );
      const shareId = primaryShare.id;

      // Get share details
      const shareDetails = await ApiService.getSharesById(shareId);
      if (!shareDetails?.share || !shareDetails?.share.memberships) {
        throw new Error("Share user membership not found");
      }

      const share = shareDetails.share;
      const members = shareDetails.share.memberships;

      // Find current user's member entry
      const currentUserId = user.id;
      const userMember = members.find(
        (member) =>
          member.userId === currentUserId || member.memberId === currentUserId,
      );

      if (!userMember || !userMember.keyPacket) {
        throw new Error("Share membership data not found");
      }

      // Get user's primary key
      const primaryKey = user.keys.find((key: any) => key.primary);
      if (!primaryKey?.privateKey) {
        throw new Error("User data not found");
      }

      // Start operations that can be handled in main thread
      const nameHashPromise = this.calculateNameHash(name);
      const nodeHashKeyBuffer = this.getRandomBytes(32);
      const rootSessionKey = this.generateRandomSessionKey();

      // Decrypt the user's key packet using combined operation
      const decryptedKeyPacketResult = await cryptoWorkerPool.execute(
        "decryptMessageWithPrivateKey",
        {
          privateKeyArmored: primaryKey.privateKey,
          passphrase: derivedKey,
          armoredMessage: userMember.keyPacket,
          format: "utf8",
        },
      );

      // Parse the key packet data
      const keyPacketData = JSON.parse(decryptedKeyPacketResult.data);
      const sessionKey = keyPacketData.sessionKey;

      // Decrypt the share passphrase using combined operation
      const decryptedSharePassphraseResult = await cryptoWorkerPool.execute(
        "decryptMessageWithPrivateKey",
        {
          privateKeyArmored: share.shareKey,
          passphrase: sessionKey,
          armoredMessage: share.sharePassphrase,
          format: "utf8",
        },
      );

      // Parse the share key packet data
      const shareKeyPacketData = JSON.parse(
        decryptedSharePassphraseResult.data,
      );
      const shareSessionKey = shareKeyPacketData.shareSessionKey;

      // Create a root folder key packet
      const rootKeyPacketData = {
        sessionKey: rootSessionKey,
        shareKeyPacketId: shareKeyPacketData.id || this.generateUniqueId(),
        created: new Date().toISOString(),
        version: 1,
        keyType: "root",
        id: this.generateUniqueId(),
      };

      // Generate root key pair - this is already high-level
      const rootKeyPair = await this.generateKeys(user.username, user.email, {
        passphrase: rootSessionKey,
      });

      // Get the name hash
      const nameHash = await nameHashPromise;

      // Encrypt the key packet with the node hash key
      const rootKeyPacket = await cryptoWorkerPool.execute("passwordEncrypt", {
        text: JSON.stringify(rootKeyPacketData),
        passwords: [this.arrayToBase64(nodeHashKeyBuffer)],
        config: {
          preferredSymmetricAlgorithm: openpgp.enums.symmetric.aes256,
          preferredCompressionAlgorithm: openpgp.enums.compression.zlib,
        },
      });

      // Encrypt the name using the root key pair
      const encryptedName = await cryptoWorkerPool.execute(
        "decryptPrivateKeyAndEncrypt",
        {
          privateKeyArmored: rootKeyPair.privateKey,
          passphrase: rootSessionKey,
          text: name,
          usePublicKey: true,
          config: {
            preferredSymmetricAlgorithm: openpgp.enums.symmetric.aes256,
            preferredCompressionAlgorithm: openpgp.enums.compression.zlib,
          },
        },
      );

      // Encrypt the node hash key with the share session key
      const nodeHashKey = await cryptoWorkerPool.execute("passwordEncrypt", {
        binary: nodeHashKeyBuffer,
        passwords: [shareSessionKey],
        config: {
          preferredSymmetricAlgorithm: openpgp.enums.symmetric.aes256,
          preferredCompressionAlgorithm: openpgp.enums.compression.zlib,
        },
      });

      // Sign the root key packet
      const rootKeyPacketSignature = await cryptoWorkerPool.execute(
        "decryptPrivateKeyAndSign",
        {
          privateKeyArmored: rootKeyPair.privateKey,
          passphrase: rootSessionKey,
          text: rootKeyPacket,
          signingUserIDs: [{ name: user.username, email: user.email }],
          detached: true,
        },
      );

      // Sign the node hash key
      const nodeHashKeySignature = await cryptoWorkerPool.execute(
        "decryptPrivateKeyAndSign",
        {
          privateKeyArmored: share.shareKey,
          passphrase: sessionKey,
          text: nodeHashKey,
          signingUserIDs: [{ name: user.username, email: user.email }],
          detached: true,
        },
      );

      // Return the complete root folder keys object
      return {
        shareId: share.id,
        name: encryptedName,
        hash: nameHash,
        nodePassphrase: rootKeyPacket,
        nodePassphraseSignature: rootKeyPacketSignature,
        nodeKey: rootKeyPair.privateKey,
        nodeHashKey: nodeHashKey,
        nodeHashKeySignature: nodeHashKeySignature,
      };
    } catch (error: any) {
      throw new Error(`Failed to generate root folder keys: ${error.message}`);
    }
  }

  /**
   * Generate subfolder or file keys with hierarchical encryption
   * Uses the new combined worker operations
   */
  async generateSubFolderKeys(
    name: string,
    email: string,
    username: string,
    parentPrivateKey: string,
    parentPrivateKeyDecryptedArmored: string,
    parentKeyPacket: string,
    parentPassphraseSignature: string,
    parentSessionKey: string,
    parentKeyPacketId: string,
    xattrs: string = "",
    isFile: boolean = false,
  ): Promise<FolderKeys | FileKeys> {
    try {
      // Start with operations that don't depend on each other
      const nameHashPromise = this.calculateNameHash(name);

      // Generate new session key in main thread
      const itemSessionKey = this.generateRandomSessionKey();

      // Generate new keypair in worker
      const itemKeyPair = await this.generateKeys(username, email, {
        passphrase: itemSessionKey,
      });

      // Only verify signature if provided
      if (parentPassphraseSignature) {
        // Get the public key from the parent private key
        const parentPublicKey = await cryptoWorkerPool.execute("getPublicKey", {
          armoredKey: parentPrivateKeyDecryptedArmored,
        });

        // Verify the signature
        const response = await cryptoWorkerPool.execute("verifySignature", {
          message: parentKeyPacket,
          signature: parentPassphraseSignature,
          publicKeyArmored: parentPublicKey,
        });

        const verifyResult = JSON.parse(response);

        const signatureValid = verifyResult.signatures[0].verified;
        if (!signatureValid) {
          throw new Error("Parent key packet signature verification failed");
        }
      }

      // Create a new key packet (simple operation)
      const itemKeyPacketData = {
        sessionKey: itemSessionKey,
        parentKeyPacketId: parentKeyPacketId || this.generateUniqueId(),
        created: new Date().toISOString(),
        version: 1,
        keyType: isFile ? "file" : "folder",
        id: this.generateUniqueId(),
      };

      // Get the public key from the item's private key
      const itemPublicKey = await cryptoWorkerPool.execute("getPublicKey", {
        armoredKey: itemKeyPair.privateKey,
      });

      // Get name hash result
      const nameHash = await nameHashPromise;

      // Encrypt the name with the item's public key - this stays the same for both files and folders
      const encryptedName = await cryptoWorkerPool.execute(
        "encryptForPublicKey",
        {
          publicKeyArmored: itemPublicKey,
          text: name,
          config: {
            preferredSymmetricAlgorithm: openpgp.enums.symmetric.aes256,
            preferredCompressionAlgorithm: openpgp.enums.compression.zlib,
          },
        },
      );

      // DIFFERENT HANDLING FOR FILES AND FOLDERS
      if (isFile) {
        // For files: use contentKey for hierarchical relationship
        // Generate content key as a random session key
        const contentKey = this.generateRandomSessionKey();

        // Encrypt the nodePassphrase (item key packet) with the content key
        const itemKeyPacket = await cryptoWorkerPool.execute(
          "passwordEncrypt",
          {
            text: JSON.stringify(itemKeyPacketData),
            passwords: [contentKey],
            config: {
              preferredSymmetricAlgorithm: openpgp.enums.symmetric.aes256,
              preferredCompressionAlgorithm: openpgp.enums.compression.zlib,
            },
          },
        );

        // Encrypt the content key with parent's session key - important hierarchical relationship
        const contentKeyPacket = await cryptoWorkerPool.execute(
          "passwordEncrypt",
          {
            text: contentKey,
            passwords: [parentSessionKey],
            config: {
              preferredSymmetricAlgorithm: openpgp.enums.symmetric.aes256,
              preferredCompressionAlgorithm: openpgp.enums.compression.zlib,
            },
          },
        );

        // Sign the key packet with the item's private key
        const itemKeyPacketSignature = await cryptoWorkerPool.execute(
          "decryptPrivateKeyAndSign",
          {
            privateKeyArmored: itemKeyPair.privateKey,
            passphrase: itemSessionKey,
            text: itemKeyPacket,
            signingUserIDs: [{ name: username, email: email }],
            detached: true,
          },
        );

        // Sign the content key with parent's private key - ensures parent authorizes the file
        const contentKeySignature = await cryptoWorkerPool.execute(
          "decryptPrivateKeyAndSign",
          {
            privateKeyArmored: parentPrivateKeyDecryptedArmored,
            passphrase: parentSessionKey,
            text: contentKeyPacket,
            signingUserIDs: [{ name: username, email: email }],
            detached: true,
          },
        );

        // Handle xattrs encryption if provided - using item's session key
        let encryptedXattrs = "";
        if (xattrs) {
          encryptedXattrs = await cryptoWorkerPool.execute("passwordEncrypt", {
            text: xattrs,
            passwords: [itemSessionKey],
            config: {
              preferredSymmetricAlgorithm: openpgp.enums.symmetric.aes128,
            },
          });
        }

        // Create the file keys object - WITHOUT nodeHashKey and nodeHashKeySignature
        const fileKeys = {
          hash: nameHash,
          name: encryptedName,
          nodePassphrase: itemKeyPacket,
          nodePassphraseSignature: itemKeyPacketSignature,
          nodeKey: itemKeyPair.privateKey,
          contentKey: contentKey,
          contentKeyPacket: contentKeyPacket,
          contentKeySignature: contentKeySignature,
          xattrs: encryptedXattrs,
        } as FileKeys;

        return fileKeys;
      } else {
        // FOR FOLDERS: use nodeHashKey for hierarchical relationship
        // Generate nodeHashKey as a random session key
        const nodeHashKey = this.generateRandomSessionKey();

        // Encrypt the key packet with the nodeHashKey
        const itemKeyPacket = await cryptoWorkerPool.execute(
          "passwordEncrypt",
          {
            text: JSON.stringify(itemKeyPacketData),
            passwords: [nodeHashKey],
            config: {
              preferredSymmetricAlgorithm: openpgp.enums.symmetric.aes256,
              preferredCompressionAlgorithm: openpgp.enums.compression.zlib,
            },
          },
        );

        // Encrypt the nodeHashKey with parent's session key
        const encryptedNodeHashKey = await cryptoWorkerPool.execute(
          "passwordEncrypt",
          {
            text: nodeHashKey,
            passwords: [parentSessionKey],
            config: {
              preferredSymmetricAlgorithm: openpgp.enums.symmetric.aes256,
              preferredCompressionAlgorithm: openpgp.enums.compression.zlib,
            },
          },
        );

        // Sign the key packet with the folder's private key
        const itemKeyPacketSignature = await cryptoWorkerPool.execute(
          "decryptPrivateKeyAndSign",
          {
            privateKeyArmored: itemKeyPair.privateKey,
            passphrase: itemSessionKey,
            text: itemKeyPacket,
            signingUserIDs: [{ name: username, email: email }],
            detached: true,
          },
        );

        // Sign the nodeHashKey with the parent's private key
        const nodeHashKeySignature = await cryptoWorkerPool.execute(
          "decryptPrivateKeyAndSign",
          {
            privateKeyArmored: parentPrivateKey,
            passphrase: parentSessionKey,
            text: encryptedNodeHashKey,
            signingUserIDs: [{ name: username, email: email }],
            detached: true,
          },
        );

        // Build the folder keys object - WITH nodeHashKey and nodeHashKeySignature
        const folderKeys: FolderKeys = {
          hash: nameHash,
          name: encryptedName,
          nodePassphrase: itemKeyPacket,
          nodePassphraseSignature: itemKeyPacketSignature,
          nodeKey: itemKeyPair.privateKey,
          nodeHashKey: encryptedNodeHashKey,
          nodeHashKeySignature: nodeHashKeySignature,
        };

        return folderKeys;
      }
    } catch (error: any) {
      throw new Error(
        `Failed to generate subfolder/file keys: ${error.message}`,
      );
    }
  }

  /**
   * File keys generation - wrapper around generateSubFolderKeys
   * Sets isFile=true
   */
  async generateFileKeys(
    name: string,
    email: string,
    username: string,
    parentPrivateKey: string,
    parentPrivateKeyDecryptedArmored: string,
    parentKeyPacket: string,
    parentPassphraseSignature: string,
    parentSessionKey: string,
    parentKeyPacketId: string,
    xattrs: string = "",
  ): Promise<FileKeys> {
    return this.generateSubFolderKeys(
      name,
      email,
      username,
      parentPrivateKey,
      parentPrivateKeyDecryptedArmored,
      parentKeyPacket,
      parentPassphraseSignature,
      parentSessionKey,
      parentKeyPacketId,
      xattrs,
      true, // Set isFile to true
    ) as Promise<FileKeys>;
  }

  /**
   * Share access with another user by re-encrypting the share key packet
   * Uses the new combined worker operations
   */
  async shareAccessWithUser(
    shareKeyPacket: string,
    sharePrivateKeyArmored: string,
    sharePrivateKeyPassphrase: string,
    recipientPublicKeyArmored: string,
  ) {
    try {
      // Decrypt the share key packet with the share private key
      const decryptedShareKeyPacket = await cryptoWorkerPool.execute(
        "decryptMessageWithPrivateKey",
        {
          privateKeyArmored: sharePrivateKeyArmored,
          passphrase: sharePrivateKeyPassphrase,
          armoredMessage: shareKeyPacket,
          format: "utf8",
        },
      );

      // Parse key data (simple operation)
      const shareKeyData = JSON.parse(decryptedShareKeyPacket.data);

      // Get fingerprints
      const recipientFingerprint = await this.calculateKeyFingerprint(
        recipientPublicKeyArmored,
      );
      const sharerFingerprint = await this.calculateKeyFingerprint(
        await cryptoWorkerPool.execute("getPublicKey", {
          armoredKey: sharePrivateKeyArmored,
        }),
      );

      // Get user IDs
      const sharerUIDs = await this.extractUserIDs(sharePrivateKeyArmored);
      const recipientUIDs = await this.extractUserIDs(
        recipientPublicKeyArmored,
      );

      // Create a new key packet for the recipient
      const recipientKeyPacketData = {
        ...shareKeyData,
        sharedWith: recipientFingerprint,
        sharedBy: sharerFingerprint,
        sharedAt: new Date().toISOString(),
        id: shareKeyData.id || this.generateUniqueId(),
      };

      // Encrypt the key packet for the recipient's public key
      const recipientKeyPacket = await cryptoWorkerPool.execute(
        "encryptForPublicKey",
        {
          publicKeyArmored: recipientPublicKeyArmored,
          text: JSON.stringify(recipientKeyPacketData),
          config: {
            preferredSymmetricAlgorithm: openpgp.enums.symmetric.aes256,
            preferredCompressionAlgorithm: openpgp.enums.compression.zlib,
          },
        },
      );

      // Sign the encrypted key packet
      const recipientKeyPacketSignature = await cryptoWorkerPool.execute(
        "decryptPrivateKeyAndSign",
        {
          privateKeyArmored: sharePrivateKeyArmored,
          passphrase: sharePrivateKeyPassphrase,
          text: recipientKeyPacket,
          detached: true,
        },
      );

      // Return the shared access information
      return {
        recipientKeyPacket: recipientKeyPacket,
        recipientKeyPacketSignature: recipientKeyPacketSignature,
        sharedAt: new Date().toISOString(),
        sharedBy: sharerUIDs[0],
        sharedWith: recipientUIDs[0],
      };
    } catch (error: any) {
      throw new Error(`Failed to share access with user: ${error.message}`);
    }
  }

  // Helper method to extract user IDs from a key
  async extractUserIDs(armoredKey: string): Promise<string[]> {
    // Simple parsing to extract user IDs without passing through worker
    try {
      const matches = armoredKey.match(/uid\s+([^\r\n]+)/g);
      if (matches) {
        return matches.map((m) => m.replace(/^uid\s+/, "").trim());
      }
      // If no UIDs found through regex, fall back to a default value
      return ["Unknown User"];
    } catch (error) {
      console.error("Failed to extract UIDs:", error);
      return ["Unknown User"];
    }
  }

  /**
   * Decrypt a folder or file private key using the hierarchical key chain
   * Uses the new combined worker operations
   */
  async decryptItemPrivateKey(
    encryptedKeyPacket: string,
    parentPrivateKeyArmored: string,
    parentPrivateKeyPassphrase: string,
    itemPrivateKeyArmored: string,
  ): Promise<string> {
    try {
      // Decrypt the key packet to get the session key
      const decryptedKeyPacket = await cryptoWorkerPool.execute(
        "decryptMessageWithPrivateKey",
        {
          privateKeyArmored: parentPrivateKeyArmored,
          passphrase: parentPrivateKeyPassphrase,
          armoredMessage: encryptedKeyPacket,
          format: "utf8",
        },
      );

      // Parse the key packet and get the session key
      const keyPacketData = JSON.parse(decryptedKeyPacket.data);
      const sessionKey = keyPacketData.sessionKey;

      // Get the decrypted private key
      return cryptoWorkerPool.execute("readPrivateKeyDecryptAndGetPublic", {
        armoredKey: itemPrivateKeyArmored,
        passphrase: sessionKey,
      });
    } catch (error: any) {
      throw new Error(`Failed to decrypt item private key: ${error.message}`);
    }
  }

  /**
   * Decrypt encrypted name using private key
   * Uses the new combined worker operations
   */
  async decryptName(
    encryptedName: string,
    privateKeyArmored: string,
    privateKeyPassphrase: string,
  ): Promise<string> {
    try {
      // Decrypt the name using the combined operation
      const decryptedResult = await cryptoWorkerPool.execute(
        "decryptMessageWithPrivateKey",
        {
          privateKeyArmored: privateKeyArmored,
          passphrase: privateKeyPassphrase,
          armoredMessage: encryptedName,
          format: "utf8",
        },
      );

      return decryptedResult.data;
    } catch (error) {
      console.error("Failed to decrypt name:", error);
      return "Unnamed Item";
    }
  }

  /**
   * Decrypts a thumbnail that was encrypted by the Rust Tauri application
   * Uses WebCrypto API, kept in main thread as it's optimized
   */
  async decryptThumbnail(
    encryptedData: ArrayBuffer | Uint8Array,
    contentKey: string,
    mimeType: string = "image/jpeg",
  ): Promise<string> {
    try {
      // Create a fixed nonce matching the one used in Rust (all zeros)
      const nonceBytes = new Uint8Array(12).fill(0);

      // Convert the content key from base64 to a key object
      const keyBytes = this.base64ToArrayBuffer(contentKey);

      // Make sure we have the right key length for AES-256-GCM
      if (keyBytes.byteLength !== 32) {
        throw new Error(
          `Invalid key length: ${keyBytes.byteLength} bytes. Expected 32 bytes.`,
        );
      }

      // Import the key for use with Web Crypto API
      const key = await window.crypto.subtle.importKey(
        "raw",
        keyBytes,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"],
      );

      // Make sure we have a Uint8Array for the encrypted data
      const encryptedBytes =
        encryptedData instanceof Uint8Array
          ? encryptedData
          : new Uint8Array(encryptedData);

      // Decrypt the data
      const decryptedData = await window.crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: nonceBytes,
          tagLength: 128,
        },
        key,
        encryptedBytes,
      );

      // Create a blob from the decrypted data
      const blob = new Blob([decryptedData], { type: mimeType });

      // Create and return a blob URL
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error("Thumbnail decryption failed:", error);
      throw error;
    }
  }

  /**
   * Converts a base64 string to an ArrayBuffer
   * Simple utility, stays in main thread
   */
  base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Decrypts a thumbnail URL by fetching and decrypting the data
   * Network and simple operations, stays in main thread
   */
  async decryptThumbnailUrl(
    url: string,
    contentKey: string,
    mimeType: string = "image/jpeg",
  ): Promise<string> {
    try {
      // Fetch the encrypted data
      const response = await fetch(url);

      // Check if the fetch was successful
      if (!response.ok) {
        throw new Error(
          `Failed to fetch thumbnail: ${response.status} ${response.statusText}`,
        );
      }

      // Get the encrypted data as ArrayBuffer
      const encryptedData = await response.arrayBuffer();

      // Decrypt the data and return the blob URL
      return await this.decryptThumbnail(encryptedData, contentKey, mimeType);
    } catch (error) {
      console.error("Failed to fetch and decrypt thumbnail:", error);
      throw error;
    }
  }

  /**
   * Integrated function for use in processFile to handle thumbnail decryption
   */
  async processFileThumbnail(
    thumbnailUrl: string,
    contentKey: string,
    mimeType?: string,
  ): Promise<string | null> {
    // Default to image/jpeg for thumbnails if not specified or if non-image type
    const thumbnailMimeType =
      mimeType && mimeType.startsWith("image/") ? mimeType : "image/jpeg";

    try {
      // Use the decryptThumbnailUrl function to fetch and decrypt
      const blobUrl = await this.decryptThumbnailUrl(
        thumbnailUrl,
        contentKey,
        thumbnailMimeType,
      );
      console.log("Thumbnail decrypted successfully");
      return blobUrl;
    } catch (error) {
      console.error("Thumbnail processing failed:", error);
      return null;
    }
  }
}

// Create a single instance of the KeyManager
const keyManager = new KeyManager();

// Export the KeyManager instance
export default keyManager;

// Export a function to terminate the worker pool when app is closed
export function cleanupWorkers() {
  cryptoWorkerPool.terminate();
}
