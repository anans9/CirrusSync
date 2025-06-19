use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;
use tauri::{Emitter, Manager, Theme};
mod file_transfer;
mod system_identity;
use file_transfer::TransferManagerState;
use std::sync::Arc;
use system_identity::generate_system_identifier;
use tokio::sync::Mutex as AsyncMutex;
mod recovery_key;

// Store state for basic key-value storage
#[derive(Default)]
struct AppState {
    auth_store_path: Mutex<Option<PathBuf>>,
}

// Initialize the app and set up storage directories
#[tauri::command]
async fn initialize_app(app: tauri::AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .expect("Failed to get app data directory");

    // Set up store directory
    let store_path = app_dir.join("store");

    println!("Store path: {:?}", store_path);

    // Make sure the directory exists
    fs::create_dir_all(&store_path)
        .map_err(|e| format!("Failed to create store directory: {}", e))?;

    // Store the path for later use
    *state.auth_store_path.lock().unwrap() = Some(store_path);

    Ok(())
}

// Store a value in JSON file
#[tauri::command]
async fn set_store_value(
    state: State<'_, AppState>,
    key: String,
    value: String,
) -> Result<(), String> {
    let state_guard = state.auth_store_path.lock().unwrap();
    let store_path = state_guard.as_ref().ok_or("Store not initialized")?;

    let file_path = store_path.join(format!("{}.json", key));
    fs::write(&file_path, value).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

// Get a value from JSON file
#[tauri::command]
async fn get_store_value(
    state: State<'_, AppState>,
    key: String,
) -> Result<Option<String>, String> {
    let state_guard = state.auth_store_path.lock().unwrap();
    let store_path = state_guard.as_ref().ok_or("Store not initialized")?;

    let file_path = store_path.join(format!("{}.json", key));

    if !file_path.exists() {
        return Ok(None);
    }

    let content =
        fs::read_to_string(file_path).map_err(|e| format!("Failed to read file: {}", e))?;
    Ok(Some(content))
}

// Delete a value from JSON file
#[tauri::command]
async fn delete_store_value(state: State<'_, AppState>, key: String) -> Result<(), String> {
    let state_guard = state.auth_store_path.lock().unwrap();
    let store_path = state_guard.as_ref().ok_or("Store not initialized")?;

    let file_path = store_path.join(format!("{}.json", key));

    if file_path.exists() {
        fs::remove_file(file_path).map_err(|e| format!("Failed to delete file: {}", e))?;
    }

    Ok(())
}

// Functions for secure password storage (simulating a keychain)
#[tauri::command]
async fn set_password(
    state: State<'_, AppState>,
    service: String,
    username: String,
    password: String,
) -> Result<(), String> {
    let state_guard = state.auth_store_path.lock().unwrap();
    let store_path = state_guard.as_ref().ok_or("Store not initialized")?;

    // Create a secure directory for storing passwords
    let secure_dir = store_path.join("secure");
    fs::create_dir_all(&secure_dir)
        .map_err(|e| format!("Failed to create secure directory: {}", e))?;

    // Create a file name from service and username
    let file_name = format!("{}_{}.secure", service, username);
    let file_path = secure_dir.join(file_name);

    // Write password to file
    // Note: In production, you should encrypt this data
    fs::write(&file_path, password).map_err(|e| format!("Failed to write password file: {}", e))?;

    Ok(())
}

#[tauri::command]
async fn get_password(
    state: State<'_, AppState>,
    service: String,
    username: String,
) -> Result<String, String> {
    let state_guard = state.auth_store_path.lock().unwrap();
    let store_path = state_guard.as_ref().ok_or("Store not initialized")?;

    let secure_dir = store_path.join("secure");
    let file_name = format!("{}_{}.secure", service, username);
    let file_path = secure_dir.join(file_name);

    if !file_path.exists() {
        return Err(format!("No password found for {}/{}", service, username));
    }

    // Read password from file
    let password = fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read password file: {}", e))?;

    Ok(password)
}

#[tauri::command]
async fn delete_password(
    state: State<'_, AppState>,
    service: String,
    username: String,
) -> Result<(), String> {
    let state_guard = state.auth_store_path.lock().unwrap();
    let store_path = state_guard.as_ref().ok_or("Store not initialized")?;

    let secure_dir = store_path.join("secure");
    let file_name = format!("{}_{}.secure", service, username);
    let file_path = secure_dir.join(file_name);

    if file_path.exists() {
        fs::remove_file(file_path).map_err(|e| format!("Failed to delete password file: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
fn set_window_theme(window: tauri::Window, is_dark: bool) -> Result<(), String> {
    // Use a dedicated error handler for better error reporting
    fn handle_theme_error(e: impl std::fmt::Display) -> String {
        format!("Failed to set window theme: {}", e)
    }

    // First log the request for debugging
    println!(
        "Setting window theme: {}",
        if is_dark { "dark" } else { "light" }
    );

    // Set the theme with proper error handling
    window
        .set_theme(Some(if is_dark { Theme::Dark } else { Theme::Light }))
        .map_err(handle_theme_error)?;

    // Log successful theme change
    println!(
        "Window theme set successfully to {}",
        if is_dark { "dark" } else { "light" }
    );

    Ok(())
}

#[tauri::command]
async fn check_if_directory(path: String) -> Result<bool, String> {
    let path = std::path::Path::new(&path);
    match path.metadata() {
        Ok(metadata) => Ok(metadata.is_dir()),
        Err(e) => Err(e.to_string()),
    }
}

// Add this as a new Tauri command
#[tauri::command]
fn frontend_ready(window: tauri::Window) -> Result<(), String> {
    println!("Frontend ready, showing window");
    window.show().map_err(|e| e.to_string())
}

#[tauri::command]
fn resize_window(window: tauri::Window, session: bool) -> Result<(), String> {
    if session {
        // Clear any existing size constraints first
        window
            .set_min_size(Some(tauri::LogicalSize::new(800.0, 600.0)))
            .map_err(|e| e.to_string())?;

        window
            .set_max_size::<tauri::LogicalSize<f64>>(None)
            .map_err(|e| e.to_string())?;

        // Set the initial size
        window
            .set_size(tauri::LogicalSize::new(800.0, 600.0))
            .map_err(|e| e.to_string())?;

        // Make the window resizable
        window.set_resizable(true).map_err(|e| e.to_string())?;
    } else {
        // For login window - fixed size
        window
            .set_size(tauri::LogicalSize::new(500.0, 600.0))
            .map_err(|e| e.to_string())?;

        window
            .set_max_size(Some(tauri::LogicalSize::new(500.0, 600.0)))
            .map_err(|e| e.to_string())?;

        // Make the window non-resizable
        window.set_resizable(false).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .setup(|app| {
            let transfer_manager = Arc::new(AsyncMutex::new(file_transfer::TransferQueue::new()));
            app.manage(TransferManagerState(transfer_manager));

            let window = app.get_webview_window("main").unwrap();

            window.hide().unwrap();

            // window.eval("document.addEventListener('contextmenu', event => event.preventDefault(), false);").unwrap();

            #[cfg(debug_assertions)]
            {
                window.open_devtools();
                window.close_devtools();
            }

            #[cfg(target_os = "macos")]
            {
                // Create and set the initial application menu (no file selected)
                let menu = menu_builder::build_menu(app)?;
                app.set_menu(menu)?;

                // Set up event handlers for menu items
                setup_menu_event_handlers(app);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            frontend_ready,
            resize_window,
            set_window_theme,
            initialize_app,
            set_store_value,
            get_store_value,
            delete_store_value,
            set_password,
            get_password,
            delete_password,
            file_transfer::select_files,
            file_transfer::select_folders,
            file_transfer::cancel_transfer,
            file_transfer::cancel_all_transfers,
            file_transfer::pause_transfers,
            file_transfer::resume_transfers,
            file_transfer::get_queue_status,
            file_transfer::handle_thumbnail_complete,
            file_transfer::upload_urls_response,
            file_transfer::folder_created_response,
            file_transfer::upload_error_response,
            file_transfer::folder_error_response,
            file_transfer::finalize_transfer_complete,
            file_transfer::check_transfer_health,
            file_transfer::cleanup_stuck_transfers,
            file_transfer::repair_pending_folders,
            file_transfer::get_detailed_queue_status,
            check_if_directory,
            generate_system_identifier,
            recovery_key::generate_recovery_phrase,
            recovery_key::derive_seed_from_password,
            recovery_key::generate_recovery_phrase,
            recovery_key::verify_recovery_phrase,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// Enhanced cloud operations module
mod menu_builder {
    use chrono::Datelike;
    use tauri::{
        Manager, Runtime,
        menu::{
            AboutMetadata, Menu, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, Submenu,
            SubmenuBuilder,
        },
    };

    // Build a comprehensive static menu with all options
    pub fn build_menu<R: Runtime, M: Manager<R>>(
        manager: &M,
    ) -> Result<Menu<R>, Box<dyn std::error::Error>> {
        // App menu (macOS)
        let app_submenu = build_app_submenu(manager)?;

        // File menu
        let file_submenu = build_file_submenu(manager)?;

        // Folder menu
        let folder_submenu = build_folder_submenu(manager)?;

        // Trash menu
        let trash_submenu = build_trash_submenu(manager)?;

        // Edit menu
        let edit_submenu = build_edit_submenu(manager)?;

        // Window menu
        let window_submenu: Submenu<R> = build_window_submenu(manager)?;

        // Help menu
        let help_submenu = build_help_submenu(manager)?;

        // Build the complete menu
        let menu = MenuBuilder::new(manager)
            .items(&[
                &app_submenu,
                &file_submenu,
                &folder_submenu,
                &trash_submenu,
                &edit_submenu,
                &window_submenu,
                &help_submenu,
            ])
            .item(&PredefinedMenuItem::copy(manager, Some("Window"))?)
            .build()?;

        Ok(menu)
    }

    // App menu
    pub fn build_app_submenu<R: Runtime, M: Manager<R>>(
        manager: &M,
    ) -> Result<Submenu<R>, Box<dyn std::error::Error>> {
        let settings = MenuItemBuilder::new("Account Settings...")
            .id("settings")
            .build(manager)?;
        let logout = MenuItemBuilder::new("Logout").id("logout").build(manager)?;

        let copyright = format!("© {} CirrusSync Solutions LLC", chrono::Local::now().year());

        let submenu = SubmenuBuilder::new(manager, "App")
            .about(Some(AboutMetadata {
                copyright: Some(copyright.to_string()),
                ..Default::default()
            }))
            .separator()
            .item(&settings)
            .separator()
            .services()
            .separator()
            .item(&logout)
            .separator()
            .hide()
            .hide_others()
            .quit()
            .build()?;

        Ok(submenu)
    }

    // File submenu with all file operations
    pub fn build_file_submenu<R: Runtime, M: Manager<R>>(
        manager: &M,
    ) -> Result<Submenu<R>, Box<dyn std::error::Error>> {
        let preview = MenuItemBuilder::new("Preview")
            .id("preview_file")
            .accelerator("Space")
            .enabled(false)
            .build(manager)?;

        let rename = MenuItemBuilder::new("Rename")
            .id("rename_file")
            .accelerator("CmdOrCtrl+R")
            .enabled(false)
            .build(manager)?;

        let move_file = MenuItemBuilder::new("Move to Folder...")
            .id("move_file")
            .accelerator("CmdOrCtrl+M")
            .enabled(false)
            .build(manager)?;

        let details = MenuItemBuilder::new("Details")
            .id("file_details")
            .accelerator("CmdOrCtrl+I")
            .enabled(false)
            .build(manager)?;

        let move_to_trash = MenuItemBuilder::new("Move to Trash")
            .id("move_to_trash")
            .accelerator("Delete")
            .enabled(false)
            .build(manager)?;

        let download = MenuItemBuilder::new("Download")
            .id("download_file")
            .accelerator("CmdOrCtrl+D")
            .enabled(false)
            .build(manager)?;

        let upload_file = MenuItemBuilder::new("Upload")
            .id("upload_file")
            .accelerator("CmdOrCtrl+U")
            .enabled(false)
            .build(manager)?;

        let submenu = SubmenuBuilder::new(manager, "File")
            .item(&upload_file)
            .separator()
            .item(&preview)
            .item(&rename)
            .item(&move_file)
            .item(&details)
            .separator()
            .item(&download)
            .separator()
            .item(&move_to_trash)
            .build()?;

        Ok(submenu)
    }

    // Folder submenu
    pub fn build_folder_submenu<R: Runtime, M: Manager<R>>(
        manager: &M,
    ) -> Result<Submenu<R>, Box<dyn std::error::Error>> {
        let new_folder = MenuItemBuilder::new("New")
            .id("new_folder")
            .accelerator("CmdOrCtrl+Shift+N")
            .enabled(false)
            .build(manager)?;

        let upload_folder = MenuItemBuilder::new("Upload")
            .id("upload_folder")
            .accelerator("CmdOrCtrl+Shift+U")
            .enabled(false)
            .build(manager)?;

        let rename_folder = MenuItemBuilder::new("Rename")
            .id("rename_folder")
            .accelerator("CmdOrCtrl+Shift+R")
            .enabled(false)
            .build(manager)?;

        let move_folder_to_trash = MenuItemBuilder::new("Move to Trash")
            .id("move_folder_to_trash")
            .accelerator("Delete")
            .enabled(false)
            .build(manager)?;

        let folder_details = MenuItemBuilder::new("Details")
            .id("folder_details")
            .accelerator("CmdOrCtrl+I")
            .enabled(false)
            .build(manager)?;

        let submenu = SubmenuBuilder::new(manager, "Folder")
            .item(&new_folder)
            .item(&upload_folder)
            .separator()
            .item(&rename_folder)
            .item(&folder_details)
            .separator()
            .item(&move_folder_to_trash)
            .build()?;

        Ok(submenu)
    }

    // Edit submenu
    pub fn build_edit_submenu<R: Runtime, M: Manager<R>>(
        manager: &M,
    ) -> Result<Submenu<R>, Box<dyn std::error::Error>> {
        let undo = MenuItemBuilder::new("Undo")
            .id("undo")
            .accelerator("CmdOrCtrl+Z")
            .enabled(false)
            .build(manager)?;

        let redo = MenuItemBuilder::new("Redo")
            .id("redo")
            .accelerator("CmdOrCtrl+Y")
            .enabled(false)
            .build(manager)?;

        let select_all = MenuItemBuilder::new("Select All")
            .id("select_all")
            .accelerator("CmdOrCtrl+A")
            .enabled(false)
            .build(manager)?;

        let submenu = SubmenuBuilder::new(manager, "Edit")
            .item(&undo)
            .item(&redo)
            .separator()
            .item(&select_all)
            .build()?;

        Ok(submenu)
    }

    // Trash submenu
    pub fn build_trash_submenu<R: Runtime, M: Manager<R>>(
        manager: &M,
    ) -> Result<Submenu<R>, Box<dyn std::error::Error>> {
        let empty_trash = MenuItemBuilder::new("Empty Trash")
            .id("empty_trash")
            .accelerator("CmdOrCtrl+Shift+Delete")
            .enabled(false)
            .build(manager)?;

        let select_all_trash = MenuItemBuilder::new("Select All")
            .id("select_all_trash")
            .accelerator("CmdOrCtrl+Shift+A")
            .enabled(false)
            .build(manager)?;

        let recover_all = MenuItemBuilder::new("Recover All")
            .id("recover_all")
            .accelerator("CmdOrCtrl+Shift+R")
            .enabled(false)
            .build(manager)?;

        let recover_selected = MenuItemBuilder::new("Recover Selected")
            .id("recover_selected")
            .accelerator("CmdOrCtrl+Shift+E")
            .enabled(false)
            .build(manager)?;

        let delete_selected = MenuItemBuilder::new("Delete Selected")
            .id("delete_selected")
            .accelerator("CmdOrCtrl+Shift+D")
            .enabled(false)
            .build(manager)?;

        let submenu: Submenu<R> = SubmenuBuilder::new(manager, "Trash")
            .item(&select_all_trash)
            .separator()
            .item(&recover_all)
            .item(&recover_selected)
            .separator()
            .item(&delete_selected)
            .separator()
            .item(&empty_trash)
            .build()?;

        Ok(submenu)
    }

    // In your build_window_submenu function
    pub fn build_window_submenu<R: Runtime, M: Manager<R>>(
        manager: &M,
    ) -> Result<Submenu<R>, Box<dyn std::error::Error>> {
        // Create window menu items using PredefinedMenuItem
        let minimize = PredefinedMenuItem::minimize(manager, None)?;

        // For zoom (maximize), we need to create it manually since there's no predefined one
        let zoom = MenuItemBuilder::new("Zoom")
            .id("window_zoom")
            .build(manager)?;

        // For "Bring All to Front"
        let front = MenuItemBuilder::new("Bring All to Front")
            .id("window_front")
            .build(manager)?;

        // For close
        let close = PredefinedMenuItem::close_window(manager, None)?;

        // Build the window submenu
        let submenu = SubmenuBuilder::new(manager, "Window")
            .item(&minimize)
            .item(&zoom)
            .separator()
            .item(&front)
            .separator()
            .item(&close)
            .build()?;

        Ok(submenu)
    }

    // Help submenu
    pub fn build_help_submenu<R: Runtime, M: Manager<R>>(
        manager: &M,
    ) -> Result<Submenu<R>, Box<dyn std::error::Error>> {
        let docs = MenuItemBuilder::new("Documentation")
            .id("docs")
            .accelerator("CmdOrCtrl+D")
            .build(manager)?;

        let privacy = MenuItemBuilder::new("Privacy Statement")
            .id("privacy")
            .accelerator("CmdOrCtrl+P")
            .build(manager)?;

        let report_issue = MenuItemBuilder::new("Report an Issue")
            .id("report_issue")
            .accelerator("CmdOrCtrl+I")
            .build(manager)?;

        let request_feature = MenuItemBuilder::new("Request a Feature")
            .id("request_feature")
            .accelerator("CmdOrCtrl+F")
            .build(manager)?;

        let submenu = SubmenuBuilder::new(manager, "Help")
            .item(&docs)
            .separator()
            .item(&privacy)
            .separator()
            .item(&report_issue)
            .item(&request_feature)
            .build()?;

        Ok(submenu)
    }
}

// Set up event handlers for menu items
fn setup_menu_event_handlers(app: &tauri::App) {
    app.on_menu_event(move |app, event| {
        let menu_id = event.id().0.as_str();

        match menu_id {
            // App menu
            "settings" => {
                let _ = app.emit("app-event", "settings");
            }

            "logout" => {
                let _ = app.emit("app-event", "logout");
            }

            // File menu
            "preview_file" => {
                let _ = app.emit("file-event", "preview");
            }
            "rename_file" => {
                let _ = app.emit("file-event", "rename");
            }
            "move_file" => {
                let _ = app.emit("file-event", "move");
            }
            "file_details" => {
                let _ = app.emit("file-event", "details");
            }
            "move_to_trash" => {
                let _ = app.emit("file-event", "trash");
            }
            "download_file" => {
                let _ = app.emit("file-event", "download");
            }
            "upload_file" => {
                let _ = app.emit("file-event", "upload-file");
            }

            // Folder menu
            "new_folder" => {
                let _ = app.emit("folder-event", "new-folder");
            }
            "upload_folder" => {
                let _ = app.emit("folder-event", "upload-folder");
            }
            "rename_folder" => {
                let _ = app.emit("folder-event", "rename-folder");
            }
            "move_folder_to_trash" => {
                let _ = app.emit("folder-event", "trash-folder");
            }
            "folder_details" => {
                let _ = app.emit("folder-event", "folder-details");
            }

            // Edit menu
            "undo" => {
                let _ = app.emit("edit-event", "undo");
            }
            "redo" => {
                let _ = app.emit("edit-event", "redo");
            }
            "select_all" => {
                let _ = app.emit("edit-event", "select-all");
            }

            // Trash menu
            "empty_trash" => {
                let _ = app.emit("trash-event", "empty-trash");
            }
            "select_all_trash" => {
                let _ = app.emit("trash-event", "select-all-trash");
            }
            "recover_all" => {
                let _ = app.emit("trash-event", "recover-all");
            }
            "recover_selected" => {
                let _ = app.emit("trash-event", "recover-selected");
            }
            "delete_selected" => {
                let _ = app.emit("trash-event", "delete-selected");
            }

            // Help menu
            "docs" => {
                let _ = app.emit("help-event", "docs");
            }
            "privacy" => {
                let _ = app.emit("help-event", "privacy");
            }
            "license" => {
                let _ = app.emit("help-event", "license");
            }
            "report_issue" => {
                let _ = app.emit("help-event", "report-issue");
            }
            "request_feature" => {
                let _ = app.emit("help-event", "request-feature");
            }

            _ => {}
        }
    });
}
