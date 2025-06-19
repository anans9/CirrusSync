// src/file_transfer.rs

use std::collections::{HashMap, HashSet, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant};

use aes_gcm::aead::Aead;
use aes_gcm::{Aes256Gcm, Key, KeyInit, Nonce};
use base64::{Engine as _, engine::general_purpose};
use image::{self, ImageFormat};
use lazy_static::lazy_static;
use mime_guess::from_path;
use rand::Rng;
use reqwest;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::future::Future;
use std::io::Cursor;
use std::pin::Pin;
use tauri::{AppHandle, Emitter, Manager, State, command};
use tokio::fs::File;
use tokio::io::{AsyncReadExt, AsyncSeekExt};
use tokio::sync::Mutex;
use xattr;

/// Type definitions for file transfer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueItem {
    #[serde(rename = "type")]
    item_type: String, // "file" or "folder"
    id: String,
    path: String,
    name: String,
    parent_id: String,
    depth: usize, // Tracks hierarchy level
}

/// Represents a presigned URL for block upload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PresignedUrl {
    url: String,
    block_id: String,
    index: usize,
    expires_in: usize,
}

/// Response containing upload URLs and encryption key
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadUrlsResponse {
    file_id: String,
    revision_id: String,
    total_blocks: usize,
    block_size: u64,
    upload_urls: Vec<PresignedUrl>,
    content_key: String,              // Base64-encoded AES key for encryption
    thumbnail: Option<ThumbnailInfo>, // Add optional thumbnail information
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThumbnailInfo {
    id: String,
    url: String,
    expires_in: usize,
    content_key: String, // Same key as the main file
}

/// Payload wrapper for upload URLs response
#[derive(Debug, Deserialize)]
pub struct UploadUrlsResponsePayload {
    transfer_id: String,
    response: UploadUrlsResponse,
}

/// Payload wrapper for error response
#[derive(Debug, Deserialize)]
pub struct ErrorResponsePayload {
    transfer_id: String,
    error: String,
}

/// Response for folder creation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderResponse {
    folder_id: String,
}

/// Progress information for a transfer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferProgress {
    id: String,
    name: String,
    #[serde(rename = "type")]
    item_type: String,
    progress: f32,
    status: String,
    message: Option<String>,
    speed: Option<f64>,          // Bytes per second
    remaining_time: Option<u64>, // Seconds
    size: Option<u64>,           // File size in bytes (optional)
}

/// Main queue for managing file transfers
pub struct TransferQueue {
    items: VecDeque<QueueItem>,
    processing: Option<String>,             // ID of item being processed
    completed: HashSet<String>,             // IDs of completed items
    failed: HashMap<String, String>,        // ID -> error message
    folder_id_map: HashMap<String, String>, // path -> server folder ID
    paused: bool,
    start_time: Instant,

    // Tracking sets to prevent duplicate requests
    initialized_files: HashSet<String>, // IDs of files that have been initialized
    initialized_folders: HashSet<String>, // IDs of folders that have been initialized
    completion_notifications_sent: HashSet<String>, // IDs of transfers that have sent completion notifications

    // Block tracking to prevent duplicate notifications
    block_completion_sent: HashSet<String>, // block_id + index combinations that have been sent

    // Additional tracking for duplicate responses from frontend
    received_url_responses: HashSet<String>, // transfer_id that have received URLs
    received_folder_responses: HashSet<String>, // transfer_id that have received folder creation responses
    original_share_id: Option<String>,

    // Request timestamps to track stuck or hanging requests
    request_timestamps: HashMap<String, Instant>,

    // Track pending folders to ensure proper hierarchy processing
    pending_folders: HashSet<String>, // Path strings of folders being processed
}

lazy_static! {
    static ref RESPONSE_CHANNELS: Mutex<HashMap<String, tokio::sync::oneshot::Sender<Result<UploadUrlsResponse, String>>>> =
        Mutex::new(HashMap::new());
    static ref FOLDER_RESPONSE_CHANNELS: Mutex<HashMap<String, tokio::sync::oneshot::Sender<Result<FolderResponse, String>>>> =
        Mutex::new(HashMap::new());
}

pub struct TransferManagerState(pub Arc<Mutex<TransferQueue>>);

impl TransferQueue {
    /// Creates a new transfer queue with default values
    pub fn new() -> Self {
        Self {
            items: VecDeque::new(),
            processing: None,
            completed: HashSet::new(),
            failed: HashMap::new(),
            folder_id_map: HashMap::new(),
            paused: false,
            start_time: Instant::now(),
            initialized_files: HashSet::new(),
            initialized_folders: HashSet::new(),
            completion_notifications_sent: HashSet::new(),
            block_completion_sent: HashSet::new(),
            received_url_responses: HashSet::new(),
            received_folder_responses: HashSet::new(),
            original_share_id: None,
            request_timestamps: HashMap::new(),
            pending_folders: HashSet::new(),
        }
    }
}

/// Generates a unique ID for transfer items
fn generate_id() -> String {
    let mut rng = rand::rng();
    let random_part: u64 = rng.random();
    format!(
        "transfer-{}-{:x}",
        chrono::Utc::now().timestamp_millis(),
        random_part
    )
}

/// Scans a directory and returns lists of folders and files
async fn scan_folder(path: &Path) -> Result<(Vec<PathBuf>, Vec<PathBuf>), String> {
    let mut folders = Vec::new();
    let mut files = Vec::new();

    match tokio::fs::read_dir(path).await {
        Ok(mut dir) => {
            while let Ok(Some(entry)) = dir.next_entry().await {
                let entry_path = entry.path();

                if entry_path.is_dir() {
                    folders.push(entry_path);
                } else if entry_path.is_file() {
                    files.push(entry_path);
                }
            }

            Ok((folders, files))
        }
        Err(e) => Err(format!("Failed to read directory: {}", e)),
    }
}

/// Command to select and upload files
#[command]
pub async fn select_files(
    app: AppHandle,
    paths: Vec<String>,
    share_id: String,
    parent_id: String,
    state: State<'_, TransferManagerState>,
) -> Result<(), String> {
    let mut items = Vec::new();

    // Process each file path
    for path_str in paths {
        let path = PathBuf::from(&path_str);

        if !path.exists() || !path.is_file() {
            app.emit("transfer-error", format!("Invalid file path: {}", path_str))
                .map_err(|e| format!("Failed to emit error: {}", e))?;
            continue;
        }

        let name = path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("unknown")
            .to_string();

        let id = generate_id();

        items.push(QueueItem {
            item_type: "file".to_string(),
            id,
            path: path_str,
            name,
            parent_id: parent_id.clone(),
            depth: 0, // Root level
        });
    }

    // Add items to the queue
    {
        let mut queue = state.0.lock().await;
        queue.original_share_id = Some(share_id.clone());

        for item in items {
            queue.items.push_back(item);
        }

        // Start processing if not already in progress
        if queue.processing.is_none() && !queue.paused {
            drop(queue); // Release the lock before starting process
            process_next_item(app, state, share_id).await?;
        }
    }

    Ok(())
}

/// Command to select and upload folders
#[command]
pub async fn select_folders(
    app: AppHandle,
    paths: Vec<String>,
    share_id: String,
    parent_id: String,
    state: State<'_, TransferManagerState>,
) -> Result<(), String> {
    let mut items = Vec::new();

    // Process each folder path
    for path_str in paths {
        let path = PathBuf::from(&path_str);

        if !path.exists() || !path.is_dir() {
            app.emit(
                "transfer-error",
                format!("Invalid folder path: {}", path_str),
            )
            .map_err(|e| format!("Failed to emit error: {}", e))?;
            continue;
        }

        let name = path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("unknown")
            .to_string();

        let id = generate_id();

        items.push(QueueItem {
            item_type: "folder".to_string(),
            id,
            path: path_str,
            name,
            parent_id: parent_id.clone(),
            depth: 0, // Root level
        });
    }

    // Add items to the queue
    {
        let mut queue = state.0.lock().await;
        queue.original_share_id = Some(share_id.clone());

        for item in items {
            queue.items.push_back(item);
        }

        // Start processing if not already in progress
        if queue.processing.is_none() && !queue.paused {
            drop(queue); // Release the lock before starting process
            process_next_item(app, state, share_id).await?;
        }
    }

    Ok(())
}

