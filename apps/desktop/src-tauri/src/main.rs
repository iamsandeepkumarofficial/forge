// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde_json::Value;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::{Emitter, Manager};

struct InfraState {
    children: Mutex<Vec<Child>>,
    started: Mutex<bool>,
}

fn forge_home() -> PathBuf {
    dirs_next_home()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".forge")
}

fn forge_config_path() -> PathBuf {
    forge_home().join("config.json")
}

fn dirs_next_home() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}

fn repo_root() -> Result<PathBuf, String> {
    if let Ok(override_root) = std::env::var("FORGE_REPO_ROOT") {
        let p = PathBuf::from(override_root);
        if p.is_dir() {
            return Ok(p);
        }
    }
    let mut dir = std::env::current_dir().map_err(|e| e.to_string())?;
    for _ in 0..8 {
        if dir.join("pnpm-workspace.yaml").exists() || dir.join("docker-compose.yml").exists() {
            return Ok(dir);
        }
        if !dir.pop() {
            break;
        }
    }
    // Running from apps/desktop/src-tauri
    let exe_related = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let candidate = exe_related
        .parent()
        .and_then(|p| p.parent())
        .and_then(|p| p.parent())
        .map(|p| p.to_path_buf());
    if let Some(root) = candidate {
        if root.join("docker-compose.yml").exists() {
            return Ok(root);
        }
    }
    Err("Could not locate Forge repository root (set FORGE_REPO_ROOT)".into())
}

