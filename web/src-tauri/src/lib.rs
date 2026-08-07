use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{
    tray::TrayIconBuilder,
    Manager,
};
use tauri_plugin_autostart::MacosLauncher;

/// Server process handle stored in Tauri state
pub struct ServerState {
    pub child: Mutex<Option<Child>>,
    pub port: Mutex<u16>,
    pub ready: Mutex<bool>,
}

/// Configuration exposed to the frontend
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ServerConfig {
    pub port: u16,
    pub host: String,
}

/// Find a free port starting from the given base
fn find_free_port(base: u16) -> u16 {
    for port in base..(base + 100) {
        if std::net::TcpListener::bind(("127.0.0.1", port)).is_ok() {
            return port;
        }
    }
    // Fallback: let the OS pick
    std::net::TcpListener::bind("127.0.0.1:0")
        .ok()
        .and_then(|l| l.local_addr().ok())
        .map(|a| a.port())
        .unwrap_or(base + 200)
}

/// Get the app data directory for Aruk
fn get_app_data_dir(app: &tauri::App) -> PathBuf {
    app.path()
        .app_data_dir()
        .expect("Failed to resolve app data directory")
}

/// Ensure the data directory exists and return its path
fn ensure_data_dir(app: &tauri::App) -> PathBuf {
    let data_dir = get_app_data_dir(app);
    let db_dir = data_dir.join("data");
    fs::create_dir_all(&db_dir).expect("Failed to create data directory");
    db_dir
}

/// Resolve the runtime executable (bun or node)
/// Priority: bundled next to exe → system PATH
fn get_runtime_executable() -> PathBuf {
    // 1. Check bundled runtime next to the executable
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let bundled = if cfg!(windows) {
                dir.join("bun.exe")
            } else {
                dir.join("bun")
            };
            if bundled.exists() {
                return bundled;
            }
        }
    }

    // 2. Fallback: rely on PATH resolution by the OS
    if cfg!(windows) {
        PathBuf::from("bun.exe")
    } else {
        PathBuf::from("bun")
    }
}

/// Resolve the server entry script path
fn get_server_entry(app: &tauri::App) -> PathBuf {
    app.path()
        .resource_dir()
        .expect("Failed to resolve resource dir")
        .join("server")
        .join("start.mjs")
}

/// Health check: poll the server until it responds 200
async fn wait_for_server(port: u16, max_wait_ms: u64) -> bool {
    let url = format!("http://127.0.0.1:{}/api/health", port);

    // Build a lightweight HTTP client for health checks
    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(500))
        .no_proxy()
        .build()
    {
        Ok(c) => c,
        Err(_) => {
            // If we can't build a client, just wait a fixed time
            tokio::time::sleep(std::time::Duration::from_secs(4)).await;
            return true;
        }
    };

    let start = std::time::Instant::now();
    while start.elapsed().as_millis() < max_wait_ms as u128 {
        match client.get(&url).send().await {
            Ok(resp) if resp.status().is_success() => return true,
            _ => tokio::time::sleep(std::time::Duration::from_millis(400)).await,
        }
    }
    false
}

/// Kill the server process gracefully, then force if needed
fn kill_server(child: &mut Child) {
    // Try graceful shutdown first (SIGTERM on Unix, Ctrl+C on Windows)
    #[cfg(unix)]
    {
        use std::os::unix::process::ExitStatusExt;
        let _ = child.kill();
    }
    #[cfg(windows)]
    {
        let _ = child.kill();
    }
    let _ = child.wait();
}

/// Spawn the Next.js server as a child process
fn spawn_server(port: u16, db_path: &str, server_entry: &PathBuf) -> Result<Child, String> {
    let runtime = get_runtime_executable();

    if !server_entry.exists() {
        return Err(format!(
            "Server entry not found: {}\nRun: bun run tauri:prepare",
            server_entry.display()
        ));
    }

    // Try the resolved runtime first (bundled bun.exe, or bun on PATH).
    // Only fall back to node.exe if that spawn actually fails — checking
    // `.exists()` on a bare "bun.exe" here would always be false even when
    // bun is perfectly resolvable via PATH, wrongly discarding it.
    match spawn_with_runtime(&runtime, port, db_path, server_entry) {
        Ok(child) => Ok(child),
        Err(e) if cfg!(windows) => {
            warn!(
                "Failed to spawn with {:?} ({}), retrying with node.exe",
                runtime, e
            );
            spawn_with_runtime(&PathBuf::from("node.exe"), port, db_path, server_entry)
        }
        Err(e) => Err(e),
    }
}