/// Cancels a specific transfer by ID
#[command]
pub async fn cancel_transfer(
    id: String,
    state: State<'_, TransferManagerState>,
) -> Result<(), String> {
    let mut queue = state.0.lock().await;

    // Check if this is the current processing item
    if let Some(processing_id) = &queue.processing {
        if processing_id == &id {
            queue.processing = None;
            queue
                .failed
                .insert(id.clone(), "Cancelled by user".to_string());
            // Clean up all tracking for this ID
            queue.initialized_files.remove(&id);
            queue.initialized_folders.remove(&id);
            queue.completion_notifications_sent.remove(&id);
            queue.received_url_responses.remove(&id);
            queue.received_folder_responses.remove(&id);
            queue.request_timestamps.remove(&id);
            return Ok(());
        }
    }

    // Otherwise, remove it from the queue if found
    queue.items.retain(|item| item.id != id);
    queue
        .failed
        .insert(id.clone(), "Cancelled by user".to_string());
    // Clean up all tracking for this ID
    queue.initialized_files.remove(&id);
    queue.initialized_folders.remove(&id);
    queue.completion_notifications_sent.remove(&id);
    queue.received_url_responses.remove(&id);
    queue.received_folder_responses.remove(&id);
    queue.request_timestamps.remove(&id);

    Ok(())
}

/// Cancels all pending transfers
#[command]
pub async fn cancel_all_transfers(state: State<'_, TransferManagerState>) -> Result<(), String> {
    let mut queue = state.0.lock().await;

    // Cancel the current processing item
    if let Some(processing_id) = queue.processing.take() {
        queue
            .failed
            .insert(processing_id.clone(), "Cancelled by user".to_string());
        queue.initialized_files.remove(&processing_id);
        queue.initialized_folders.remove(&processing_id);
        queue.completion_notifications_sent.remove(&processing_id);
        queue.received_url_responses.remove(&processing_id);
        queue.received_folder_responses.remove(&processing_id);
        queue.request_timestamps.remove(&processing_id);
    }

    // Fix the mutable borrow issue by collecting IDs first
    let item_ids: Vec<String> = queue.items.iter().map(|item| item.id.clone()).collect();
    queue.items.clear();
    queue.pending_folders.clear(); // Clear pending folders too

    // Then insert them into the failed map and clean up all tracking
    for id in item_ids {
        queue
            .failed
            .insert(id.clone(), "Cancelled by user".to_string());
        queue.initialized_files.remove(&id);
        queue.initialized_folders.remove(&id);
        queue.completion_notifications_sent.remove(&id);
        queue.received_url_responses.remove(&id);
        queue.received_folder_responses.remove(&id);
        queue.request_timestamps.remove(&id);
    }

    // Clear block completion tracking
    queue.block_completion_sent.clear();

    Ok(())
}

/// Pauses all ongoing transfers
#[command]
pub async fn pause_transfers(state: State<'_, TransferManagerState>) -> Result<(), String> {
    let mut queue = state.0.lock().await;
    queue.paused = true;
    Ok(())
}

/// Resumes previously paused transfers
#[command]
pub async fn resume_transfers(
    app: AppHandle,
    share_id: String,
    state: State<'_, TransferManagerState>,
) -> Result<(), String> {
    {
        let mut queue = state.0.lock().await;
        queue.paused = false;

        // Only start processing if nothing is currently processing
        if queue.processing.is_none() && !queue.items.is_empty() {
            drop(queue); // Release the lock before starting process
            process_next_item(app, state, share_id).await?;
        }
    }

    Ok(())
}

/// Returns the current status of the transfer queue
#[command]
pub async fn get_queue_status(
    state: State<'_, TransferManagerState>,
) -> Result<serde_json::Value, String> {
    let queue = state.0.lock().await;

    let result = serde_json::json!({
        "queue_size": queue.items.len(),
        "processing": queue.processing,
        "completed": queue.completed.len(),
        "failed": queue.failed.len(),
        "paused": queue.paused,
        "elapsedTime": queue.start_time.elapsed().as_secs(),
        "pending_folders": queue.pending_folders.len()
    });

    Ok(result)
}

/// Finalizes a transfer after content update is complete
#[command]
pub async fn finalize_transfer_complete(
    transfer_id: String,
    file_id: String,
    parent_id: String,
    success: bool,
    error: Option<String>,
    app: AppHandle,
) -> Result<(), String> {
    let original_share_id;
    let item_name;

    {
        let state = app.state::<TransferManagerState>();
        let mut queue = state.0.lock().await;

        // Check if this transfer is already completed
        if queue.completed.contains(&transfer_id) {
            println!(
                "Transfer {} already completed, skipping finalization",
                transfer_id
            );
            return Ok(());
        }

        // Get the original share ID from the state
        original_share_id = queue.original_share_id.clone().unwrap_or_else(|| {
            if parent_id != "root" && !parent_id.starts_with("folder-") {
                parent_id.clone()
            } else {
                String::from("default-share-id")
            }
        });

        // Try to get the item name
        item_name = queue
            .items
            .iter()
            .find(|item| item.id == transfer_id)
            .map(|item| item.name.clone())
            .unwrap_or_else(|| "Unknown".to_string());

        // Remove the timestamp tracking for this transfer
        queue.request_timestamps.remove(&transfer_id);
    }

    // If content update was successful or we're allowing failures
    if success {
        println!("Content update successful for transfer ID: {}", transfer_id);

        // Send transfer complete event
        app.emit(
            "transfer-complete",
            serde_json::json!({
                "id": transfer_id,
                "name": item_name,
                "file_id": file_id,
                "parent_id": parent_id,
                "status": "completed",
                "message": "Upload complete and verified"
            }),
        )
        .map_err(|e| format!("Failed to emit completion: {}", e))?;
    } else {
        println!(
            "Content update failed for transfer ID: {}, but continuing",
            transfer_id
        );

        // Send transfer complete with warning
        let error_message = error.unwrap_or_else(|| "Content update failed".to_string());
        app.emit(
            "transfer-complete",
            serde_json::json!({
                "id": transfer_id,
                "name": item_name,
                "file_id": file_id,
                "parent_id": parent_id,
                "status": "completed",
                "message": format!("Upload complete, but verification failed: {}", error_message)
            }),
        )
        .map_err(|e| format!("Failed to emit completion: {}", e))?;
    }

    // Mark as completed in state
    {
        let state = app.state::<TransferManagerState>();
        let mut queue = state.0.lock().await;

        queue.processing = None;
        queue.completed.insert(transfer_id.clone());

        // Clean up any other tracking for this transfer
        queue.initialized_files.remove(&transfer_id);
        queue.initialized_folders.remove(&transfer_id);
        queue.completion_notifications_sent.remove(&transfer_id);
        queue.received_url_responses.remove(&transfer_id);
        queue.received_folder_responses.remove(&transfer_id);

        // Clean up any block tracking related to this file ID
        let block_keys_to_remove: Vec<String> = queue
            .block_completion_sent
            .iter()
            .filter(|key| key.starts_with(&format!("{}:", file_id)))
            .cloned()
            .collect();

        for key in block_keys_to_remove {
            queue.block_completion_sent.remove(&key);
        }
    }

    // Continue with next item if available - using the original share_id
    process_next_item(
        app.clone(),
        app.state::<TransferManagerState>(),
        original_share_id,
    )
    .await?;

    Ok(())
}