fn run_capture(cmd: &str, args: &[&str], cwd: &Path) -> Result<String, String> {
    let output = Command::new(cmd)
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("failed to run {cmd}: {e}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Err(format!(
            "{cmd} {} failed: {stderr}{stdout}",
            args.join(" ")
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn materialize_llm_env(config: &Value) -> Vec<(String, String)> {
    let mut out = Vec::new();
    if let Some(llm) = config.get("llm") {
        if let Some(key) = llm.get("openaiApiKey").and_then(|v| v.as_str()) {
            if !key.is_empty() {
                out.push(("OPENAI_API_KEY".into(), key.into()));
            }
        }
        if let Some(key) = llm.get("anthropicApiKey").and_then(|v| v.as_str()) {
            if !key.is_empty() {
                out.push(("ANTHROPIC_API_KEY".into(), key.into()));
            }
        }
        if let Some(key) = llm.get("apiKey").and_then(|v| v.as_str()) {
            if !key.is_empty() {
                let provider = llm
                    .get("provider")
                    .and_then(|v| v.as_str())
                    .unwrap_or("openai-compatible")
                    .to_lowercase();
                match provider.as_str() {
                    "anthropic" => out.push(("ANTHROPIC_API_KEY".into(), key.into())),
                    "openai" => out.push(("OPENAI_API_KEY".into(), key.into())),
                    _ => out.push(("OPENAI_COMPATIBLE_API_KEY".into(), key.into())),
                }
            }
        }
        if let Some(model) = llm.get("model").and_then(|v| v.as_str()) {
            if !model.is_empty() {
                out.push(("OPENAI_COMPATIBLE_MODEL".into(), model.into()));
                out.push(("WORKFLOW_LLM_MODEL".into(), model.into()));
            }
        }
        if let Some(base) = llm.get("baseUrl").and_then(|v| v.as_str()) {
            if !base.is_empty() {
                out.push(("OPENAI_COMPATIBLE_BASE_URL".into(), base.into()));
            }
        }
    }
    out
}

/// Local desktop defaults so Preview uses hostname reverse proxy (in-process on server).
fn materialize_preview_env() -> Vec<(String, String)> {
    vec![
        ("PREVIEW_IN_PROCESS".into(), "1".into()),
        (
            "FORGE_PREVIEW_BASE_DOMAIN".into(),
            "preview.localhost".into(),
        ),
        ("PREVIEW_URL_SCHEME".into(), "http".into()),
        (
            "PREVIEW_PLANE_URL".into(),
            "http://127.0.0.1:8081".into(),
        ),
        (
            "PREVIEW_PUBLIC_ORIGIN".into(),
            "http://127.0.0.1:8081".into(),
        ),
    ]
}

fn merge_env_extras(parts: &[Vec<(String, String)>]) -> Vec<(String, String)> {
    let mut out = Vec::new();
    for part in parts {
        for (k, v) in part {
            if let Some((_, existing)) = out.iter_mut().find(|(ek, _)| ek == k) {
                *existing = v.clone();
            } else {
                out.push((k.clone(), v.clone()));
            }
        }
    }
    out
}

fn spawn_pnpm_filter(
    root: &Path,
    filter: &str,
    script: &str,
    env_extra: &[(String, String)],
) -> Result<Child, String> {
    let mut cmd = Command::new("pnpm");
    cmd.args(["--filter", filter, "run", script])
        .current_dir(root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env("FORGE_BIND_HOST", "127.0.0.1");
    for (k, v) in env_extra {
        cmd.env(k, v);
    }
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("failed to spawn {filter} ({script}): {e}"))?;
    if let Some(stdout) = child.stdout.take() {
        let label = filter.to_string();
        thread::spawn(move || {
            for line in BufReader::new(stdout).lines().flatten() {
                eprintln!("[{label}] {line}");
            }
        });
    }
    if let Some(stderr) = child.stderr.take() {
        let label = filter.to_string();
        thread::spawn(move || {
            for line in BufReader::new(stderr).lines().flatten() {
                eprintln!("[{label}] {line}");
            }
        });
    }
    Ok(child)
}

fn wait_for_http(url: &str, attempts: u32) -> Result<(), String> {
    for i in 0..attempts {
        if let Ok(status) = Command::new("curl")
            .args(["-sf", url])
            .status()
        {
            if status.success() {
                return Ok(());
            }
        }
        if i + 1 < attempts {
            thread::sleep(Duration::from_millis(500));
        }
    }
    Err(format!("timed out waiting for {url}"))
}

fn sandbox_image_exists() -> bool {
    Command::new("docker")
        .args(["image", "inspect", "forge-sandbox:latest"])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

#[tauri::command]
fn get_status(state: tauri::State<'_, InfraState>) -> String {
    let started = *state.started.lock().unwrap_or_else(|e| e.into_inner());
    if started {
        "Forge desktop supervisor — infra running".into()
    } else {
        "Forge desktop supervisor — infra not started".into()
    }
}

#[tauri::command]
fn preflight_docker() -> Result<String, String> {
    match run_capture("docker", &["info"], Path::new(".")) {
        Ok(_) => Ok("Docker daemon is healthy".into()),
        Err(err) => Err(format!(
            "Docker is missing or not running. Install Docker Desktop (or a compatible engine) and try again. ({err})"
        )),
    }
}

#[tauri::command]
fn start_infra(app: tauri::AppHandle, state: tauri::State<'_, InfraState>) -> Result<String, String> {
    {
        let started = state.started.lock().map_err(|e| e.to_string())?;
        if *started {
            return Ok("Infra already started".into());
        }
    }

    preflight_docker()?;
    let root = repo_root()?;

    run_capture(
        "docker",
        &["compose", "up", "-d", "postgres", "temporal"],
        &root,
    )?;

    // Wait for Postgres health
    for _ in 0..40 {
        let ok = Command::new("docker")
            .args([
                "exec",
                "forge-postgres",
                "pg_isready",
                "-U",
                "postgres",
            ])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false);
        if ok {
            break;
        }
        thread::sleep(Duration::from_millis(500));
    }

    if !sandbox_image_exists() {
        eprintln!("[forge-desktop] building forge-sandbox:latest …");
        run_capture(
            "docker",
            &[
                "build",
                "-f",
                "Dockerfile.sandbox",
                "-t",
                "forge-sandbox:latest",
                ".",
            ],
            &root,
        )?;
    }

    let config = read_config().unwrap_or_else(|_| {
        serde_json::json!({
            "llm": {},
            "desktop": { "stopComposeOnQuit": true }
        })
    });
    let env_extra = merge_env_extras(&[
        materialize_llm_env(&config),
        materialize_preview_env(),
    ]);

    let server = spawn_pnpm_filter(&root, "@forge/server", "dev", &env_extra)?;
    let orch = spawn_pnpm_filter(&root, "@forge/orchestrator", "dev", &env_extra)?;

    {
        let mut children = state.children.lock().map_err(|e| e.to_string())?;
        children.push(server);
        children.push(orch);
        let mut started = state.started.lock().map_err(|e| e.to_string())?;
        *started = true;
    }

    // Best-effort wait for tool-plane health
    let _ = wait_for_http("http://127.0.0.1:4000/health", 60);

    let _ = app.emit("forge://infra-ready", "ok");
    Ok("Infra started (postgres, temporal, server, orchestrator; preview in-process)".into())
}

#[tauri::command]
fn stop_infra(state: tauri::State<'_, InfraState>) -> Result<String, String> {
    {
        let mut children = state.children.lock().map_err(|e| e.to_string())?;
        for child in children.iter_mut() {
            let _ = child.kill();
            let _ = child.wait();
        }
        children.clear();
        let mut started = state.started.lock().map_err(|e| e.to_string())?;
        *started = false;
    }

    let stop_compose = read_config()
        .ok()
        .and_then(|c| {
            c.get("desktop")
                .and_then(|d| d.get("stopComposeOnQuit"))
                .and_then(|v| v.as_bool())
        })
        .unwrap_or(true);

    if stop_compose {
        if let Ok(root) = repo_root() {
            let _ = run_capture("docker", &["compose", "stop"], &root);
        }
    }

    Ok("Infra stopped".into())
}

#[tauri::command]
fn read_config() -> Result<Value, String> {
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
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(InfraState {
            children: Mutex::new(Vec::new()),
            started: Mutex::new(false),
        })
        .invoke_handler(tauri::generate_handler![
            get_status,
            preflight_docker,
            start_infra,
            stop_infra,
            read_config,
            write_config
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            thread::spawn(move || {
                thread::sleep(Duration::from_millis(800));
                let state = handle.state::<InfraState>();
                match start_infra(handle.clone(), state) {
                    Ok(msg) => eprintln!("[forge-desktop] {msg}"),
                    Err(err) => eprintln!("[forge-desktop] start_infra failed: {err}"),
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let app = window.app_handle();
                let state = app.state::<InfraState>();
                let _ = stop_infra(state);
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Forge desktop");
}
