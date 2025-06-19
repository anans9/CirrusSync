use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use serde::Serialize;
use sha2::{Digest, Sha256};
use sysinfo::System;

#[derive(Serialize)]
pub struct SystemIdentifier {
    hash: String,
    os_long_version: String,
    os_name: String,
}

#[tauri::command]
pub fn generate_system_identifier() -> SystemIdentifier {
    let mut system = System::new_all();
    system.refresh_all();

    let hostname = System::host_name().unwrap_or_else(|| "unknown".to_string());
    let os_name = System::name().unwrap_or_else(|| "unknown".to_string());
    let os_version = System::os_version().unwrap_or_else(|| "<unknown>".to_owned());
    let kernel_version = System::kernel_version().unwrap_or_else(|| "unknown".to_string());
    let os_long_version = System::long_os_version().unwrap_or_else(|| "unknown".to_string());
    let distribution_id = System::distribution_id();
    let core_count = system.physical_core_count().unwrap_or(0);
    let total_memory = system.total_memory();

    // Format OS name in a clean way (e.g., "macOS" instead of "darwin")
    let formatted_os_name = match os_name.to_lowercase().as_str() {
        "darwin" => "macOS".to_string(),
        "windows" => "Windows".to_string(),
        "linux" => {
            // For Linux, we might want to use the distribution name if available
            if !distribution_id.is_empty() {
                // Capitalize first letter of distribution
                let mut chars = distribution_id.chars();
                match chars.next() {
                    None => "Linux".to_string(),
                    Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                }
            } else {
                "Linux".to_string()
            }
        }
        _ => os_name.clone(), // Clone instead of moving
    };

    // Include app version if available (you'll need to replace this with your actual app version)
    let app_version = env!("CARGO_PKG_VERSION");

    // Construct system identifier string with all values to ensure uniqueness
    let system_info = format!(
        "{}|{}|{}|{}|{}|{}|cores:{}|total_memory:{}|app_version:{}",
        hostname,
        os_name,
        os_version,
        kernel_version,
        os_long_version,
        distribution_id,
        core_count,
        total_memory,
        app_version
    );

    // Generate SHA-256 hash
    let mut hasher = Sha256::new();
    hasher.update(system_info.as_bytes());
    let hash_result = hasher.finalize();

    // Encode hash as Base64
    let hash_encoded = BASE64.encode(hash_result);

    // Return system identifier struct with formatted OS name
    SystemIdentifier {
        hash: hash_encoded,
        os_long_version,
        os_name: formatted_os_name + "-" + app_version,
    }
}