/// Processes the next item in the queue
fn process_next_item<'a>(
    app: AppHandle,
    state: State<'a, TransferManagerState>,
    share_id: String,
) -> Pin<Box<dyn Future<Output = Result<(), String>> + Send + 'a>> {
    Box::pin(async move {
        // Get the next item from queue
        let next_item = {
            let mut queue = state.0.lock().await;

            // Check if queue is paused
            if queue.paused {
                return Ok(());
            }

            // Check if already processing something
            if queue.processing.is_some() {
                return Ok(());
            }

            // Check for any hanging requests and clear them
            let current_time = Instant::now();

            // First collect IDs to remove to avoid borrowing issues
            let mut ids_to_remove = Vec::new();
            for (id, timestamp) in &queue.request_timestamps {
                if current_time.duration_since(*timestamp) > Duration::from_secs(35) {
                    println!("Detected hanging request for ID: {}, cleaning up", id);
                    ids_to_remove.push(id.clone());
                }
            }

            // Then process them outside the iteration loop
            for id in &ids_to_remove {
                // Clean up any pending channels
                let mut channels = RESPONSE_CHANNELS.lock().await;
                if let Some(sender) = channels.remove(id) {
                    let _ = sender.send(Err("Request timed out".to_string()));
                }
                drop(channels);

                let mut folder_channels = FOLDER_RESPONSE_CHANNELS.lock().await;
                if let Some(sender) = folder_channels.remove(id) {
                    let _ = sender.send(Err("Request timed out".to_string()));
                }
                drop(folder_channels);

                // Remove tracking for this ID
                queue.request_timestamps.remove(id);
                queue.received_url_responses.remove(id);
                queue.received_folder_responses.remove(id);
            }

            // SIMPLIFIED SEQUENTIAL PROCESSING LOGIC:
            // 1. If there's a folder at the front of the queue, process it
            // 2. Only process items whose parent folders have been created

            if queue.items.is_empty() {
                return Ok(()); // Nothing to process
            }

            // Look at the first item
            let first_item = queue.items.front().unwrap().clone();

            // If it's a folder, we'll process it
            if first_item.item_type == "folder" {
                queue.items.pop_front().unwrap()
            }
            // If it's a file, we need to make sure its parent folder exists
            else {
                let parent_path = Path::new(&first_item.path)
                    .parent()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default();

                // If the parent is in pending_folders, we can't process this item yet
                if queue.pending_folders.contains(&parent_path) {
                    println!(
                        "Skipping file because parent folder is still pending: {}",
                        parent_path
                    );

                    // Try to find another item we can process
                    let mut found_processable = false;
                    let mut processable_index = 0;

                    for (index, item) in queue.items.iter().enumerate() {
                        // Skip files whose parents are pending
                        if item.item_type == "file" {
                            let item_parent = Path::new(&item.path)
                                .parent()
                                .map(|p| p.to_string_lossy().to_string())
                                .unwrap_or_default();

                            if queue.pending_folders.contains(&item_parent) {
                                continue;
                            }
                        }

                        // Found a processable item
                        found_processable = true;
                        processable_index = index;
                        break;
                    }

                    if found_processable {
                        // Remove and return this item
                        let mut items: Vec<QueueItem> = queue.items.drain(..).collect();
                        let item = items.remove(processable_index);

                        // Put the rest back
                        queue.items = VecDeque::from(items);

                        // If it's a folder, mark it as pending
                        if item.item_type == "folder" {
                            queue.pending_folders.insert(item.path.clone());
                        }

                        item
                    } else {
                        // Nothing we can process right now
                        return Ok(());
                    }
                } else {
                    // Parent isn't pending, so we can process this file
                    queue.items.pop_front().unwrap()
                }
            }
        };

        // Process the item if we got one
        match next_item.item_type.as_str() {
            "file" => {
                if let Err(err) = process_file(
                    app.clone(),
                    state.clone(),
                    next_item.clone(),
                    share_id.clone(),
                )
                .await
                {
                    println!("Error processing file: {}", err);
                    // Handle the error, update state, but don't return the error - continue processing
                    let _ = handle_file_error(
                        &app,
                        &state,
                        &next_item.id,
                        &next_item.name,
                        &None::<u64>,
                        &err,
                    )
                    .await;
                }
            }
            "folder" => {
                if let Err(err) = process_folder(
                    app.clone(),
                    state.clone(),
                    next_item.clone(),
                    share_id.clone(),
                )
                .await
                {
                    println!("Error processing folder: {}", err);
                    // Handle the error, update state, but don't return the error - continue processing
                    let _ = handle_folder_error(&app, &state, &next_item.id, &next_item.name, &err)
                        .await;

                    // Also remove the folder from pending
                    let mut queue = state.0.lock().await;
                    queue.pending_folders.remove(&next_item.path);
                }
            }
            _ => {
                println!("Unknown item type: {}", next_item.item_type);
            }
        }

        // Continue with next item regardless of errors
        process_next_item(app, state, share_id).await?;

        Ok(())
    })
}

// Add this function to check if a file is an image and get its MIME type
fn get_file_info(path: &Path) -> (String, bool) {
    let mime = from_path(path).first_or_octet_stream().to_string();
    let is_image = mime.starts_with("image/");
    (mime, is_image)
}

// Fixed thumbnail generation function
async fn generate_thumbnail(file_path: &Path) -> Result<Vec<u8>, String> {
    // Read the file
    let img_data = match tokio::fs::read(file_path).await {
        Ok(data) => data,
        Err(e) => return Err(format!("Failed to read image file: {}", e)),
    };

    // Process the image in a blocking task since image operations are CPU-intensive
    let thumbnail_data = tokio::task::spawn_blocking(move || -> Result<Vec<u8>, String> {
        // Load the image
        let img = match image::load_from_memory(&img_data) {
            Ok(img) => img,
            Err(e) => return Err(format!("Failed to load image: {}", e)),
        };

        // Resize the image to max 300x300 while preserving aspect ratio
        let thumbnail = img.thumbnail(300, 300);

        // Create a buffer to write the image data to
        let mut buffer = Cursor::new(Vec::new());

        // Write the image to the buffer with JPEG format and reduced quality
        if let Err(e) = thumbnail.write_to(&mut buffer, ImageFormat::Jpeg) {
            return Err(format!("Failed to create thumbnail: {}", e));
        }

        Ok(buffer.into_inner())
    })
    .await
    .map_err(|e| format!("Task error: {}", e))??;

    Ok(thumbnail_data)
}

/// Lists extended attributes for a file
fn list_xattrs(file_path: &str) -> Option<String> {
    let path = Path::new(file_path);

    match xattr::list(path) {
        Ok(attrs) => {
            let attr_list: Vec<String> = attrs
                .map(|attr| attr.to_string_lossy().to_string())
                .collect();

            if attr_list.is_empty() {
                return None; // No xattrs, return None
            }

            Some(attr_list.join(", ")) // Return comma-separated attributes
        }
        Err(_) => None, // Error reading xattrs, return None
    }
}

