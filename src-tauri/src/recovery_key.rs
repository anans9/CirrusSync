use argon2::{self, Config, Variant, Version};
use bip39::{Language, Mnemonic};
use hex;
use rand::Rng;
use serde::{Deserialize, Serialize};
use tokio::task;

// Simplified result structs - only return what's needed
#[derive(Serialize, Deserialize, Debug)]
pub struct SeedResult {
    seed: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct RecoveryPhraseResult {
    recovery_phrase: String,
    seed: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct VerifyResult {
    is_valid: bool,
    seed: Option<String>,
}

/// Derive a seed from a password using Argon2 without storing the hash
#[tauri::command]
pub async fn derive_seed_from_password(
    password: String,
    salt_hex: Option<String>,
) -> Result<SeedResult, String> {
    task::spawn_blocking(move || {
        let salt = match salt_hex {
            Some(hex_str) => hex::decode(&hex_str).map_err(|_| "Invalid salt hex".to_string())?,
            None => {
                let mut salt_bytes = [0u8; 16];
                rand::rng().fill(&mut salt_bytes);
                salt_bytes.to_vec()
            }
        };

        // Argon2 Config with reduced cost parameters
        let config = Config {
            variant: Variant::Argon2id,
            version: Version::Version13,
            mem_cost: 32768, // 32 MB memory
            time_cost: 3,    // 3 iterations (reduced from 10)
            lanes: 2,        // Parallelism factor (reduced from 4)
            secret: &[],
            ad: &[],
            hash_length: 32, // 32-byte output (256 bits)
        };

        // Generate seed directly without storing hash
        let seed_bytes = argon2::hash_raw(password.as_bytes(), &salt, &config)
            .map_err(|e| format!("Seed generation failed: {:?}", e))?;

        Ok(SeedResult {
            seed: hex::encode(&seed_bytes),
        })
    })
    .await
    .map_err(|e| format!("Task failed: {:?}", e))?
}

/// Generate a BIP39 12-word recovery phrase and derive the same seed
#[tauri::command]
pub async fn generate_recovery_phrase() -> Result<RecoveryPhraseResult, String> {
    task::spawn_blocking(move || {
        // Generate random entropy for mnemonic
        let mut entropy = [0u8; 16];
        rand::rng().fill(&mut entropy);

        // Create mnemonic from entropy
        let mnemonic = Mnemonic::from_entropy(&entropy)
            .map_err(|_| "Failed to generate mnemonic".to_string())?;
        let recovery_phrase = mnemonic.to_string();

        // Generate seed directly from the mnemonic with empty password
        // This makes the seed derivation dependent only on the recovery phrase
        let seed_bytes = mnemonic.to_seed("");

        Ok(RecoveryPhraseResult {
            recovery_phrase,
            seed: hex::encode(&seed_bytes),
        })
    })
    .await
    .map_err(|e| format!("Task failed: {:?}", e))?
}

#[tauri::command]
pub async fn verify_recovery_phrase(phrase: String) -> Result<VerifyResult, String> {
    task::spawn_blocking(move || {
        // Check if the recovery phrase is valid
        let mnemonic_result = Mnemonic::parse_in_normalized(Language::English, &phrase);

        let is_valid = mnemonic_result.is_ok();
        let seed = if is_valid {
            // Generate seed directly from mnemonic with empty password
            // to match how we generated it originally
            let mnemonic = mnemonic_result.unwrap();
            let seed_bytes = mnemonic.to_seed("");

            Some(hex::encode(&seed_bytes))
        } else {
            None
        };

        Ok(VerifyResult { is_valid, seed })
    })
    .await
    .map_err(|e| format!("Task failed: {:?}", e))?
}
