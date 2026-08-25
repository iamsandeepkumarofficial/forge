// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde_json::Value;
use std::fs;
use std::path::PathBuf;

fn forge_config_path() -> PathBuf {
    dirs_next_home()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".forge")
        .join("config.json")
}

fn dirs_next_home() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}

#[tauri::command]
fn get_status() -> String {
    "Forge desktop supervisor stub — infra commands are TODO (RFC 0002)".into()
}

#[tauri::command]
fn preflight_docker() -> Result<String, String> {
    // TODO: run `docker info` / `docker version` and return a clear error if
    // the daemon is missing or unhealthy (show install guidance in the UI).
    Err("TODO: implement preflight_docker".into())
}

#[tauri::command]
fn start_infra() -> Result<String, String> {
    // TODO: `docker compose up -d` for postgres, temporal, minio from the
    // bundled docker-compose.yml; wait for health checks (especially Postgres).
    // TODO: build forge-sandbox image if missing (Dockerfile.sandbox).
    // TODO: spawn tool-plane server, orchestrator worker, preview-plane with
    // a generated random FORGE_POC_TOKEN bound to 127.0.0.1.
    Err("TODO: implement start_infra (docker compose up)".into())
}

#[tauri::command]
fn stop_infra() -> Result<String, String> {
    // TODO: stop spawned Node processes, then optionally `docker compose stop`
    // when ~/.forge/config.json desktop.stopComposeOnQuit is true.
    Err("TODO: implement stop_infra".into())
}

#[tauri::command]
fn read_config() -> Result<Value, String> {
    // TODO: prefer OS secure store for API keys when a Tauri plugin is wired.
    let path = forge_config_path();
    if !path.exists() {
        return Ok(serde_json::json!({
            "llm": { "provider": null, "model": null, "apiKey": null },
            "desktop": { "stopComposeOnQuit": true }
        }));
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_config(config: Value) -> Result<(), String> {
    let path = forge_config_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let raw = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(&path, raw).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_status,
            preflight_docker,
            start_infra,
            stop_infra,
            read_config,
            write_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running Forge desktop");
}