/// Processes a file for upload
async fn process_file(
    app: AppHandle,
    state: State<'_, TransferManagerState>,
    item: QueueItem,
    share_id: String,
) -> Result<(), String> {
    let path = Path::new(&item.path);
    println!("Processing file: {} at depth {}", item.path, item.depth);

    if !path.exists() || !path.is_file() {
        return Err(format!("File not found or is not a file: {}", item.path));
    }

    // Get file metadata
    let file_meta = match tokio::fs::metadata(path).await {
        Ok(m) => m,
        Err(e) => {
            return Err(format!("Failed to read file metadata: {}", e));
        }
    };

    let file_size = file_meta.len();

    // Get modified date
    let modified_date = match file_meta.modified() {
        Ok(time) => match time.duration_since(std::time::UNIX_EPOCH) {
            Ok(duration) => Some(duration.as_secs()),
            Err(_) => None,
        },
        Err(_) => None,
    };

    // Check if file is empty (0 bytes) and return error if so
    if file_size == 0 {
        let error = format!("File is empty (0 bytes): {}", item.path);
        handle_file_error(&app, &state, &item.id, &item.name, &Some(file_size), &error).await?;
        return Err(error);
    }

    // Get MIME type and check if it's an image
    let (mime_type, is_image) = get_file_info(path);

    // Determine if thumbnail should be generated
    let needs_thumbnail = is_image && file_size < 5 * 1024 * 1024; // less than 5MB

    // Check if this file has already been initialized
    let already_initialized = {
        let queue = state.0.lock().await;
        queue.initialized_files.contains(&item.id)
    };

    if already_initialized {
        println!(
            "File {} already initialized, skipping initialization request",
            item.id
        );

        // If already initialized but not completed, mark as processing again
        let mut queue = state.0.lock().await;
        if !queue.completed.contains(&item.id) {
            queue.processing = Some(item.id.clone());
        } else {
            // If already completed, skip processing
            return Ok(());
        }
    } else {
        // Update state to mark as processing and track that we've initialized
        {
            let mut queue = state.0.lock().await;
            queue.processing = Some(item.id.clone());
            queue.initialized_files.insert(item.id.clone());
        }

        // Emit event to notify progress start
        app.emit(
            "transfer-progress",
            TransferProgress {
                id: item.id.clone(),
                name: item.name.clone(),
                item_type: "file".to_string(),
                progress: 0.0,
                status: "preparing".to_string(),
                message: Some("Preparing upload...".to_string()),
                speed: None,
                remaining_time: None,
                size: Some(file_size),
            },
        )
        .map_err(|e| format!("Failed to emit progress: {}", e))?;

        // Get parent_id from item or folder_id_map
        let parent_id = {
            let queue = state.0.lock().await;
            if let Some(mapped_id) = queue.folder_id_map.get(&item.parent_id) {
                mapped_id.clone()
            } else {
                item.parent_id.clone()
            }
        };

        let file_extended_attributes = list_xattrs(&item.path);

        // Check if we've already received a URL response for this file
        let already_received_response = {
            let queue = state.0.lock().await;
            queue.received_url_responses.contains(&item.id)
        };

        if !already_received_response {
            // Create a channel to wait for frontend response BEFORE emitting the event
            let (tx, rx) = tokio::sync::oneshot::channel::<Result<UploadUrlsResponse, String>>();

            // Set up timeout tracking for this request
            {
                let mut queue = state.0.lock().await;
                queue
                    .request_timestamps
                    .insert(item.id.clone(), Instant::now());
            }

            // Insert the channel BEFORE emitting the event
            {
                let mut channels = RESPONSE_CHANNELS.lock().await;
                channels.insert(item.id.clone(), tx);
            }

            // Mark that we're expecting a response
            {
                let mut queue = state.0.lock().await;
                queue.received_url_responses.insert(item.id.clone());
            }

            // Add a small delay to ensure the receiver is properly set up
            tokio::time::sleep(Duration::from_millis(50)).await;

            // Print the content of init-file-upload for debugging
            println!(
                "Sending init-file-upload for file: {} with ID: {}",
                item.name, item.id
            );

            // THEN send file info to frontend for initialization with additional parameters
            app.emit(
                "init-file-upload",
                serde_json::json!({
                    "id": item.id,
                    "name": item.name,
                    "path": item.path,
                    "parent_id": parent_id,
                    "share_id": share_id,
                    "size": file_size,
                    "xattrs": file_extended_attributes,
                    "mime_type": mime_type,
                    "modified_date": modified_date,
                    "needs_thumbnail": needs_thumbnail
                }),
            )
            .map_err(|e| format!("Failed to request file initialization: {}", e))?;

            println!("Waiting for response from frontend for file: {}", item.id);

            // Wait for the response with timeout
            let response = match tokio::time::timeout(Duration::from_secs(30), rx).await {
                Ok(Ok(Ok(response))) => {
                    // Clear the request timestamp since we got a response
                    let mut queue = state.0.lock().await;
                    queue.request_timestamps.remove(&item.id);

                    response
                }
                Ok(Ok(Err(e))) => {
                    let error = format!("{}", e);
                    handle_file_error(&app, &state, &item.id, &item.name, &Some(file_size), &error)
                        .await?;
                    return Err(error);
                }
                Ok(Err(_)) => {
                    let error = "Channel closed before receiving response".to_string();
                    handle_file_error(&app, &state, &item.id, &item.name, &Some(file_size), &error)
                        .await?;
                    return Err(error);
                }
                Err(_) => {
                    let error = "Timeout waiting for presigned URLs".to_string();

                    // We still need to clean up the request from timestamps
                    let mut queue = state.0.lock().await;
                    queue.request_timestamps.remove(&item.id);

                    handle_file_error(&app, &state, &item.id, &item.name, &Some(file_size), &error)
                        .await?;
                    return Err(error);
                }
            };

            // Handle thumbnail upload if needed and if the response contains a thumbnail_url
            if needs_thumbnail && response.upload_urls.len() > 0 {
                if let Some(thumbnail_url) = response
                    .upload_urls
                    .iter()
                    .find(|url| url.url.contains("thumbnail"))
                {
                    app.emit(
                        "transfer-progress",
                        TransferProgress {
                            id: item.id.clone(),
                            name: item.name.clone(),
                            item_type: "file".to_string(),
                            progress: 0.02,
                            status: "preparing".to_string(),
                            message: Some("Generating thumbnail...".to_string()),
                            speed: None,
                            remaining_time: None,
                            size: Some(file_size),
                        },
                    )
                    .map_err(|e| format!("Failed to emit progress: {}", e))?;

                    // Generate thumbnail
                    match generate_thumbnail(path).await {
                        Ok(thumbnail_data) => {
                            // Upload thumbnail
                            let client = reqwest::Client::builder()
                                .timeout(Duration::from_secs(30))
                                .build()
                                .unwrap_or_default();

                            // Try to upload the thumbnail
                            match client
                                .put(&thumbnail_url.url)
                                .body(thumbnail_data)
                                .header("Content-Type", "image/jpeg")
                                .send()
                                .await
                            {
                                Ok(resp) => {
                                    if !resp.status().is_success() {
                                        println!(
                                            "Thumbnail upload failed with status: {}",
                                            resp.status()
                                        );
                                    } else {
                                        println!("Thumbnail uploaded successfully");
                                    }
                                }
                                Err(e) => {
                                    println!("Thumbnail upload error: {}", e);
                                    // We'll continue with the main file upload even if thumbnail fails
                                }
                            }
                        }
                        Err(e) => {
                            println!("Failed to generate thumbnail: {}", e);
                            // Continue with main file upload even if thumbnail generation fails
                        }
                    }
                }
            }

            println!("Response summary:");
            println!("  file_id: {}", &response.file_id);
            println!("  revision_id: {}", &response.revision_id);
            println!("  total_blocks: {}", &response.total_blocks);
            println!("  block_size: {}", &response.block_size);

            // Extract information from response
            let server_file_id = response.file_id;
            let revision_id = response.revision_id;
            let presigned_urls = response.upload_urls;
            let block_size = response.block_size;
            let total_blocks = presigned_urls.len();

            // Set up encryption with content key (required)
            let cipher = match general_purpose::STANDARD.decode(&response.content_key) {
                Ok(key_bytes) if key_bytes.len() == 32 => {
                    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
                    Aes256Gcm::new(key)
                }
                Ok(_) => {
                    let error = "Invalid encryption key length, must be 32 bytes".to_string();
                    handle_file_error(&app, &state, &item.id, &item.name, &Some(file_size), &error)
                        .await?;
                    return Err(error);
                }
                Err(e) => {
                    let error = format!("Failed to decode encryption key: {}", e);
                    handle_file_error(&app, &state, &item.id, &item.name, &Some(file_size), &error)
                        .await?;
                    return Err(error);
                }
            };

            println!("Cipher initialized successfully");

            if let Some(thumbnail_info) = response.thumbnail {
                // Emit progress update for thumbnail generation
                app.emit(
                    "transfer-progress",
                    TransferProgress {
                        id: item.id.clone(),
                        name: item.name.clone(),
                        item_type: "file".to_string(),
                        progress: 0.02,
                        status: "preparing".to_string(),
                        message: Some("Generating thumbnail...".to_string()),
                        speed: None,
                        remaining_time: None,
                        size: Some(file_size),
                    },
                )
                .map_err(|e| format!("Failed to emit progress: {}", e))?;

                // Generate thumbnail from the original file
                match generate_thumbnail(path).await {
                    Ok(thumbnail_data) => {
                        println!("  file_id: {}", &thumbnail_info.url);

                        // Encrypt the thumbnail with the same content key
                        // Create a fixed nonce for thumbnail encryption
                        let thumbnail_nonce_bytes = [0u8; 12];
                        let thumbnail_nonce = Nonce::from_slice(&thumbnail_nonce_bytes);

                        // Encrypt the thumbnail data
                        let encrypted_thumbnail =
                            match cipher.encrypt(thumbnail_nonce, thumbnail_data.as_ref()) {
                                Ok(encrypted) => encrypted,
                                Err(e) => {
                                    println!("Failed to encrypt thumbnail: {}", e);
                                    // Continue with main file upload even if thumbnail encryption fails
                                    Vec::new()
                                }
                            };

                        // Only proceed with upload if encryption was successful
                        if !encrypted_thumbnail.is_empty() {
                            // Create HTTP client
                            let client = reqwest::Client::builder()
                                .timeout(Duration::from_secs(60))
                                .build()
                                .unwrap_or_default();

                            // Upload the encrypted thumbnail
                            match client
                                .put(&thumbnail_info.url)
                                .body(encrypted_thumbnail.clone())
                                .header("Content-Type", "application/octet-stream")
                                .send()
                                .await
                            {
                                Ok(response) => {
                                    if response.status().is_success() {
                                        println!("Thumbnail uploaded successfully");

                                        // Calculate thumbnail hash
                                        let mut thumbnail_hasher = Sha256::default();
                                        thumbnail_hasher.update(&encrypted_thumbnail);
                                        let thumbnail_hash =
                                            format!("{:x}", thumbnail_hasher.finalize());

                                        // Notify backend about thumbnail completion
                                        app.emit(
                                            "thumbnail-complete",
                                            serde_json::json!({
                                                "thumbnail_id": thumbnail_info.id,
                                                "hash": thumbnail_hash,
                                                "size": encrypted_thumbnail.len(),
                                            }),
                                        )
                                        .map_err(|e| {
                                            format!("Failed to emit thumbnail completion: {}", e)
                                        })?;
                                    } else {
                                        println!(
                                            "Thumbnail upload failed with status: {}",
                                            response.status()
                                        );
                                    }
                                }
                                Err(e) => {
                                    println!("Thumbnail upload error: {}", e);
                                }
                            }
                        }
                    }
                    Err(e) => {
                        println!("Failed to generate thumbnail: {}", e);
                        // Continue with main file upload even if thumbnail generation fails
                    }
                }
            }

            // Update progress
            app.emit(
                "transfer-progress",
                TransferProgress {
                    id: item.id.clone(),
                    name: item.name.clone(),
                    item_type: "file".to_string(),
                    progress: 0.05,
                    status: "uploading".to_string(),
                    message: Some(format!("Starting upload of {} blocks...", total_blocks)),
                    speed: None,
                    remaining_time: None,
                    size: Some(file_size), // Add this line
                },
            )
            .map_err(|e| format!("Failed to emit progress: {}", e))?;

            // Open the file
            let mut file = match File::open(path).await {
                Ok(f) => f,
                Err(e) => {
                    let error = format!("Failed to open file: {}", e);
                    handle_file_error(&app, &state, &item.id, &item.name, &Some(file_size), &error)
                        .await?;
                    return Err(error);
                }
            };

            // Use _start_time to avoid unused variable warning
            let _start_time = Instant::now();
            let mut uploaded_bytes = 0u64;
            let mut completed_blocks = 0;

            // Add this for improved speed calculation
            const SPEED_SAMPLES: usize = 5;
            let mut speeds = Vec::with_capacity(SPEED_SAMPLES);
            let mut last_block_time = Instant::now();

            // Create SHA-256 hasher for content verification
            let mut hasher = Sha256::default();

            // Create HTTP client with retry capability
            let client = reqwest::Client::builder()
                .timeout(Duration::from_secs(300))
                .build()
                .unwrap_or_default();

            // Upload each block with retries
            for presigned_url in &presigned_urls {
                // Check if transfer was cancelled
                {
                    let queue = state.0.lock().await;
                    if queue.processing.is_none() || queue.paused {
                        return Ok(());
                    }
                }

                // Calculate block offset and size
                let offset = presigned_url.index as u64 * block_size;
                let current_block_size = if offset + block_size > file_size {
                    file_size - offset
                } else {
                    block_size
                };

                // Create buffer for this block only
                let mut buffer = vec![0u8; current_block_size as usize];

                // Seek to position and read block
                match file.seek(std::io::SeekFrom::Start(offset)).await {
                    Ok(_) => {}
                    Err(e) => {
                        let error = format!("Failed to seek in file: {}", e);
                        handle_file_error(
                            &app,
                            &state,
                            &item.id,
                            &item.name,
                            &Some(file_size),
                            &error,
                        )
                        .await?;
                        return Err(error);
                    }
                };

                match file.read_exact(&mut buffer).await {
                    Ok(_) => {}
                    Err(e) => {
                        let error = format!("Failed to read file block: {}", e);
                        handle_file_error(
                            &app,
                            &state,
                            &item.id,
                            &item.name,
                            &Some(file_size),
                            &error,
                        )
                        .await?;
                        return Err(error);
                    }
                };

                // Update hash with original content before encryption
                hasher.update(&buffer);

                // Encrypt the buffer with AES-GCM
                // Create a nonce from the block index
                let mut nonce_bytes = [0u8; 12]; // AES-GCM requires a 12-byte nonce
                let index_bytes = presigned_url.index.to_be_bytes();
                for i in 0..std::cmp::min(index_bytes.len(), nonce_bytes.len()) {
                    nonce_bytes[i] = index_bytes[i];
                }
                let nonce = Nonce::from_slice(&nonce_bytes);

                // Encrypt the buffer
                let upload_buffer = match cipher.encrypt(nonce, buffer.as_ref()) {
                    Ok(encrypted) => encrypted,
                    Err(e) => {
                        let error = format!("Failed to encrypt block: {}", e);
                        handle_file_error(
                            &app,
                            &state,
                            &item.id,
                            &item.name,
                            &Some(file_size),
                            &error,
                        )
                        .await?;
                        return Err(error);
                    }
                };

                // Upload block with retries
                let max_retries = 3;
                let mut retry_count = 0;
                let mut upload_success = false;

                while retry_count < max_retries && !upload_success {
                    match client
                        .put(&presigned_url.url)
                        .body(upload_buffer.clone())
                        .header("Content-Type", "application/octet-stream")
                        .send()
                        .await
                    {
                        Ok(response) => {
                            if response.status().is_success() {
                                upload_success = true;
                            } else {
                                println!(
                                    "Block upload attempt {} failed with status: {}, retrying...",
                                    retry_count + 1,
                                    response.status()
                                );
                                retry_count += 1;
                                tokio::time::sleep(Duration::from_millis(
                                    1000 * (retry_count as u64),
                                ))
                                .await;
                            }
                        }
                        Err(e) => {
                            println!(
                                "Block upload attempt {} failed with error: {}, retrying...",
                                retry_count + 1,
                                e
                            );
                            retry_count += 1;
                            tokio::time::sleep(Duration::from_millis(1000 * (retry_count as u64)))
                                .await;
                        }
                    }
                }

                if !upload_success {
                    let error = format!("Upload failed after {} retries", max_retries);
                    handle_file_error(&app, &state, &item.id, &item.name, &Some(file_size), &error)
                        .await?;
                    return Err(error);
                }

                // Calculate block hash (of the encrypted data being uploaded) using SHA-256
                let mut block_hasher = Sha256::default();
                block_hasher.update(&upload_buffer);
                let block_hash = format!("{:x}", block_hasher.finalize());

                // Create a unique key for this block to prevent duplicates
                let block_key = format!("{}:{}", presigned_url.block_id, presigned_url.index);

                // Check if we've already sent this block completion
                let already_sent_block = {
                    let mut queue = state.0.lock().await;
                    let exists = queue.block_completion_sent.contains(&block_key);
                    if !exists {
                        queue.block_completion_sent.insert(block_key);
                    }
                    exists
                };

                if !already_sent_block {
                    // Tell frontend to notify backend about block completion
                    app.emit(
                        "block-complete",
                        serde_json::json!({
                            "block_id": presigned_url.block_id,
                            "hash": block_hash,
                            "index": presigned_url.index,
                            "file_id": server_file_id
                        }),
                    )
                    .map_err(|e| format!("Failed to emit block completion: {}", e))?;
                }

                // Calculate block elapsed time and speed
                let block_elapsed = last_block_time.elapsed();
                last_block_time = Instant::now();

                if block_elapsed.as_secs_f64() > 0.0 {
                    let current_speed = current_block_size as f64 / block_elapsed.as_secs_f64();
                    speeds.push(current_speed);
                    if speeds.len() > SPEED_SAMPLES {
                        speeds.remove(0);
                    }
                }

                // Update progress tracking
                uploaded_bytes += current_block_size;
                completed_blocks += 1;
                let progress = uploaded_bytes as f32 / file_size as f32;

                // Use the average speed for calculations
                let avg_speed = if !speeds.is_empty() {
                    speeds.iter().sum::<f64>() / speeds.len() as f64
                } else {
                    0.0
                };

                // Calculate remaining time
                let remaining_bytes = file_size - uploaded_bytes;
                let remaining_time = if avg_speed > 0.1 {
                    // Threshold to avoid very large numbers
                    (remaining_bytes as f64 / avg_speed) as u64
                } else {
                    3600 // Default to 1 hour when speed is too low
                };

                // Update progress notification
                app.emit(
                    "transfer-progress",
                    TransferProgress {
                        id: item.id.clone(),
                        name: item.name.clone(),
                        item_type: "file".to_string(),
                        progress,
                        status: "uploading".to_string(),
                        message: Some(format!(
                            "Uploading block {}/{}",
                            completed_blocks, total_blocks
                        )),
                        speed: Some(avg_speed),
                        remaining_time: Some(remaining_time),
                        size: Some(file_size), // Add this line
                    },
                )
                .map_err(|e| format!("Failed to emit progress: {}", e))?;
            }

            // Calculate final content hash
            let content_hash = format!("{:x}", hasher.finalize());

            // Check if we've already sent finalization request for this file
            let finalization_already_sent = {
                let mut queue = state.0.lock().await;
                let exists = queue.completion_notifications_sent.contains(&item.id);
                if !exists {
                    queue.completion_notifications_sent.insert(item.id.clone());
                }
                exists
            };

            if !finalization_already_sent {
                // Send final progress update
                app.emit(
                    "transfer-progress",
                    TransferProgress {
                        id: item.id.clone(),
                        name: item.name.clone(),
                        item_type: "file".to_string(),
                        progress: 1.0,
                        status: "uploading".to_string(),
                        message: Some("Upload complete, finalizing...".to_string()),
                        speed: None,
                        remaining_time: None,
                        size: Some(file_size), // Add this line
                    },
                )
                .map_err(|e| format!("Failed to emit progress: {}", e))?;

                // Request frontend to finalize the transfer by updating content hash
                app.emit(
                    "finalize-transfer",
                    serde_json::json!({
                        "id": item.id.clone(),
                        "name": item.name.clone(),
                        "size": file_size,
                        "content_hash": content_hash,
                        "file_id": server_file_id,
                        "parent_id": parent_id,
                        "revision_id": revision_id
                    }),
                )
                .map_err(|e| format!("Failed to emit finalization request: {}", e))?;

                // Note: We don't mark as completed here - that happens when finalize_transfer_complete is called
                // The processing state stays active until finalization completes
            }
        }
    }

    // Don't mark as completed here - wait for finalize_transfer_complete

    Ok(())
}