/// Helper to spawn the server with a given runtime executable
fn spawn_with_runtime(
    runtime: &PathBuf,
    port: u16,
    db_path: &str,
    server_entry: &PathBuf,
) -> Result<Child, String> {
    info!(
        "Starting server: {:?} {:?} (port={}, db={})",
        runtime, server_entry, port, db_path
    );

    let mut cmd = Command::new(runtime);
    cmd.arg(server_entry)
        .env("PORT", port.to_string())
        .env("HOSTNAME", "127.0.0.1")
        .env("DATABASE_URL", format!("file:{}/aruk.db", db_path))
        .env("NODE_ENV", "production")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // On Windows, prevent a console window from appearing
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    cmd.spawn().map_err(|e| format!("Failed to spawn server: {}", e))
}

/// Build the system tray with Show / Quit actions
fn build_tray(app: &tauri::AppHandle) -> tauri::tray::TrayIcon {
    let show = tauri::menu::MenuItemBuilder::with_id("show", "Show Aruk");
    let quit = tauri::menu::MenuItemBuilder::with_id("quit", "Quit");

    let menu = tauri::menu::MenuBuilder::new(app)
        .item(&show)
        .separator()
        .item(&quit)
        .build()
        .expect("Failed to build tray menu");

    TrayIconBuilder::new()
        .icon(app.default_window_icon().cloned().unwrap())
        .menu(&menu)
        .tooltip("Aruk — Keeper of Secrets and Keys")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            "quit" => {
                // Kill server before exit
                let state = app.state::<ServerState>();
                if let Ok(mut child) = state.child.lock() {
                    if let Some(ref mut c) = *child {
                        kill_server(c);
                    }
                }
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::DoubleClick { .. } = event {
                let app = tray.app_handle();
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
        })
        .build(app)
        .expect("Failed to build tray icon")
}

// ── Tauri Commands (callable from frontend) ──────────────────

#[tauri::command]
fn get_server_info(state: tauri::State<ServerState>) -> Result<ServerConfig, String> {
    Ok(ServerConfig {
        port: *state.port.lock().map_err(|e| e.to_string())?,
        host: "127.0.0.1".to_string(),
    })
}

#[tauri::command]
fn get_app_data_path(app: tauri::AppHandle) -> Result<String, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default())
}

#[tauri::command]
fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

// ── Main Entry Point ──────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Another instance launched — focus existing window
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_autostart::init(
                MacosLauncher::LaunchAgent, // ignored on Windows
                Some(vec!["--minimized"]),
            )
            .expect("Failed to init autostart plugin"),
        )
        .manage(ServerState {
            child: Mutex::new(None),
            port: Mutex::new(0),
            ready: Mutex::new(false),
        })
        .setup(|app| {
            // 1. System tray
            build_tray(app.handle());

            // 1b. Honor --minimized (passed by the autostart plugin) by
            // hiding the main window immediately instead of showing it.
            let start_minimized = std::env::args().any(|a| a == "--minimized");
            if start_minimized {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }

            // 2. Resolve paths
            let db_dir = ensure_data_dir(app);
            let db_path_str = db_dir.to_string_lossy().to_string();
            let server_entry = get_server_entry(app);
            let port = find_free_port(17321);

            info!("Aruk starting — port: {}, db: {}", port, db_path_str);

            // Store port in state
            *app.state::<ServerState>().port.lock().unwrap() = port;

            // 3. Spawn the server
            let child = match spawn_server(port, &db_path_str, &server_entry) {
                Ok(c) => c,
                Err(e) => {
                    error!("Failed to start server: {}", e);
                    // Use Tauri 2 dialog plugin for error display
                    let _ = tauri_plugin_dialog::MessageDialogBuilder::new(
                        "Aruk — Startup Error",
                        &format!(
                            "Failed to start the Aruk server.\n\n{}\n\nMake sure bun or Node.js is installed,\nor bundle bun.exe next to Aruk.exe.",
                            e
                        ),
                    )
                    .kind(tauri_plugin_dialog::MessageDialogKind::Error)
                    .show(|_response| {});
                    return Ok(());
                }
            };

            *app.state::<ServerState>().child.lock().unwrap() = Some(child);

            // 4. Background task: wait for server, then navigate window
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                let rt = tokio::runtime::Builder::new_current_thread()
                    .enable_all()
                    .build()
                    .expect("Failed to create tokio runtime");

                rt.block_on(async {
                    let ready = wait_for_server(port, 30_000).await;
                    if !ready {
                        error!("Server did not respond within 30 seconds");
                        return;
                    }

                    info!("Server ready on port {} — navigating window", port);
                    *app_handle.state::<ServerState>().ready.lock().unwrap() = true;

                    if let Some(window) = app_handle.get_webview_window("main") {
                        let url = format!("http://127.0.0.1:{}", port);
                        if let Err(e) = window.eval(&format!("window.location.href = '{}';", url)) {
                            error!("Failed to navigate window: {}", e);
                        }
                    }
                });
            });

            // 5. Window close → minimize to tray
            if let Some(window) = app.get_webview_window("main") {
                let _handler = window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = event.window().hide();
                    }
                });
                // Leak the handler so it stays alive
                std::mem::forget(_handler);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_server_info, get_app_data_path, get_version])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
