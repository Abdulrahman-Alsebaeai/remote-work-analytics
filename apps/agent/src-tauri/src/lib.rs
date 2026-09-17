use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use chrono::Utc;
use keyring::Entry;
use rand::{rngs::OsRng, RngCore};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::{path::PathBuf, sync::Mutex, time::Duration};
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;

mod collector;

const CREDENTIAL_SERVICE: &str = "RemoteWorkAgent";
const REFRESH_ACCOUNT: &str = "refresh-token";
const ACCESS_ACCOUNT: &str = "access-token";
const API_ACCOUNT: &str = "api-url";
const KEY_ACCOUNT: &str = "outbox-key";

struct AppState {
    db: Mutex<Connection>,
    auth: Mutex<Option<AuthState>>,
    sync_status: Mutex<SyncStatus>,
    collector: Mutex<collector::CollectorState>,
    key: [u8; 32],
}
struct AuthState {
    api_url: String,
    access_token: String,
}

#[derive(Default)]
struct SyncStatus {
    online: bool,
    last_attempt_at: Option<String>,
    last_success_at: Option<String>,
    error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SyncStatusView {
    online: bool,
    last_attempt_at: Option<String>,
    last_success_at: Option<String>,
    error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionView {
    session_id: Option<String>,
    status: String,
    started_at: Option<String>,
    pending_events: i64,
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentEvent {
    id: String,
    session_id: String,
    r#type: String,
    occurred_at: String,
    payload: serde_json::Value,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TokenPair {
    access_token: String,
    refresh_token: String,
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OrganizationSettingsResponse {
    font_key: String,
    typography_scale: String,
    screenshot_interval_seconds: u64,
}
#[derive(Deserialize)]
struct SyncResponse {
    acknowledged: Vec<String>,
}
struct PendingScreenshot {
    id: String,
    session_id: String,
    path: String,
    nonce: Vec<u8>,
    captured_at: String,
    width: u32,
    height: u32,
}

fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    Ok(directory.join("agent.db"))
}
fn initialize_db(path: PathBuf) -> Result<Connection, String> {
    let db = Connection::open(path).map_err(|e| e.to_string())?;
    db.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS session_state(id INTEGER PRIMARY KEY CHECK(id=1), session_id TEXT, status TEXT NOT NULL, started_at TEXT);
      INSERT OR IGNORE INTO session_state(id,status) VALUES(1,'IDLE');
      CREATE TABLE IF NOT EXISTS agent_preferences(id INTEGER PRIMARY KEY CHECK(id=1), screenshot_interval_seconds INTEGER NOT NULL CHECK(screenshot_interval_seconds BETWEEN 10 AND 3600));
      CREATE TABLE IF NOT EXISTS outbox(id TEXT PRIMARY KEY, session_id TEXT NOT NULL, ciphertext BLOB NOT NULL, nonce BLOB NOT NULL, created_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at TEXT);
      CREATE INDEX IF NOT EXISTS idx_outbox_retry ON outbox(next_attempt_at,created_at);
      CREATE TABLE IF NOT EXISTS screenshot_outbox(id TEXT PRIMARY KEY, session_id TEXT NOT NULL, encrypted_path TEXT NOT NULL, nonce BLOB NOT NULL, captured_at TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at TEXT);
      CREATE INDEX IF NOT EXISTS idx_screenshot_retry ON screenshot_outbox(next_attempt_at,captured_at);").map_err(|e| e.to_string())?;
    let preferences_sql = db
        .query_row(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='agent_preferences'",
            [],
            |row| row.get::<_, String>(0),
        )
        .unwrap_or_default();
    if preferences_sql.contains("BETWEEN 30 AND 3600") {
        db.execute_batch(
            "BEGIN IMMEDIATE;
             ALTER TABLE agent_preferences RENAME TO agent_preferences_legacy;
             CREATE TABLE agent_preferences(id INTEGER PRIMARY KEY CHECK(id=1), screenshot_interval_seconds INTEGER NOT NULL CHECK(screenshot_interval_seconds BETWEEN 10 AND 3600));
             INSERT INTO agent_preferences(id,screenshot_interval_seconds) SELECT id,screenshot_interval_seconds FROM agent_preferences_legacy;
             DROP TABLE agent_preferences_legacy;
             COMMIT;",
        )
        .map_err(|e| e.to_string())?;
    }
    let default_interval = std::env::var("SCREENSHOT_INTERVAL_SECONDS")
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(300)
        .clamp(10, 3600);
    db.execute(
        "INSERT OR IGNORE INTO agent_preferences(id,screenshot_interval_seconds) VALUES(1,?1)",
        params![default_interval],
    )
    .map_err(|e| e.to_string())?;
    Ok(db)
}
fn encryption_key() -> Result<[u8; 32], String> {
    let entry = Entry::new(CREDENTIAL_SERVICE, KEY_ACCOUNT).map_err(|e| e.to_string())?;
    if let Ok(saved) = entry.get_password() {
        let bytes = STANDARD.decode(saved).map_err(|e| e.to_string())?;
        return bytes
            .try_into()
            .map_err(|_| "Invalid stored encryption key".to_string());
    }
    let mut key = [0u8; 32];
    OsRng.fill_bytes(&mut key);
    entry
        .set_password(&STANDARD.encode(key))
        .map_err(|e| e.to_string())?;
    Ok(key)
}
fn queue_event(
    db: &Connection,
    key: &[u8; 32],
    session_id: &str,
    event_type: &str,
    payload: serde_json::Value,
) -> Result<(), String> {
    let event = AgentEvent {
        id: Uuid::new_v4().to_string(),
        session_id: session_id.to_string(),
        r#type: event_type.to_string(),
        occurred_at: Utc::now().to_rfc3339(),
        payload,
    };
    let plaintext = serde_json::to_vec(&event).map_err(|e| e.to_string())?;
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| e.to_string())?;
    let mut nonce = [0u8; 12];
    OsRng.fill_bytes(&mut nonce);
    let encrypted = cipher
        .encrypt(Nonce::from_slice(&nonce), plaintext.as_ref())
        .map_err(|e| e.to_string())?;
    db.execute(
        "INSERT INTO outbox(id,session_id,ciphertext,nonce,created_at) VALUES(?1,?2,?3,?4,?5)",
        params![
            event.id,
            session_id,
            encrypted,
            nonce.to_vec(),
            event.occurred_at
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
fn transition(
    state: &AppState,
    expected: &str,
    next: &str,
    event_type: &str,
    new_session: bool,
) -> Result<(), String> {
    let mut db = state.db.lock().map_err(|_| "Database lock poisoned")?;
    let tx = db.transaction().map_err(|e| e.to_string())?;
    let (current, existing): (String, Option<String>) = tx
        .query_row(
            "SELECT status,session_id FROM session_state WHERE id=1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map_err(|e| e.to_string())?;
    if current != expected {
        return Err(format!("Invalid transition from {current}"));
    }
    let session_id = if new_session {
        Uuid::new_v4().to_string()
    } else {
        existing.ok_or("Missing active session")?
    };
    queue_event(
        &tx,
        &state.key,
        &session_id,
        event_type,
        serde_json::json!({}),
    )?;
    let started = if new_session {
        Some(Utc::now().to_rfc3339())
    } else {
        tx.query_row("SELECT started_at FROM session_state WHERE id=1", [], |r| {
            r.get::<_, Option<String>>(0)
        })
        .map_err(|e| e.to_string())?
    };
    if next == "IDLE" {
        tx.execute(
            "UPDATE session_state SET session_id=NULL,status='IDLE',started_at=NULL WHERE id=1",
            [],
        )
        .map_err(|e| e.to_string())?;
    } else {
        tx.execute(
            "UPDATE session_state SET session_id=?1,status=?2,started_at=?3 WHERE id=1",
            params![session_id, next, started],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())
}

#[tauri::command]
async fn login(
    api_url: String,
    email: String,
    password: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let url = format!("{}/auth/login", api_url.trim_end_matches('/'));
    let response = reqwest::Client::new()
        .post(url)
        .json(&serde_json::json!({"email":email,"password":password}))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err("Authentication failed".into());
    }
    let tokens: TokenPair = response.json().await.map_err(|e| e.to_string())?;
    Entry::new(CREDENTIAL_SERVICE, REFRESH_ACCOUNT)
        .map_err(|e| e.to_string())?
        .set_password(&tokens.refresh_token)
        .map_err(|e| e.to_string())?;
    Entry::new(CREDENTIAL_SERVICE, API_ACCOUNT)
        .map_err(|e| e.to_string())?
        .set_password(api_url.trim_end_matches('/'))
        .map_err(|e| e.to_string())?;
    Entry::new(CREDENTIAL_SERVICE, ACCESS_ACCOUNT)
        .map_err(|e| e.to_string())?
        .set_password(&tokens.access_token)
        .map_err(|e| e.to_string())?;
    *state
        .auth
        .lock()
        .map_err(|_| "Authentication lock poisoned")? = Some(AuthState {
        api_url: api_url.trim_end_matches('/').into(),
        access_token: tokens.access_token,
    });
    Ok(())
}

#[tauri::command]
async fn restore_session(state: State<'_, AppState>) -> Result<bool, String> {
    let api_url = match Entry::new(CREDENTIAL_SERVICE, API_ACCOUNT)
        .map_err(|e| e.to_string())?
        .get_password()
    {
        Ok(value) if !value.trim().is_empty() => value,
        _ => return Ok(false),
    };
    let refresh_token = match Entry::new(CREDENTIAL_SERVICE, REFRESH_ACCOUNT)
        .map_err(|e| e.to_string())?
        .get_password()
    {
        Ok(value) if !value.trim().is_empty() => value,
        _ => return Ok(false),
    };
    let cached_access = Entry::new(CREDENTIAL_SERVICE, ACCESS_ACCOUNT)
        .map_err(|e| e.to_string())?
        .get_password()
        .ok();
    let response = match reqwest::Client::new()
        .post(format!("{}/auth/refresh", api_url.trim_end_matches('/')))
        .json(&serde_json::json!({"refreshToken": refresh_token}))
        .send()
        .await
    {
        Ok(response) => response,
        Err(_) => {
            if let Some(access_token) = cached_access {
                *state
                    .auth
                    .lock()
                    .map_err(|_| "Authentication lock poisoned")? = Some(AuthState {
                    api_url: api_url.trim_end_matches('/').into(),
                    access_token,
                });
                return Ok(true);
            }
            return Ok(false);
        }
    };
    if !response.status().is_success() {
        return Ok(false);
    }
    let tokens: TokenPair = response.json().await.map_err(|e| e.to_string())?;
    Entry::new(CREDENTIAL_SERVICE, REFRESH_ACCOUNT)
        .map_err(|e| e.to_string())?
        .set_password(&tokens.refresh_token)
        .map_err(|e| e.to_string())?;
    Entry::new(CREDENTIAL_SERVICE, ACCESS_ACCOUNT)
        .map_err(|e| e.to_string())?
        .set_password(&tokens.access_token)
        .map_err(|e| e.to_string())?;
    *state
        .auth
        .lock()
        .map_err(|_| "Authentication lock poisoned")? = Some(AuthState {
        api_url: api_url.trim_end_matches('/').into(),
        access_token: tokens.access_token,
    });
    Ok(true)
}

#[tauri::command]
async fn organization_preferences(
    state: State<'_, AppState>,
) -> Result<OrganizationSettingsResponse, String> {
    let (api_url, access_token) = {
        let auth = state
            .auth
            .lock()
            .map_err(|_| "Authentication lock poisoned")?;
        let auth = auth.as_ref().ok_or("Sign in required")?;
        (auth.api_url.clone(), auth.access_token.clone())
    };
    let client = reqwest::Client::new();
    let mut response = client
        .get(format!("{api_url}/settings"))
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        let access_token = refresh_access(&state, &api_url, &client).await?;
        response = client
            .get(format!("{api_url}/settings"))
            .bearer_auth(access_token)
            .send()
            .await
            .map_err(|e| e.to_string())?;
    }
    if !response.status().is_success() {
        return Err("Unable to load organization settings".into());
    }
    let mut settings: OrganizationSettingsResponse =
        response.json().await.map_err(|e| e.to_string())?;
    settings.screenshot_interval_seconds = settings.screenshot_interval_seconds.clamp(10, 3600);
    {
        let db = state.db.lock().map_err(|_| "Database lock poisoned")?;
        db.execute(
            "UPDATE agent_preferences SET screenshot_interval_seconds=?1 WHERE id=1",
            params![settings.screenshot_interval_seconds],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(settings)
}

async fn authenticated_get(state: &AppState, path: &str) -> Result<serde_json::Value, String> {
    let (api_url, access_token) = {
        let auth = state
            .auth
            .lock()
            .map_err(|_| "Authentication lock poisoned")?;
        let auth = auth.as_ref().ok_or("Sign in required")?;
        (auth.api_url.clone(), auth.access_token.clone())
    };
    let client = reqwest::Client::new();
    let mut response = client
        .get(format!("{api_url}{path}"))
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        let access_token = refresh_access(state, &api_url, &client).await?;
        response = client
            .get(format!("{api_url}{path}"))
            .bearer_auth(access_token)
            .send()
            .await
            .map_err(|e| e.to_string())?;
    }
    if !response.status().is_success() {
        return Err(format!("Request failed: {}", response.status()));
    }
    response.json().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn employee_profile(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    authenticated_get(&state, "/auth/me").await
}

#[tauri::command]
async fn employee_tasks(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    authenticated_get(&state, "/tasks").await
}

#[tauri::command]
async fn employee_dashboard(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    authenticated_get(&state, "/analytics/dashboard").await
}

#[tauri::command]
async fn employee_notifications(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    authenticated_get(&state, "/notifications").await
}

#[tauri::command]
async fn update_task_progress(
    task_id: String,
    progress: u8,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    if progress > 100 {
        return Err("Progress must be between 0 and 100".into());
    }
    let (api_url, access_token) = {
        let auth = state
            .auth
            .lock()
            .map_err(|_| "Authentication lock poisoned")?;
        let auth = auth.as_ref().ok_or("Sign in required")?;
        (auth.api_url.clone(), auth.access_token.clone())
    };
    let client = reqwest::Client::new();
    let endpoint = format!("{api_url}/tasks/{task_id}/progress");
    let body = serde_json::json!({"progress": progress});
    let mut response = client
        .patch(&endpoint)
        .bearer_auth(access_token)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        let access_token = refresh_access(&state, &api_url, &client).await?;
        response = client
            .patch(&endpoint)
            .bearer_auth(access_token)
            .json(&body)
            .send()
            .await
            .map_err(|e| e.to_string())?;
    }
    if !response.status().is_success() {
        return Err(format!("Unable to update task: {}", response.status()));
    }
    response.json().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn mark_notification_read(
    notification_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let (api_url, access_token) = {
        let auth = state
            .auth
            .lock()
            .map_err(|_| "Authentication lock poisoned")?;
        let auth = auth.as_ref().ok_or("Sign in required")?;
        (auth.api_url.clone(), auth.access_token.clone())
    };
    let client = reqwest::Client::new();
    let endpoint = format!("{api_url}/notifications/{notification_id}/read");
    let mut response = client
        .patch(&endpoint)
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        let access_token = refresh_access(&state, &api_url, &client).await?;
        response = client
            .patch(&endpoint)
            .bearer_auth(access_token)
            .send()
            .await
            .map_err(|e| e.to_string())?;
    }
    if !response.status().is_success() {
        return Err(format!(
            "Unable to update notification: {}",
            response.status()
        ));
    }
    Ok(())
}

#[tauri::command]
fn sync_status(state: State<'_, AppState>) -> Result<SyncStatusView, String> {
    let status = state
        .sync_status
        .lock()
        .map_err(|_| "Synchronization lock poisoned")?;
    Ok(SyncStatusView {
        online: status.online,
        last_attempt_at: status.last_attempt_at.clone(),
        last_success_at: status.last_success_at.clone(),
        error: status.error.clone(),
    })
}

#[tauri::command]
async fn logout(state: State<'_, AppState>) -> Result<(), String> {
    if session_state(state.clone())?.status != "IDLE" {
        return Err("End the active session before signing out".into());
    }
    let api_url = Entry::new(CREDENTIAL_SERVICE, API_ACCOUNT)
        .ok()
        .and_then(|entry| entry.get_password().ok());
    let refresh_token = Entry::new(CREDENTIAL_SERVICE, REFRESH_ACCOUNT)
        .ok()
        .and_then(|entry| entry.get_password().ok());
    if let (Some(api_url), Some(refresh_token)) = (&api_url, &refresh_token) {
        let _ = reqwest::Client::new()
            .post(format!("{}/auth/logout", api_url.trim_end_matches('/')))
            .json(&serde_json::json!({"refreshToken":refresh_token}))
            .send()
            .await;
    }
    if let Ok(entry) = Entry::new(CREDENTIAL_SERVICE, REFRESH_ACCOUNT) {
        let _ = entry.delete_credential();
    }
    if let Ok(entry) = Entry::new(CREDENTIAL_SERVICE, ACCESS_ACCOUNT) {
        let _ = entry.delete_credential();
    }
    *state
        .auth
        .lock()
        .map_err(|_| "Authentication lock poisoned")? = None;
    Ok(())
}
#[tauri::command]
fn session_state(state: State<'_, AppState>) -> Result<SessionView, String> {
    let db = state.db.lock().map_err(|_| "Database lock poisoned")?;
    let (session_id, status, started_at) = db
        .query_row(
            "SELECT session_id,status,started_at FROM session_state WHERE id=1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .map_err(|e| e.to_string())?;
    let pending_events: i64 = db
        .query_row("SELECT COUNT(*) FROM outbox", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let pending_screenshots: i64 = db
        .query_row("SELECT COUNT(*) FROM screenshot_outbox", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    Ok(SessionView {
        session_id,
        status,
        started_at,
        pending_events: pending_events + pending_screenshots,
    })
}
#[tauri::command]
fn start_session(state: State<'_, AppState>) -> Result<(), String> {
    transition(&state, "IDLE", "ACTIVE", "SESSION_STARTED", true)
}
#[tauri::command]
fn pause_session(state: State<'_, AppState>) -> Result<(), String> {
    if session_state(state.clone())?.status != "ACTIVE" {
        return Err("No active session".into());
    }
    collector::close_current(&state);
    transition(&state, "ACTIVE", "PAUSED", "SESSION_PAUSED", false)
}
#[tauri::command]
fn resume_session(state: State<'_, AppState>) -> Result<(), String> {
    transition(&state, "PAUSED", "ACTIVE", "SESSION_RESUMED", false)
}
#[tauri::command]
fn end_session(state: State<'_, AppState>) -> Result<(), String> {
    let current = session_state(state.clone())?.status;
    if current != "ACTIVE" && current != "PAUSED" {
        return Err("No active session".into());
    }
    if current == "ACTIVE" {
        collector::close_current(&state);
    }
    transition(&state, &current, "IDLE", "SESSION_ENDED", false)
}

fn close_for_shutdown(state: &AppState) -> Result<(), String> {
    let status = {
        let db = state.db.lock().map_err(|_| "Database lock poisoned")?;
        db.query_row("SELECT status FROM session_state WHERE id=1", [], |row| row.get::<_, String>(0)).map_err(|e| e.to_string())?
    };
    if status == "ACTIVE" {
        collector::close_current(state);
        transition(state, "ACTIVE", "IDLE", "SESSION_ENDED", false)?;
    } else if status == "PAUSED" {
        transition(state, "PAUSED", "IDLE", "SESSION_ENDED", false)?;
    }
    Ok(())
}

async fn synchronize_inner(state: &AppState) -> Result<(), String> {
    let (api_url, token) = {
        let auth = state
            .auth
            .lock()
            .map_err(|_| "Authentication lock poisoned")?;
        let auth = auth.as_ref().ok_or("Sign in required")?;
        (auth.api_url.clone(), auth.access_token.clone())
    };
    let events: Vec<AgentEvent> = {
        let db = state.db.lock().map_err(|_| "Database lock poisoned")?;
        let cipher = Aes256Gcm::new_from_slice(&state.key).map_err(|e| e.to_string())?;
        let mut stmt = db.prepare("SELECT ciphertext,nonce FROM outbox WHERE next_attempt_at IS NULL OR next_attempt_at<=?1 ORDER BY created_at LIMIT 100").map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([Utc::now().to_rfc3339()], |r| {
                Ok((r.get::<_, Vec<u8>>(0)?, r.get::<_, Vec<u8>>(1)?))
            })
            .map_err(|e| e.to_string())?;
        rows.filter_map(Result::ok)
            .map(|(data, nonce)| {
                cipher
                    .decrypt(Nonce::from_slice(&nonce), data.as_ref())
                    .map_err(|e| e.to_string())
                    .and_then(|plain| serde_json::from_slice(&plain).map_err(|e| e.to_string()))
            })
            .collect::<Result<_, _>>()?
    };
    let client = reqwest::Client::new();
    let health = client
        .get(format!("{api_url}/health/ready"))
        .timeout(Duration::from_secs(5))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !health.status().is_success() {
        return Err(format!("Server unavailable: {}", health.status()));
    }
    if !events.is_empty() {
        let body = serde_json::json!({"events": &events});
        let mut response = client
            .post(format!("{api_url}/agent/sync"))
            .bearer_auth(token)
            .json(&body)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if response.status() == reqwest::StatusCode::UNAUTHORIZED {
            let access_token = refresh_access(state, &api_url, &client).await?;
            response = client
                .post(format!("{api_url}/agent/sync"))
                .bearer_auth(access_token)
                .json(&body)
                .send()
                .await
                .map_err(|e| e.to_string())?;
        }
        if !response.status().is_success() {
            let db = state.db.lock().map_err(|_| "Database lock poisoned")?;
            db.execute("UPDATE outbox SET attempts=attempts+1,next_attempt_at=datetime('now',printf('+%d seconds',min(300,(1 << min(attempts,4))*15)))", []).map_err(|e| e.to_string())?;
            return Err(format!("Synchronization failed: {}", response.status()));
        }
        let result: SyncResponse = response.json().await.map_err(|e| e.to_string())?;
        let db = state.db.lock().map_err(|_| "Database lock poisoned")?;
        for id in result.acknowledged {
            db.execute("DELETE FROM outbox WHERE id=?1", [id])
                .map_err(|e| e.to_string())?;
        }
    }
    synchronize_screenshots(state, &api_url, &client).await
}

async fn refresh_access(
    state: &AppState,
    api_url: &str,
    client: &reqwest::Client,
) -> Result<String, String> {
    let refresh_token = Entry::new(CREDENTIAL_SERVICE, REFRESH_ACCOUNT)
        .map_err(|e| e.to_string())?
        .get_password()
        .map_err(|_| "Sign in required")?;
    let response = client
        .post(format!("{api_url}/auth/refresh"))
        .json(&serde_json::json!({"refreshToken":refresh_token}))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err("Session expired; sign in again".into());
    }
    let tokens: TokenPair = response.json().await.map_err(|e| e.to_string())?;
    Entry::new(CREDENTIAL_SERVICE, REFRESH_ACCOUNT)
        .map_err(|e| e.to_string())?
        .set_password(&tokens.refresh_token)
        .map_err(|e| e.to_string())?;
    state
        .auth
        .lock()
        .map_err(|_| "Authentication lock poisoned")?
        .as_mut()
        .ok_or("Sign in required")?
        .access_token = tokens.access_token.clone();
    Entry::new(CREDENTIAL_SERVICE, ACCESS_ACCOUNT)
        .map_err(|e| e.to_string())?
        .set_password(&tokens.access_token)
        .map_err(|e| e.to_string())?;
    Ok(tokens.access_token)
}

async fn synchronize_screenshots(
    state: &AppState,
    api_url: &str,
    client: &reqwest::Client,
) -> Result<(), String> {
    for _ in 0..10 {
        let pending = {
            let db = state.db.lock().map_err(|_| "Database lock poisoned")?;
            db.query_row("SELECT id,session_id,encrypted_path,nonce,captured_at,width,height FROM screenshot_outbox WHERE next_attempt_at IS NULL OR next_attempt_at<=?1 ORDER BY captured_at LIMIT 1",[Utc::now().to_rfc3339()],|r|Ok(PendingScreenshot{id:r.get(0)?,session_id:r.get(1)?,path:r.get(2)?,nonce:r.get(3)?,captured_at:r.get(4)?,width:r.get(5)?,height:r.get(6)?})).ok()
        };
        let Some(item) = pending else {
            break;
        };
        let encrypted = std::fs::read(&item.path).map_err(|e| e.to_string())?;
        let cipher = Aes256Gcm::new_from_slice(&state.key).map_err(|e| e.to_string())?;
        let bytes = cipher
            .decrypt(Nonce::from_slice(&item.nonce), encrypted.as_ref())
            .map_err(|e| e.to_string())?;
        let make_form = || -> Result<reqwest::multipart::Form, String> {
            Ok(reqwest::multipart::Form::new()
                .text("sessionId", item.session_id.clone())
                .text("capturedAt", item.captured_at.clone())
                .text("width", item.width.to_string())
                .text("height", item.height.to_string())
                .part(
                    "file",
                    reqwest::multipart::Part::bytes(bytes.clone())
                        .file_name("screenshot.jpg")
                        .mime_str("image/jpeg")
                        .map_err(|e| e.to_string())?,
                ))
        };
        let token = {
            state
                .auth
                .lock()
                .map_err(|_| "Authentication lock poisoned")?
                .as_ref()
                .ok_or("Sign in required")?
                .access_token
                .clone()
        };
        let mut response = client
            .post(format!("{api_url}/screenshots"))
            .bearer_auth(token)
            .multipart(make_form()?)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if response.status() == reqwest::StatusCode::UNAUTHORIZED {
            let token = refresh_access(state, api_url, client).await?;
            response = client
                .post(format!("{api_url}/screenshots"))
                .bearer_auth(token)
                .multipart(make_form()?)
                .send()
                .await
                .map_err(|e| e.to_string())?;
        }
        if !response.status().is_success() {
            let db = state.db.lock().map_err(|_| "Database lock poisoned")?;
            db.execute("UPDATE screenshot_outbox SET attempts=attempts+1,next_attempt_at=datetime('now',printf('+%d seconds',min(300,(1 << min(attempts,4))*15))) WHERE id=?1",[&item.id]).map_err(|e|e.to_string())?;
            return Err(format!(
                "Screenshot synchronization failed: {}",
                response.status()
            ));
        }
        let db = state.db.lock().map_err(|_| "Database lock poisoned")?;
        db.execute("DELETE FROM screenshot_outbox WHERE id=?1", [&item.id])
            .map_err(|e| e.to_string())?;
        let _ = std::fs::remove_file(&item.path);
    }
    Ok(())
}
#[tauri::command]
async fn sync_now(state: State<'_, AppState>) -> Result<(), String> {
    synchronize(&state).await
}

async fn synchronize(state: &AppState) -> Result<(), String> {
    let attempted_at = Utc::now().to_rfc3339();
    let result = synchronize_inner(state).await;
    if let Ok(mut status) = state.sync_status.lock() {
        status.last_attempt_at = Some(attempted_at);
        match &result {
            Ok(()) => {
                status.online = true;
                status.last_success_at = Some(Utc::now().to_rfc3339());
                status.error = None;
            }
            Err(error) => {
                status.online = false;
                status.error = Some(error.clone());
            }
        }
    }
    result
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .setup(|app| {
            let state = AppState {
                db: Mutex::new(initialize_db(database_path(app.handle())?)?),
                auth: Mutex::new(None),
                sync_status: Mutex::new(SyncStatus::default()),
                collector: Mutex::new(collector::CollectorState::default()),
                key: encryption_key()?,
            };
            app.manage(state);
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    tokio::time::sleep(Duration::from_secs(30)).await;
                    let state = handle.state::<AppState>();
                    let _ = synchronize(&state).await;
                }
            });
            collector::spawn(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            login,
            restore_session,
            organization_preferences,
            employee_profile,
            employee_tasks,
            employee_dashboard,
            employee_notifications,
            update_task_progress,
            mark_notification_read,
            sync_status,
            logout,
            session_state,
            start_session,
            pause_session,
            resume_session,
            end_session,
            sync_now
        ])
        .build(tauri::generate_context!())
        .expect("failed to build employee agent");
    app.run(|handle, event| {
        if matches!(event, tauri::RunEvent::ExitRequested { .. }) {
            let state = handle.state::<AppState>();
            let _ = close_for_shutdown(&state);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn encrypts_and_decrypts_outbox_payload() {
        let key = [7u8; 32];
        let cipher = Aes256Gcm::new_from_slice(&key).unwrap();
        let nonce = [3u8; 12];
        let data = b"private";
        let encrypted = cipher
            .encrypt(Nonce::from_slice(&nonce), data.as_ref())
            .unwrap();
        assert_ne!(encrypted, data);
        assert_eq!(
            cipher
                .decrypt(Nonce::from_slice(&nonce), encrypted.as_ref())
                .unwrap(),
            data
        );
    }
    #[test]
    fn enforces_and_persists_session_lifecycle() {
        let db = initialize_db(PathBuf::from(":memory:")).unwrap();
        let state = AppState {
            db: Mutex::new(db),
            auth: Mutex::new(None),
            sync_status: Mutex::new(SyncStatus::default()),
            collector: Mutex::new(collector::CollectorState::default()),
            key: [9u8; 32],
        };
        transition(&state, "IDLE", "ACTIVE", "SESSION_STARTED", true).unwrap();
        assert_eq!(
            state
                .db
                .lock()
                .unwrap()
                .query_row("SELECT status FROM session_state", [], |r| r
                    .get::<_, String>(0))
                .unwrap(),
            "ACTIVE"
        );
        assert!(transition(&state, "IDLE", "ACTIVE", "SESSION_STARTED", true).is_err());
        transition(&state, "ACTIVE", "PAUSED", "SESSION_PAUSED", false).unwrap();
        transition(&state, "PAUSED", "ACTIVE", "SESSION_RESUMED", false).unwrap();
        transition(&state, "ACTIVE", "IDLE", "SESSION_ENDED", false).unwrap();
        let db = state.db.lock().unwrap();
        assert_eq!(
            db.query_row("SELECT status FROM session_state", [], |r| r
                .get::<_, String>(0))
                .unwrap(),
            "IDLE"
        );
        assert_eq!(
            db.query_row("SELECT COUNT(*) FROM outbox", [], |r| r.get::<_, i64>(0))
                .unwrap(),
            4
        );
    }
}