/// Processes a folder for upload
async fn process_folder(
    app: AppHandle,
    state: State<'_, TransferManagerState>,
    item: QueueItem,
    share_id: String,
) -> Result<(), String> {
    let path = Path::new(&item.path);
    println!("Processing folder: {}", item.path);
    if !path.exists() || !path.is_dir() {
        return Err(format!(
            "Folder not found or is not a directory: {}",
            item.path
        ));
    }

    // Check if this folder has already been initialized
    let already_initialized = {
        let queue = state.0.lock().await;
        queue.initialized_folders.contains(&item.id)
    };

    if already_initialized {
        println!(
            "Folder {} already initialized, skipping initialization request",
            item.id
        );

        // If already initialized but not completed, mark as processing again
        let mut queue = state.0.lock().await;
        if !queue.completed.contains(&item.id) {
            queue.processing = Some(item.id.clone());
        } else {
            // If already completed, skip processing
            // Remove from pending folders if it was there
            queue.pending_folders.remove(&item.path);
            return Ok(());
        }
    } else {
        // Update state to mark as processing and track that we've initialized
        {
            let mut queue = state.0.lock().await;
            queue.processing = Some(item.id.clone());
            queue.initialized_folders.insert(item.id.clone());
        }

        // Emit event to notify progress start
        app.emit(
            "transfer-progress",
            TransferProgress {
                id: item.id.clone(),
                name: item.name.clone(),
                item_type: "folder".to_string(),
                progress: 0.0,
                status: "preparing".to_string(),
                message: Some("Scanning folder contents...".to_string()),
                speed: None,
                remaining_time: None,
                size: None, // Add this line
            },
        )
        .map_err(|e| format!("Failed to emit progress: {}", e))?;

        // Get parent_id from item or folder_id_map
        let parent_id = {
            let queue = state.0.lock().await;
            if let Some(mapped_id) = queue.folder_id_map.get(&item.parent_id) {
                mapped_id.clone()
            } else {
                item.parent_id.clone()
            }
        };

        // Check if we already received a folder response
        let already_received_response = {
            let queue = state.0.lock().await;
            queue.received_folder_responses.contains(&item.id)
        };

        if !already_received_response {
            // Set timestamp for this folder request
            {
                let mut queue = state.0.lock().await;
                queue
                    .request_timestamps
                    .insert(item.id.clone(), Instant::now());
            }

            // Send folder info to frontend for creation - once per folder
            app.emit(
                "create-folder",
                serde_json::json!({
                    "id": item.id,
                    "name": item.name,
                    "path": item.path,
                    "parent_id": parent_id,
                    "share_id": share_id
                }),
            )
            .map_err(|e| format!("Failed to request folder creation: {}", e))?;

            // Create a channel to wait for frontend response
            let (tx, rx) = tokio::sync::oneshot::channel::<Result<FolderResponse, String>>();

            {
                let mut channels = FOLDER_RESPONSE_CHANNELS.lock().await;
                channels.insert(item.id.clone(), tx);
            }

            // Mark that we're expecting a response
            {
                let mut queue = state.0.lock().await;
                queue.received_folder_responses.insert(item.id.clone());
            }

            // Wait for the response with timeout
            let folder_response = match tokio::time::timeout(Duration::from_secs(30), rx).await {
                Ok(Ok(Ok(response))) => {
                    // Clear the timestamp tracking since we got a response
                    let mut queue = state.0.lock().await;
                    queue.request_timestamps.remove(&item.id);

                    response
                }
                Ok(Ok(Err(e))) => {
                    let error = format!("{}", e);
                    handle_folder_error(&app, &state, &item.id, &item.name, &error).await?;

                    // Remove from pending folders
                    let mut queue = state.0.lock().await;
                    queue.pending_folders.remove(&item.path);

                    return Err(error);
                }
                Ok(Err(_)) => {
                    let error = "Channel closed before receiving response".to_string();
                    handle_folder_error(&app, &state, &item.id, &item.name, &error).await?;

                    // Remove from pending folders
                    let mut queue = state.0.lock().await;
                    queue.pending_folders.remove(&item.path);

                    return Err(error);
                }
                Err(_) => {
                    let error = "Timeout waiting for folder creation".to_string();

                    // Clear the timestamp tracking for this request
                    let mut queue = state.0.lock().await;
                    queue.request_timestamps.remove(&item.id);
                    queue.pending_folders.remove(&item.path);

                    handle_folder_error(&app, &state, &item.id, &item.name, &error).await?;
                    return Err(error);
                }
            };

            let folder_id = folder_response.folder_id;

            // Store folder ID mapping
            {
                let mut queue = state.0.lock().await;
                queue
                    .folder_id_map
                    .insert(item.path.clone(), folder_id.clone());
            }

            // Scan folder for subfolders and files
            let (subfolders, files) = match scan_folder(path).await {
                Ok(result) => result,
                Err(e) => {
                    let error = format!("Failed to scan folder: {}", e);
                    handle_folder_error(&app, &state, &item.id, &item.name, &error).await?;

                    // Remove from pending folders
                    let mut queue = state.0.lock().await;
                    queue.pending_folders.remove(&item.path);

                    return Err(error);
                }
            };

            // Update progress
            app.emit(
                "transfer-progress",
                TransferProgress {
                    id: item.id.clone(),
                    name: item.name.clone(),
                    item_type: "folder".to_string(),
                    progress: 0.3,
                    status: "processing".to_string(),
                    message: Some(format!(
                        "Found {} files and {} subfolders",
                        files.len(),
                        subfolders.len()
                    )),
                    speed: None,
                    remaining_time: None,
                    size: None, // Add this line
                },
            )
            .map_err(|e| format!("Failed to emit progress: {}", e))?;

            // Add subfolders and files to the queue in strict order
            {
                let mut queue = state.0.lock().await;
                let mut new_items = VecDeque::new();

                // Add the immediate contents of this folder to the front of the queue
                // Files are added directly after folders to ensure they're processed
                // in the natural file system order

                // First, get all the current items from the queue
                let existing_items: Vec<QueueItem> = queue.items.drain(..).collect();

                // Add direct files of the current folder - we process files first
                // within each folder's contents
                for file_path in files {
                    let file_name = file_path
                        .file_name()
                        .and_then(|name| name.to_str())
                        .unwrap_or("unknown")
                        .to_string();

                    new_items.push_back(QueueItem {
                        item_type: "file".to_string(),
                        id: generate_id(),
                        path: file_path.to_string_lossy().to_string(),
                        name: file_name,
                        parent_id: folder_id.clone(),
                        depth: 0, // Depth not used with this algorithm
                    });
                }

                // Then add subfolders
                for subfolder_path in subfolders {
                    let subfolder_name = subfolder_path
                        .file_name()
                        .and_then(|name| name.to_str())
                        .unwrap_or("unknown")
                        .to_string();

                    new_items.push_back(QueueItem {
                        item_type: "folder".to_string(),
                        id: generate_id(),
                        path: subfolder_path.to_string_lossy().to_string(),
                        name: subfolder_name,
                        parent_id: folder_id.clone(),
                        depth: 0, // Depth not used with this algorithm
                    });
                }

                // Now put all existing items after the folder contents
                for item in existing_items {
                    new_items.push_back(item);
                }

                // Update the queue with our ordered items
                queue.items = new_items;
            }

            // Check if we've already sent completion notification for this folder
            let notification_already_sent = {
                let mut queue = state.0.lock().await;
                let exists = queue.completion_notifications_sent.contains(&item.id);
                if !exists {
                    queue.completion_notifications_sent.insert(item.id.clone());
                }
                exists
            };

            if !notification_already_sent {
                // Emit final progress for folder
                app.emit(
                    "transfer-progress",
                    TransferProgress {
                        id: item.id.clone(),
                        name: item.name.clone(),
                        item_type: "folder".to_string(),
                        progress: 1.0,
                        status: "completed".to_string(),
                        message: Some(
                            "Folder processing complete, starting contents...".to_string(),
                        ),
                        speed: None,
                        remaining_time: None,
                        size: None, // Add this line
                    },
                )
                .map_err(|e| format!("Failed to emit progress: {}", e))?;

                // Emit folder completion event
                app.emit(
                    "transfer-complete",
                    serde_json::json!({
                        "id": item.id.clone(),
                        "name": item.name,
                        "status": "completed",
                        "message": "Folder created successfully"
                    }),
                )
                .map_err(|e| format!("Failed to emit folder completion: {}", e))?;
            }
        }
    }

    // Mark folder as completed in state
    {
        let mut queue = state.0.lock().await;
        queue.processing = None;
        queue.completed.insert(item.id.clone());
        queue.request_timestamps.remove(&item.id); // Ensure any leftover timestamps are cleared
        queue.pending_folders.remove(&item.path); // Remove from pending folders
    }

    process_next_item(app.clone(), state.clone(), share_id).await?;

    Ok(())
}

