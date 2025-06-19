// cryptoWorker.js - Web Worker for parallel processing of cryptographic operations
// This file should be placed in your project's workers directory

// Import dependencies using importScripts
importScripts("https://unpkg.com/openpgp@6.1.0/dist/openpgp.min.js");

// Process messages from the main thread
self.onmessage = async function (event) {
  const { id, type, data } = event.data;

  try {
    let result;

    switch (type) {
      // Combined operations for user authentication
      case "decryptUserPrivateKeyAndKeyPacket":
        result = await decryptUserPrivateKeyAndKeyPacket(data);
        break;

      // Combined operations for share decryption
      case "decryptShareKeyAndPassphrase":
        result = await decryptShareKeyAndPassphrase(data);
        break;

      // Combined operations for root folder decryption
      case "decryptRootFolder":
        result = await decryptRootFolder(data);
        break;

      // Combined operations for folder decryption
      case "processFolderDecryption":
        result = await processFolderDecryption(data);
        break;

      // Combined operations for file decryption
      case "processFileDecryption":
        result = await processFileDecryption(data);
        break;

      // Thumbnail decryption (uses already decrypted content key)
      case "decryptThumbnail":
        result = await decryptThumbnail(data);
        break;

      // Combined operations for subfolder key generation
      case "generateSubFolderKeys":
        result = await generateSubFolderKeys(data);
        break;

      // Combined operations for name encryption
      case "encryptName":
        result = await encryptName(data);
        break;

      // Combined operations for item move preparation
      case "prepareItemMove":
        result = await prepareItemMove(data);
        break;

      // Content key decryption (single operation, can be standalone)
      case "decryptContentKey":
        result = await decryptContentKey(data);
        break;

      // File content decryption (uses already decrypted content key)
      case "decryptFileContent":
        result = await decryptFileContent(data);
        break;

      // Combined operations for root item integrity verification
      case "verifyRootItemIntegrity":
        result = await verifyRootItemIntegrity(data);
        break;

      // Combined operations for item integrity verification
      case "verifyItemIntegrity":
        result = await verifyItemIntegrity(data);
        break;

      default:
        throw new Error(`Unknown task type: ${type}`);
    }

    // Return successful result
    self.postMessage({
      id,
      result,
    });
  } catch (error) {
    // Return error
    self.postMessage({
      id,
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
  }
};

// ========= COMBINED OPERATION FUNCTIONS =========

// Combined operation: Decrypt user private key and key packet together
async function decryptUserPrivateKeyAndKeyPacket({
  encryptedPrivateKey,
  derivedKey,
  keyPacket,
}) {
  try {
    // First decrypt the private key
    const privateKey = await openpgp.decryptKey({
      privateKey: await openpgp.readPrivateKey({
        armoredKey: encryptedPrivateKey,
      }),
      passphrase: derivedKey,
    });

    // Then use that private key to decrypt the key packet
    const encryptedKeyPacket = await openpgp.readMessage({
      armoredMessage: keyPacket,
    });

    const decryptedKeyPacket = await openpgp.decrypt({
      message: encryptedKeyPacket,
      decryptionKeys: privateKey,
      format: "utf8",
    });

    // Return both results together
    return {
      privateKey,
      decryptedKeyPacket,
    };
  } catch (error) {
    console.error("Error during user authentication:", error);
    throw new Error(`Failed to decrypt user credentials: ${error.message}`);
  }
}

// Combined operation: Decrypt share key and passphrase together
async function decryptShareKeyAndPassphrase({
  armoredShareKey,
  sessionKey,
  armoredSharePassphrase,
}) {
  try {
    // First decrypt the share key
    const sharePrivateKey = await openpgp.decryptKey({
      privateKey: await openpgp.readPrivateKey({
        armoredKey: armoredShareKey,
      }),
      passphrase: sessionKey,
    });

    // Then use that key to decrypt the share passphrase
    const decryptedSharePassphrase = await openpgp.decrypt({
      message: await openpgp.readMessage({
        armoredMessage: armoredSharePassphrase,
      }),
      decryptionKeys: sharePrivateKey,
    });

    // Return both results together
    return {
      sharePrivateKey,
      decryptedSharePassphrase,
    };
  } catch (error) {
    console.error("Error during share decryption:", error);
    throw new Error(`Failed to decrypt share: ${error.message}`);
  }
}

// Combined operation: Decrypt root folder with dependencies
async function decryptRootFolder({ rootFolder, shareSessionKey }) {
  try {
    // Decrypt root folder key packet
    const folderNodeKeyPacketMsg = await openpgp.readMessage({
      armoredMessage: rootFolder.folderProperties.nodeHashKey,
    });

    const decryptedNodeKeyPacket = await openpgp.decrypt({
      message: folderNodeKeyPacketMsg,
      passwords: [shareSessionKey],
      format: "binary",
    });

    const folderKeyPacketMsg = await openpgp.readMessage({
      armoredMessage: rootFolder.nodePassphrase,
    });

    const decryptedFolderKeyPacket = await openpgp.decrypt({
      message: folderKeyPacketMsg,
      passwords: [keyManager.arrayToBase64(decryptedNodeKeyPacket.data)],
      format: "utf8",
    });

    // Get folder session key
    const folderKeyPacketData = JSON.parse(decryptedFolderKeyPacket.data);
    const folderSessionKey = folderKeyPacketData.sessionKey;

    // Decrypt root folder private key
    const rootFolderPrivateKey = await openpgp.decryptKey({
      privateKey: await openpgp.readPrivateKey({
        armoredKey: rootFolder.nodeKey,
      }),
      passphrase: folderSessionKey,
    });

    // Decrypt folder name
    let folderName = "My Files";
    try {
      if (rootFolder.name) {
        folderName = await keyManager.decryptName(
          rootFolder.name,
          rootFolder.nodeKey,
          folderSessionKey,
        );
      }
    } catch (error) {
      console.warn("Could not decrypt root folder name:", error);
      // Use default name if decryption fails
    }

    return {
      folderName,
      folderSessionKey,
      rootFolderPrivateKey,
      folderKeyPacketData,
    };
  } catch (error) {
    console.error("Error during root folder decryption:", error);
    throw new Error(`Failed to decrypt root folder: ${error.message}`);
  }
}

// Combined operation: Process folder decryption
async function processFolderDecryption({ folder, parentSessionKey }) {
  try {
    const folderNodeHashKey = await openpgp.readMessage({
      armoredMessage: folder.folderProperties.nodeHashKey,
    });

    const folderNodePassphrase = await openpgp.decrypt({
      message: folderNodeHashKey,
      passwords: [parentSessionKey],
      format: "utf8",
    });

    // Decrypt folder key packet
    const folderKeyPacketMsg = await openpgp.readMessage({
      armoredMessage: folder.nodePassphrase,
    });

    const decryptedFolderKeyPacket = await openpgp.decrypt({
      message: folderKeyPacketMsg,
      passwords: [folderNodePassphrase.data],
      format: "utf8",
    });

    // Get folder session key
    const folderKeyPacketData = JSON.parse(decryptedFolderKeyPacket.data);

    const folderSessionKey = folderKeyPacketData.sessionKey;

    // Decrypt folder private key
    const folderPrivateKey = await openpgp.decryptKey({
      privateKey: await openpgp.readPrivateKey({
        armoredKey: folder.nodeKey,
      }),
      passphrase: folderSessionKey,
    });

    // Decrypt folder name
    let folderName = "Unnamed Folder";
    try {
      if (folder.name) {
        folderName = await keyManager.decryptName(
          folder.name,
          folder.nodeKey,
          folderSessionKey,
        );
      }
    } catch (error) {
      console.warn("Could not decrypt folder name:", error);
      // Use default name if decryption fails
    }

    return {
      folderName,
      folderSessionKey,
      folderPrivateKey,
      folderKeyPacketData,
    };
  } catch (error) {
    console.error("Error during folder decryption:", error);
    throw new Error(`Failed to decrypt folder: ${error.message}`);
  }
}

// Combined operation: Process file decryption
async function processFileDecryption({ file, parentSessionKey }) {
  try {
    // Decrypt file key packet
    const fileKeyPacketMsg = await openpgp.readMessage({
      armoredMessage: file.nodePassphrase,
    });

    const decryptedFileKeyPacket = await openpgp.decrypt({
      message: fileKeyPacketMsg,
      passwords: [parentSessionKey],
      format: "utf8",
    });

    // Get file session key
    const fileKeyPacketData = JSON.parse(decryptedFileKeyPacket.data);
    const fileSessionKey = fileKeyPacketData.sessionKey;

    // Decrypt file private key
    const filePrivateKey = await openpgp.decryptKey({
      privateKey: await openpgp.readPrivateKey({ armoredKey: file.nodeKey }),
      passphrase: fileSessionKey,
    });

    // Decrypt file name
    let fileName = "Unnamed File";
    try {
      if (file.name) {
        fileName = await keyManager.decryptName(file.name, filePrivateKey);
      }
    } catch (error) {
      console.warn("Could not decrypt file name:", error);
      // Use default name if decryption fails
    }

    // Process content key if available
    let contentKey = undefined;
    if (file.fileProperties && file.fileProperties.contentKeyPacket) {
      try {
        const contentKeyMessage = await openpgp.readMessage({
          armoredMessage: file.fileProperties.contentKeyPacket,
        });

        const decryptedContentKey = await openpgp.decrypt({
          message: contentKeyMessage,
          decryptionKeys: filePrivateKey,
          format: "binary",
        });

        contentKey = keyManager.arrayToBase64(
          new Uint8Array(decryptedContentKey.data),
        );
      } catch (error) {
        console.warn("Could not decrypt content key:", error);
        // Content key decryption failed
      }
    }

    return {
      fileName,
      filePrivateKey,
      fileSessionKey,
      contentKey,
    };
  } catch (error) {
    console.error("Error during file decryption:", error);
    throw new Error(`Failed to decrypt file: ${error.message}`);
  }
}

// Decrypt thumbnail using content key
async function decryptThumbnail({ encryptedData, contentKey }) {
  try {
    return await keyManager.decryptFileContent(encryptedData, contentKey);
  } catch (error) {
    console.error("Error decrypting thumbnail:", error);
    throw new Error(`Failed to decrypt thumbnail: ${error.message}`);
  }
}

// Use keyManager to generate subfolder keys
async function generateSubFolderKeys({
  name,
  email,
  username,
  parentPrivateKeyArmored,
  parentNodeKey,
  parentKeyPacket,
  parentNodePassphraseSignature,
  parentSessionKey,
  parentKeyPacketId,
}) {
  try {
    // Let keyManager handle the subfolder key generation
    return await keyManager.generateSubFolderKeys(
      name,
      email,
      username,
      parentPrivateKeyArmored,
      parentNodeKey,
      parentKeyPacket,
      parentNodePassphraseSignature,
      parentSessionKey,
      parentKeyPacketId,
    );
  } catch (error) {
    console.error("Error generating subfolder keys:", error);
    throw new Error(`Failed to generate subfolder keys: ${error.message}`);
  }
}

// Encrypt name
async function encryptName({ newName, privateKey }) {
  try {
    // Get public key from private key
    const publicKey = privateKey.toPublic();

    // Encrypt the new name
    const nameMessage = await openpgp.createMessage({ text: newName });
    const encryptedName = await openpgp.encrypt({
      message: nameMessage,
      encryptionKeys: publicKey,
      format: "armored",
    });

    // Calculate name hash
    const nameHash = await keyManager.calculateNameHash(newName);

    return {
      encryptedName,
      nameHash,
    };
  } catch (error) {
    console.error("Error encrypting name:", error);
    throw new Error(`Failed to encrypt name: ${error.message}`);
  }
}

// Prepare for moving items
async function prepareItemMove({ item, targetSessionKey, targetKeyPacketId }) {
  try {
    // Create key packet data for this item
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);

    const itemKeyPacketData = {
      sessionKey: item.keyData.sessionKey,
      parentKeyPacketId: targetKeyPacketId,
      created: new Date().toISOString(),
      version: 1,
      keyType: item.type,
      id: `${timestamp}-${random}`,
    };

    // Encrypt using OpenPGP with target session key as password
    const passMessage = await openpgp.createMessage({
      text: JSON.stringify(itemKeyPacketData),
    });
    const encryptedPassphrase = await openpgp.encrypt({
      message: passMessage,
      passwords: [targetSessionKey],
      format: "armored",
    });

    // Calculate name hash
    const nameHash = await keyManager.calculateNameHash(item.name);

    return {
      encryptedPassphrase,
      nameHash,
    };
  } catch (error) {
    console.error("Error preparing item move:", error);
    throw new Error(`Failed to prepare item move: ${error.message}`);
  }
}

// Decrypt content key
async function decryptContentKey({ contentKeyPacket, filePrivateKey }) {
  try {
    const contentKeyMessage = await openpgp.readMessage({
      armoredMessage: contentKeyPacket,
    });

    const decryptedContentKey = await openpgp.decrypt({
      message: contentKeyMessage,
      decryptionKeys: filePrivateKey,
      format: "binary",
    });

    return keyManager.arrayToBase64(new Uint8Array(decryptedContentKey.data));
  } catch (error) {
    console.error("Error decrypting content key:", error);
    throw new Error(`Failed to decrypt content key: ${error.message}`);
  }
}

// Decrypt file content
async function decryptFileContent({ content, contentKey }) {
  try {
    return await keyManager.decryptFileContent(content, contentKey);
  } catch (error) {
    console.error("Error decrypting file content:", error);
    throw new Error(`Failed to decrypt file content: ${error.message}`);
  }
}

// Verify signature for integrity checks
async function verifySignature(
  messageText,
  armoredSignature,
  verificationKey,
  expectedKeyID,
  signatureEmail,
) {
  try {
    const message = await openpgp.createMessage({ text: messageText });
    const signature = await openpgp.readSignature({ armoredSignature });

    const verified = await openpgp.verify({
      message,
      signature,
      verificationKeys: verificationKey,
    });

    // Check if signature is verified
    if (!verified.signatures[0].verified) {
      return false;
    }

    // Check key ID match if expected key ID is provided
    if (
      expectedKeyID &&
      verified.signatures[0].keyID.toHex() !== expectedKeyID
    ) {
      return false;
    }

    // Extract email from user ID using regex to handle any format
    if (signatureEmail) {
      const userID = verificationKey.toPublic().getUserIDs()[0];
      const emailMatch = userID.match(/<([^>]+)>/);

      if (!emailMatch || emailMatch[1] !== signatureEmail) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.warn("Error verifying signature:", error);
    return false;
  }
}

// Verify root item integrity
async function verifyRootItemIntegrity({
  item,
  sharePrivateKey,
  shareKeyPacket,
  sharePassphraseSignature,
  signatureEmail,
}) {
  try {
    // Create an array to hold verification promises
    const verificationPromises = [];

    // Add share passphrase verification if available
    if (sharePassphraseSignature) {
      verificationPromises.push(
        verifySignature(
          shareKeyPacket,
          sharePassphraseSignature,
          sharePrivateKey,
          null,
          signatureEmail,
        ),
      );
    }

    // Add node passphrase verification if available
    if (item.original.nodePassphraseSignature) {
      const itemKeyID = item.keyData.privateKey.toPublic().getKeyID().toHex();
      verificationPromises.push(
        verifySignature(
          item.original.nodePassphrase,
          item.original.nodePassphraseSignature,
          item.keyData.privateKey,
          itemKeyID,
          signatureEmail,
        ),
      );
    }

    // If there are no verification promises, return false
    if (verificationPromises.length === 0) {
      return false;
    }

    // Execute all verifications in parallel
    const results = await Promise.all(verificationPromises);

    // All verifications must pass
    return results.every((result) => result === true);
  } catch (error) {
    console.error("Error verifying root item integrity:", error);
    return false;
  }
}

// Verify item integrity with parent folder
async function verifyItemIntegrity({
  item,
  parentPrivateKey,
  parentKeyPacket,
  parentPassphraseSignature,
  signatureEmail,
}) {
  try {
    // Create an array to hold verification promises
    const verificationPromises = [];

    // Add parent passphrase verification if available
    if (parentPassphraseSignature) {
      verificationPromises.push(
        verifySignature(
          parentKeyPacket,
          parentPassphraseSignature,
          parentPrivateKey,
          null,
          signatureEmail,
        ),
      );
    }

    // Add node passphrase verification if available
    if (item.original.nodePassphraseSignature) {
      const itemKeyID = item.keyData.privateKey.toPublic().getKeyID().toHex();
      verificationPromises.push(
        verifySignature(
          item.original.nodePassphrase,
          item.original.nodePassphraseSignature,
          item.keyData.privateKey,
          itemKeyID,
          signatureEmail,
        ),
      );
    }

    // If there are no verification promises, return false
    if (verificationPromises.length === 0) {
      return false;
    }

    // Execute all verifications in parallel
    const results = await Promise.all(verificationPromises);

    // All verifications must pass
    return results.every((result) => result === true);
  } catch (error) {
    console.error("Error verifying item integrity:", error);
    return false;
  }
}