/// Handles errors that occur during file processing
async fn handle_file_error(
    app: &AppHandle,
    state: &State<'_, TransferManagerState>,
    id: &str,
    name: &str,
    file_size: &Option<u64>,
    error: &str,
) -> Result<(), String> {
    // Update state
    {
        let mut queue = state.0.lock().await;
        queue.processing = None;
        queue.failed.insert(id.to_string(), error.to_string());
        // Also clean up all tracking
        queue.initialized_files.remove(id);
        queue.completion_notifications_sent.remove(id);
        queue.received_url_responses.remove(id);
        queue.request_timestamps.remove(id);
    }

    // Emit error event
    app.emit(
        "transfer-progress",
        TransferProgress {
            id: id.to_string(),
            name: name.to_string(),
            item_type: "file".to_string(),
            progress: 0.0,
            status: "failed".to_string(),
            message: Some(error.to_string()),
            speed: None,
            remaining_time: None,
            size: *file_size, // Add this line
        },
    )
    .map_err(|e| format!("Failed to emit error: {}", e))?;

    // Also emit a transfer-complete with error for frontend to properly handle it
    app.emit(
        "transfer-complete",
        serde_json::json!({
            "id": id,
            "name": name,
            "status": "failed",
            "message": error
        }),
    )
    .map_err(|e| format!("Failed to emit completion error: {}", e))?;

    Ok(())
}

/// Handles errors that occur during folder processing
async fn handle_folder_error(
    app: &AppHandle,
    state: &State<'_, TransferManagerState>,
    id: &str,
    name: &str,
    error: &str,
) -> Result<(), String> {
    // Update state
    {
        let mut queue = state.0.lock().await;
        queue.processing = None;
        queue.failed.insert(id.to_string(), error.to_string());
        // Also clean up all tracking
        queue.initialized_folders.remove(id);
        queue.completion_notifications_sent.remove(id);
        queue.received_folder_responses.remove(id);
        queue.request_timestamps.remove(id);
    }

    // Emit error event
    app.emit(
        "transfer-progress",
        TransferProgress {
            id: id.to_string(),
            name: name.to_string(),
            item_type: "folder".to_string(),
            progress: 0.0,
            status: "failed".to_string(),
            message: Some(error.to_string()),
            speed: None,
            remaining_time: None,
            size: None, // Add this line
        },
    )
    .map_err(|e| format!("Failed to emit error: {}", e))?;

    // Also emit a transfer-complete with error for frontend to properly handle it
    app.emit(
        "transfer-complete",
        serde_json::json!({
            "id": id,
            "name": name,
            "status": "failed",
            "message": error
        }),
    )
    .map_err(|e| format!("Failed to emit completion error: {}", e))?;

    Ok(())
}

// Add a handler function for thumbnail completion
#[command]
pub fn handle_thumbnail_complete(payload: Option<&str>) -> Result<(), String> {
    if let Some(payload_str) = payload {
        if let Ok(payload_json) = serde_json::from_str::<serde_json::Value>(payload_str) {
            // Extract the thumbnail info
            let thumbnail_id = payload_json["thumbnail_id"].as_str().unwrap_or("");
            let hash = payload_json["hash"].as_str().unwrap_or("");
            let size = payload_json["size"].as_u64().unwrap_or(0);

            println!(
                "Thumbnail completed: id={}, hash={}, size={}",
                thumbnail_id, hash, size
            );

            // The frontend API will handle updating the server with this information
            return Ok(());
        }
    }

    Err("Invalid thumbnail completion payload".to_string())
}

/// Handler for URL response from frontend
#[command]
pub async fn upload_urls_response(
    payload: UploadUrlsResponsePayload,
    app: AppHandle,
) -> Result<(), String> {
    println!(
        "Received upload URLs response for transfer ID: {}",
        payload.transfer_id
    );

    // Check if we need to handle this response
    let mut channels = RESPONSE_CHANNELS.lock().await;
    if let Some(sender) = channels.remove(&payload.transfer_id) {
        if let Err(_) = sender.send(Ok(payload.response)) {
            println!("Failed to send response through channel - receiver dropped");
        } else {
            println!("Successfully sent response through channel");
        }
    } else {
        println!(
            "No waiting receiver found for transfer ID: {}",
            payload.transfer_id
        );

        // If no receiver was found, we should clear any state related to this ID
        let state = app.state::<TransferManagerState>();
        let mut queue = state.0.lock().await;
        queue.received_url_responses.remove(&payload.transfer_id);
        queue.request_timestamps.remove(&payload.transfer_id);
    }

    Ok(())
}

/// Handler for error response from frontend
#[command]
pub async fn upload_error_response(
    payload: ErrorResponsePayload,
    app: AppHandle,
) -> Result<(), String> {
    println!(
        "Received error response for transfer ID: {}: {}",
        payload.transfer_id, payload.error
    );

    let mut channels = RESPONSE_CHANNELS.lock().await;
    if let Some(sender) = channels.remove(&payload.transfer_id) {
        if let Err(_) = sender.send(Err(payload.error.clone())) {
            println!("Failed to send error through channel - receiver dropped");
        } else {
            println!("Successfully sent error through channel");
        }
    } else {
        println!(
            "No waiting receiver found for transfer ID: {}",
            payload.transfer_id
        );

        // If no receiver was found, we should clear any state related to this ID
        let state = app.state::<TransferManagerState>();
        let mut queue = state.0.lock().await;
        queue.received_url_responses.remove(&payload.transfer_id);
        queue.request_timestamps.remove(&payload.transfer_id);
    }

    // Get the item name for the error
    let item_name = {
        let state = app.state::<TransferManagerState>();
        let queue = state.0.lock().await;
        queue
            .items
            .iter()
            .find(|item| item.id == payload.transfer_id)
            .map(|item| item.name.clone())
            .unwrap_or_else(|| "Unknown".to_string())
    };

    // Update transfer state to failed
    handle_file_error(
        &app,
        &app.state::<TransferManagerState>(),
        &payload.transfer_id,
        &item_name,
        &None,
        &payload.error,
    )
    .await?;

    Ok(())
}

/// Handler for folder creation response from frontend
#[command]
pub async fn folder_created_response(
    transfer_id: String,
    response: FolderResponse,
    app: AppHandle,
) -> Result<(), String> {
    println!(
        "Received folder creation response for transfer ID: {}",
        transfer_id
    );

    let mut channels = FOLDER_RESPONSE_CHANNELS.lock().await;
    if let Some(sender) = channels.remove(&transfer_id) {
        if let Err(_) = sender.send(Ok(response)) {
            println!("Failed to send folder response through channel - receiver dropped");
        } else {
            println!("Successfully sent folder response through channel");
        }
    } else {
        println!(
            "No waiting receiver found for folder transfer ID: {}",
            transfer_id
        );

        // If no receiver was found, we should clear any state related to this ID
        let state = app.state::<TransferManagerState>();
        let mut queue = state.0.lock().await;
        queue.received_folder_responses.remove(&transfer_id);
        queue.request_timestamps.remove(&transfer_id);
    }

    Ok(())
}

/// Handler for folder error response from frontend
#[command]
pub async fn folder_error_response(
    transfer_id: String,
    error: String,
    app: AppHandle,
) -> Result<(), String> {
    println!(
        "Received folder error response for transfer ID: {}: {}",
        transfer_id, error
    );

    let mut channels = FOLDER_RESPONSE_CHANNELS.lock().await;
    if let Some(sender) = channels.remove(&transfer_id) {
        if let Err(_) = sender.send(Err(error.clone())) {
            println!("Failed to send folder error through channel - receiver dropped");
        } else {
            println!("Successfully sent folder error through channel");
        }
    } else {
        println!(
            "No waiting receiver found for folder transfer ID: {}",
            transfer_id
        );

        // If no receiver was found, we should clear any state related to this ID
        let state = app.state::<TransferManagerState>();
        let mut queue = state.0.lock().await;
        queue.received_folder_responses.remove(&transfer_id);
        queue.request_timestamps.remove(&transfer_id);
    }

    // Get the item name for the error
    let item_name = {
        let state = app.state::<TransferManagerState>();
        let queue = state.0.lock().await;
        queue
            .items
            .iter()
            .find(|item| item.id == transfer_id)
            .map(|item| item.name.clone())
            .unwrap_or_else(|| "Unknown".to_string())
    };

    // Update transfer state to failed
    handle_folder_error(
        &app,
        &app.state::<TransferManagerState>(),
        &transfer_id,
        &item_name,
        &error,
    )
    .await?;

    Ok(())
}

/// Cleans up any stuck or hanging transfers
#[command]
pub async fn cleanup_stuck_transfers(
    app: AppHandle,
    state: State<'_, TransferManagerState>,
) -> Result<serde_json::Value, String> {
    let cleaned_count;
    let mut cleaned_ids: Vec<String> = Vec::new();

    {
        let mut queue = state.0.lock().await;
        let current_time = Instant::now();
        let mut hanging_ids: Vec<String> = Vec::new();

        // Find all hanging requests (older than 35 seconds)
        let mut hanging_ids = Vec::new();
        for (id, timestamp) in &queue.request_timestamps {
            if current_time.duration_since(*timestamp) > Duration::from_secs(35) {
                hanging_ids.push(id.clone());
                println!("Found hanging request for ID: {}, will clean up", id);
            }
        }

        cleaned_count = hanging_ids.len();
        cleaned_ids = hanging_ids.clone();

        // Clean up each hanging request
        for id in &hanging_ids {
            queue.request_timestamps.remove(id);
            queue.received_url_responses.remove(id);
            queue.received_folder_responses.remove(id);

            // If this was the current processing item, clear it
            if let Some(processing_id) = &queue.processing {
                if processing_id == id {
                    queue.processing = None;
                }
            }

            queue
                .failed
                .insert(id.clone(), "Request timed out".to_string());
        }

        // Handle channels outside the main lock to avoid deadlocks
        for id in &hanging_ids {
            let item_name = queue
                .items
                .iter()
                .find(|item| &item.id == id)
                .map(|item| item.name.clone())
                .unwrap_or_else(|| "Unknown".to_string());

            // Also notify frontend of failure
            app.emit(
                "transfer-complete",
                serde_json::json!({
                    "id": id,
                    "name": item_name,
                    "status": "failed",
                    "message": "Request timed out"
                }),
            )
            .ok();
        }
    }

    // Handle channels
    let mut channels_to_clean = Vec::new();
    {
        let queue = state.0.lock().await;
        for (id, timestamp) in &queue.request_timestamps {
            if Instant::now().duration_since(*timestamp) > Duration::from_secs(35) {
                channels_to_clean.push(id.clone());
            }
        }
    }

    for id in &channels_to_clean {
        let mut channels = RESPONSE_CHANNELS.lock().await;
        if let Some(sender) = channels.remove(id) {
            let _ = sender.send(Err("Request timed out".to_string()));
        }

        let mut folder_channels = FOLDER_RESPONSE_CHANNELS.lock().await;
        if let Some(sender) = folder_channels.remove(id) {
            let _ = sender.send(Err("Request timed out".to_string()));
        }
    }

    // Recheck pending folders and clean up any that are stuck
    {
        let mut queue = state.0.lock().await;
        for id in &channels_to_clean {
            // Find any queue items that matched this ID and get their paths
            let path_to_remove = queue
                .items
                .iter()
                .find(|item| &item.id == id)
                .map(|item| item.path.clone());

            if let Some(path) = path_to_remove {
                queue.pending_folders.remove(&path);
            }
        }
    }

    // If we cleaned up any items, try to process the next one
    if !channels_to_clean.is_empty() {
        if let Some(share_id) = {
            let queue = state.0.lock().await;
            queue.original_share_id.clone()
        } {
            process_next_item(app.clone(), state.clone(), share_id).await?;
        }
    }

    // Return the number of cleaned up transfers
    Ok(serde_json::json!({
        "cleaned_count": cleaned_count,
        "cleaned_ids": channels_to_clean
    }))
}

/// Health check to verify frontend-backend communication
#[command]
pub async fn check_transfer_health() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "status": "healthy",
        "timestamp": chrono::Utc::now().timestamp(),
        "version": env!("CARGO_PKG_VERSION")
    }))
}

/// Checks and repairs pending folder state
#[command]
pub async fn repair_pending_folders(
    app: AppHandle,
    state: State<'_, TransferManagerState>,
) -> Result<serde_json::Value, String> {
    let mut repaired_count = 0;
    let original_share_id;

    {
        let mut queue = state.0.lock().await;
        original_share_id = queue.original_share_id.clone();

        // Check if any pending folders don't have a matching folder in the queue or processing
        let mut stale_pending_folders = Vec::new();

        for pending_path in queue.pending_folders.iter() {
            // Check if this folder is currently being processed
            let is_processing = if let Some(processing_id) = &queue.processing {
                queue.items.iter().any(|item| {
                    &item.id == processing_id
                        && item.item_type == "folder"
                        && &item.path == pending_path
                })
            } else {
                false
            };

            // Check if this folder is waiting in the queue
            let in_queue = queue
                .items
                .iter()
                .any(|item| item.item_type == "folder" && &item.path == pending_path);

            // If neither processing nor in queue, it's stale
            if !is_processing && !in_queue {
                stale_pending_folders.push(pending_path.clone());
            }
        }

        // Remove stale pending folders
        for stale_path in stale_pending_folders {
            queue.pending_folders.remove(&stale_path);
            repaired_count += 1;
        }
    }

    // If we repaired any items and processing is not active, try to process the next one
    if repaired_count > 0 {
        if let Some(share_id) = original_share_id {
            let is_processing = {
                let queue = state.0.lock().await;
                queue.processing.is_some() || queue.paused
            };

            if !is_processing {
                process_next_item(app.clone(), state.clone(), share_id).await?;
            }
        }
    }

    Ok(serde_json::json!({
        "repaired_count": repaired_count
    }))
}

/// Returns detailed queue status for debugging
#[command]
pub async fn get_detailed_queue_status(
    state: State<'_, TransferManagerState>,
) -> Result<serde_json::Value, String> {
    let queue = state.0.lock().await;

    // Format queue items for display
    let queue_items: Vec<serde_json::Value> = queue
        .items
        .iter()
        .map(|item| {
            serde_json::json!({
                "id": item.id,
                "type": item.item_type,
                "name": item.name,
                "depth": item.depth,
                "parent_id": item.parent_id
            })
        })
        .collect();

    // Format pending folders for display
    let pending_folders: Vec<String> = queue.pending_folders.iter().cloned().collect();

    // Format folder ID mappings
    let folder_mappings: HashMap<String, String> = queue.folder_id_map.clone();

    let result = serde_json::json!({
        "queue_size": queue.items.len(),
        "processing": queue.processing,
        "completed_count": queue.completed.len(),
        "failed_count": queue.failed.len(),
        "paused": queue.paused,
        "elapsed_time": queue.start_time.elapsed().as_secs(),
        "pending_folders_count": queue.pending_folders.len(),
        "queue_items": queue_items,
        "pending_folders": pending_folders,
        "folder_mappings": folder_mappings,
        "initialized_files_count": queue.initialized_files.len(),
        "initialized_folders_count": queue.initialized_folders.len(),
        "block_completion_sent_count": queue.block_completion_sent.len()
    });

    Ok(result)
}

/// Registers all the file transfer commands with Tauri
pub fn register_file_transfer_commands() -> Result<(), Box<dyn std::error::Error>> {
    println!("File transfer commands registered");
    Ok(())
}
