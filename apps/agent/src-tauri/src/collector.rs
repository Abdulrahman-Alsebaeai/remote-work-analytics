use super::{queue_event, AppState};
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use chrono::{DateTime, Utc};
use image::{codecs::jpeg::JpegEncoder, DynamicImage, RgbaImage};
use rand::{rngs::OsRng, RngCore};
use rusqlite::params;
use screenshots::Screen;
use std::{
    collections::BTreeSet,
    path::{Path, PathBuf},
    thread,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager};
use url::Url;
use uuid::Uuid;
use windows::{
    core::PWSTR,
    Win32::{
        Foundation::{CloseHandle, HWND, POINT, RECT},
        System::{
            Com::{CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_MULTITHREADED},
            Diagnostics::ToolHelp::{
                CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
                TH32CS_SNAPPROCESS,
            },
            SystemInformation::GetTickCount,
            Threading::{
                OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
                PROCESS_QUERY_LIMITED_INFORMATION,
            },
        },
        UI::{
            Accessibility::{
                CUIAutomation, IUIAutomation, IUIAutomationElement, IUIAutomationTreeWalker,
                IUIAutomationValuePattern, UIA_EditControlTypeId, UIA_ValuePatternId,
            },
            Input::KeyboardAndMouse::{GetAsyncKeyState, GetLastInputInfo, LASTINPUTINFO},
            WindowsAndMessaging::{
                GetCursorPos, GetForegroundWindow, GetWindowRect, GetWindowTextW,
                GetWindowThreadProcessId,
            },
        },
    },
};

const ACTIVITY_FLUSH_SECONDS: u64 = 10;
const CONTEXT_POLL_SECONDS: u64 = 2;
const IDLE_THRESHOLD_SECONDS: u32 = 60;

#[derive(Clone, Debug, PartialEq)]
struct ActivityContext {
    idle: bool,
    resource_type: &'static str,
    application_name: String,
    process_name: String,
    window_title: Option<String>,
    resource_name: Option<String>,
    context_name: Option<String>,
    url: Option<String>,
    domain: Option<String>,
}

impl ActivityContext {
    fn fingerprint(&self) -> String {
        [
            self.resource_type.to_string(),
            if self.idle { "idle" } else { "active" }.to_string(),
            self.process_name.to_ascii_lowercase(),
            self.resource_name
                .clone()
                .unwrap_or_default()
                .to_ascii_lowercase(),
            self.context_name
                .clone()
                .unwrap_or_default()
                .to_ascii_lowercase(),
            self.domain.clone().unwrap_or_default().to_ascii_lowercase(),
            self.url.clone().unwrap_or_default().to_ascii_lowercase(),
        ]
        .join("\u{1f}")
    }
}

struct TrackedActivity {
    id: String,
    session_id: String,
    context: ActivityContext,
    started_at: DateTime<Utc>,
    last_seen_at: DateTime<Utc>,
    last_sent_at: DateTime<Utc>,
    idle_seconds: u32,
    keyboard_activity: u32,
    mouse_activity: u32,
    window_switches: u32,
}

#[derive(Default)]
pub(super) struct CollectorState {
    current: Option<TrackedActivity>,
}

pub(super) fn close_current(state: &AppState) {
    let activity = state
        .collector
        .lock()
        .ok()
        .and_then(|mut collector| collector.current.take());
    if let Some(activity) = activity {
        queue_activity(state, &activity, Utc::now(), true);
    }
}

pub fn spawn(app: AppHandle) {
    thread::spawn(move || {
        let automation = initialize_automation();
        let mut screenshot_seconds = 300;
        let mut last_preference_check = Instant::now() - Duration::from_secs(10);
        let screenshot_dir = app
            .path()
            .app_data_dir()
            .unwrap_or_else(|_| PathBuf::from("."))
            .join("screenshots-pending");
        let mut last_screenshot = Instant::now();
        let mut last_context_check = Instant::now() - Duration::from_secs(CONTEXT_POLL_SECONDS);
        let mut last_window = HWND::default();
        let mut last_cursor = POINT::default();
        loop {
            thread::sleep(Duration::from_secs(1));
            let state = app.state::<AppState>();
            if last_preference_check.elapsed() >= Duration::from_secs(10) {
                screenshot_seconds = configured_screenshot_interval(&state);
                last_preference_check = Instant::now();
            }
            let session_id = active_session(&state);
            if session_id.is_none() {
                close_current(&state);
                last_screenshot = Instant::now();
                last_window = HWND::default();
                continue;
            }
            let session_id = session_id.unwrap();
            let window = unsafe { GetForegroundWindow() };
            let switched = window != last_window && last_window != HWND::default();
            last_window = window;

            let session_changed = state
                .collector
                .lock()
                .ok()
                .and_then(|collector| collector.current.as_ref().map(|value| value.session_id != session_id))
                .unwrap_or(false);
            if session_changed { close_current(&state); }

            let has_current = state.collector.lock().ok().is_some_and(|collector| collector.current.is_some());
            if last_context_check.elapsed() >= Duration::from_secs(CONTEXT_POLL_SECONDS) || !has_current {
                let mut next_context = foreground_context(window, automation.as_ref());
                next_context.idle = idle_seconds() >= IDLE_THRESHOLD_SECONDS;
                let next_fingerprint = next_context.fingerprint();
                let changed = state.collector.lock().ok().is_none_or(|collector| collector.current.as_ref().is_none_or(|value| value.context.fingerprint() != next_fingerprint));
                if changed {
                    let previous = state.collector.lock().ok().and_then(|mut collector| collector.current.take());
                    if let Some(mut activity) = previous {
                        activity.window_switches += u32::from(switched);
                        queue_activity(&state, &activity, Utc::now(), true);
                    }
                    let now = Utc::now();
                    let activity = TrackedActivity {
                        id: Uuid::new_v4().to_string(),
                        session_id: session_id.clone(),
                        context: next_context,
                        started_at: now,
                        last_seen_at: now,
                        last_sent_at: now,
                        idle_seconds: 0,
                        keyboard_activity: 0,
                        mouse_activity: 0,
                        window_switches: 0,
                    };
                    if let Ok(mut collector) = state.collector.lock() { collector.current = Some(activity); }
                } else if switched {
                    if let Some(activity) = state.collector.lock().ok().and_then(|mut collector| collector.current.take()) {
                        let mut activity = activity;
                        activity.window_switches += 1;
                        if let Ok(mut collector) = state.collector.lock() { collector.current = Some(activity); }
                    }
                }
                last_context_check = Instant::now();
            }

            if let Ok(mut collector) = state.collector.lock() {
              if let Some(activity) = collector.current.as_mut() {
                activity.last_seen_at = Utc::now();
                activity.keyboard_activity += keyboard_events();
                let cursor = cursor_position();
                if cursor != last_cursor {
                    activity.mouse_activity += 1;
                    last_cursor = cursor;
                }
                if idle_seconds() >= IDLE_THRESHOLD_SECONDS {
                    activity.idle_seconds += 1;
                }
                if (Utc::now() - activity.last_sent_at).num_seconds()
                    >= ACTIVITY_FLUSH_SECONDS as i64
                {
                    queue_activity(&state, activity, Utc::now(), true);
                    activity.last_sent_at = Utc::now();
                }
              }
            }

            if last_screenshot.elapsed() >= Duration::from_secs(screenshot_seconds) {
                last_screenshot = Instant::now();
                let sensitive = state.collector.lock().ok().and_then(|collector| collector.current.as_ref().map(|value| context_is_sensitive(&value.context))).unwrap_or(false);
                if !sensitive {
                    let _ = capture_screenshot(&state, &screenshot_dir, &session_id, window);
                }
            }
        }
    });
}

fn configured_screenshot_interval(state: &AppState) -> u64 {
    let Ok(db) = state.db.lock() else {
        return 300;
    };
    db.query_row(
        "SELECT screenshot_interval_seconds FROM agent_preferences WHERE id=1",
        [],
        |row| row.get::<_, u64>(0),
    )
    .unwrap_or(300)
    .clamp(10, 3600)
}

fn active_session(state: &AppState) -> Option<String> {
    let db = state.db.lock().ok()?;
    db.query_row(
        "SELECT session_id FROM session_state WHERE id=1 AND status='ACTIVE'",
        [],
        |row| row.get(0),
    )
    .ok()
}

fn queue_activity(
    state: &AppState,
    activity: &TrackedActivity,
    ended_at: DateTime<Utc>,
    include_processes: bool,
) {
    let duration_seconds = (ended_at - activity.started_at).num_seconds().max(1) as u64;
    let delta_duration_seconds = (ended_at - activity.last_sent_at).num_seconds().max(0) as u64;
    let context = &activity.context;
    let payload = serde_json::json!({
        "schemaVersion": 2,
        "activityId": activity.id,
        "activityType": context.resource_type,
        "activityState": if context.idle { "IDLE" } else { "ACTIVE" },
        "applicationName": context.application_name,
        "processName": context.process_name,
        "activeApplication": context.application_name,
        "activeWindowTitle": context.window_title,
        "resourceName": context.resource_name,
        "contextName": context.context_name,
        "url": context.url,
        "domain": context.domain,
        "websiteTitle": (context.resource_type == "WEBSITE").then(|| context.resource_name.clone()).flatten(),
        "startedAt": activity.started_at.to_rfc3339(),
        "endedAt": ended_at.to_rfc3339(),
        "durationSeconds": duration_seconds,
        "sampleDurationSeconds": delta_duration_seconds,
        "idleSeconds": activity.idle_seconds,
        "keyboardActivity": activity.keyboard_activity,
        "mouseActivity": activity.mouse_activity,
        "windowSwitches": activity.window_switches,
        "openedApplications": include_processes.then(opened_applications).unwrap_or_default()
    });
    if let Ok(db) = state.db.lock() {
        let _ = queue_event(
            &db,
            &state.key,
            &activity.session_id,
            "ACTIVITY_SAMPLE",
            payload,
        );
    }
}

fn foreground_details(hwnd: HWND) -> (String, String) {
    if hwnd == HWND::default() {
        return ("unknown".into(), String::new());
    }
    let mut title_buffer = [0u16; 1024];
    let title_length = unsafe { GetWindowTextW(hwnd, &mut title_buffer) };
    let title = String::from_utf16_lossy(&title_buffer[..title_length.max(0) as usize]);
    let mut pid = 0u32;
    unsafe {
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
    }
    let application = unsafe {
        OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
            .ok()
            .and_then(|handle| {
                let mut path = [0u16; 1024];
                let mut length = path.len() as u32;
                let result = QueryFullProcessImageNameW(
                    handle,
                    PROCESS_NAME_WIN32,
                    PWSTR(path.as_mut_ptr()),
                    &mut length,
                )
                .ok()
                .map(|_| String::from_utf16_lossy(&path[..length as usize]));
                let _ = CloseHandle(handle);
                result
            })
    }
    .and_then(|path| {
        std::path::Path::new(&path)
            .file_name()
            .map(|value| value.to_string_lossy().into_owned())
    })
    .unwrap_or_else(|| "unknown".into());
    (application, title)
}

fn foreground_context(hwnd: HWND, automation: Option<&IUIAutomation>) -> ActivityContext {
    let (process_name, title) = foreground_details(hwnd);
    let app_name = friendly_application_name(&process_name);
    if is_sensitive(&process_name, &title) {
        return ActivityContext {
            idle: false,
            resource_type: "OTHER",
            application_name: app_name,
            process_name,
            window_title: Some("[REDACTED]".into()),
            resource_name: Some("[REDACTED]".into()),
            context_name: None,
            url: None,
            domain: None,
        };
    }

    let process = process_name.to_ascii_lowercase();
    if is_browser(&process) {
        let url = automation.and_then(|value| read_browser_url(value, hwnd));
        let domain = url.as_deref().and_then(url_domain);
        let resource = browser_page_title(&title, &app_name);
        return ActivityContext {
            idle: false,
            resource_type: "WEBSITE",
            application_name: app_name,
            process_name,
            window_title: optional_text(&title),
            resource_name: resource,
            context_name: domain.clone(),
            url,
            domain,
        };
    }

    let parts = title_parts(&title);
    if ["code.exe", "code - insiders.exe", "cursor.exe"].contains(&process.as_str()) {
        let resource = parts.first().cloned();
        let context = parts.get(1).cloned();
        let resource_type = if resource.as_deref().is_some_and(looks_like_file) {
            "FILE"
        } else {
            "WORKSPACE"
        };
        return ActivityContext {
            idle: false,
            resource_type,
            application_name: app_name,
            process_name,
            window_title: optional_text(&title),
            resource_name: resource,
            context_name: context,
            url: None,
            domain: None,
        };
    }

    if process == "explorer.exe" {
        let location = automation
            .and_then(|value| read_location(value, hwnd))
            .or_else(|| optional_text(&title));
        return ActivityContext {
            idle: false,
            resource_type: "FOLDER",
            application_name: app_name,
            process_name,
            window_title: optional_text(&title),
            resource_name: location.clone(),
            context_name: location,
            url: None,
            domain: None,
        };
    }

    if [
        "notepad.exe",
        "winword.exe",
        "excel.exe",
        "powerpnt.exe",
        "acrord32.exe",
    ]
    .contains(&process.as_str())
    {
        return ActivityContext {
            idle: false,
            resource_type: "FILE",
            application_name: app_name,
            process_name,
            window_title: optional_text(&title),
            resource_name: parts.first().cloned(),
            context_name: parts.get(1).cloned(),
            url: None,
            domain: None,
        };
    }

    ActivityContext {
        idle: false,
        resource_type: if process == "unknown" {
            "OTHER"
        } else {
            "APPLICATION"
        },
        application_name: app_name,
        process_name,
        window_title: optional_text(&title),
        resource_name: optional_text(&title),
        context_name: None,
        url: None,
        domain: None,
    }
}

fn friendly_application_name(process: &str) -> String {
    match process.to_ascii_lowercase().as_str() {
        "msedge.exe" => "Microsoft Edge".into(),
        "chrome.exe" => "Google Chrome".into(),
        "firefox.exe" => "Mozilla Firefox".into(),
        "brave.exe" => "Brave".into(),
        "code.exe" => "Visual Studio Code".into(),
        "code - insiders.exe" => "Visual Studio Code Insiders".into(),
        "cursor.exe" => "Cursor".into(),
        "explorer.exe" => "File Explorer".into(),
        "notepad.exe" => "Notepad".into(),
        "winword.exe" => "Microsoft Word".into(),
        "excel.exe" => "Microsoft Excel".into(),
        "powerpnt.exe" => "Microsoft PowerPoint".into(),
        "teams.exe" | "ms-teams.exe" => "Microsoft Teams".into(),
        "zoom.exe" => "Zoom".into(),
        "unknown" => "Unknown application".into(),
        value => value.trim_end_matches(".exe").to_string(),
    }
}

fn is_browser(process: &str) -> bool {
    ["chrome.exe", "msedge.exe", "firefox.exe", "brave.exe"].contains(&process)
}

fn title_parts(title: &str) -> Vec<String> {
    title
        .replace(" — ", " - ")
        .replace(" – ", " - ")
        .split(" - ")
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(truncate_500)
        .collect()
}

fn browser_page_title(title: &str, application_name: &str) -> Option<String> {
    let mut parts = title_parts(title);
    while parts.last().is_some_and(|part| {
        let part = part.to_ascii_lowercase();
        part == application_name.to_ascii_lowercase()
            || part.contains("google chrome")
            || part.contains("microsoft edge")
            || part.contains("mozilla firefox")
            || part == "brave"
    }) {
        parts.pop();
    }
    optional_text(&parts.join(" - ")).map(|value| truncate_500(&value))
}

fn looks_like_file(value: &str) -> bool {
    let value = value.trim_matches(['●', '•', '*', ' ']);
    Path::new(value).extension().is_some()
}

fn optional_text(value: &str) -> Option<String> {
    let value = value.trim();
    (!value.is_empty()).then(|| truncate_1000(value))
}

fn truncate_500(value: &str) -> String {
    value.chars().take(500).collect()
}

fn truncate_1000(value: &str) -> String {
    value.chars().take(1000).collect()
}

fn initialize_automation() -> Option<IUIAutomation> {
    unsafe {
        CoInitializeEx(None, COINIT_MULTITHREADED).ok().ok()?;
        CoCreateInstance(&CUIAutomation, None, CLSCTX_INPROC_SERVER).ok()
    }
}

fn read_browser_url(automation: &IUIAutomation, hwnd: HWND) -> Option<String> {
    let value = read_accessible_value(automation, hwnd, true)?;
    normalize_http_url(&value)
}

fn read_location(automation: &IUIAutomation, hwnd: HWND) -> Option<String> {
    read_accessible_value(automation, hwnd, false).map(|value| truncate_500(&value))
}

fn read_accessible_value(
    automation: &IUIAutomation,
    hwnd: HWND,
    browser_only: bool,
) -> Option<String> {
    unsafe {
        let root = automation.ElementFromHandle(hwnd).ok()?;
        let walker = automation.RawViewWalker().ok()?;
        let mut visited = 0usize;
        find_accessible_value(&walker, &root, 0, &mut visited, browser_only)
    }
}

unsafe fn find_accessible_value(
    walker: &IUIAutomationTreeWalker,
    parent: &IUIAutomationElement,
    depth: usize,
    visited: &mut usize,
    browser_only: bool,
) -> Option<String> {
    if depth > 10 || *visited >= 700 {
        return None;
    }
    let mut child = unsafe { walker.GetFirstChildElement(parent).ok() };
    while let Some(element) = child {
        *visited += 1;
        let is_password =
            unsafe { element.CurrentIsPassword().ok() }.is_some_and(|value| value.as_bool());
        let control_type = unsafe { element.CurrentControlType().ok() };
        let automation_id = unsafe { element.CurrentAutomationId().ok() }
            .map(|value| value.to_string().to_ascii_lowercase())
            .unwrap_or_default();
        let raw_name = unsafe { element.CurrentName().ok() }
            .map(|value| value.to_string())
            .unwrap_or_default();
        let name = raw_name.to_ascii_lowercase();
        let address_like = automation_id.contains("address")
            || automation_id.contains("omnibox")
            || automation_id.contains("urlbar")
            || name.contains("address and search")
            || name.contains("search or enter address")
            || name.contains("address bar")
            || (!browser_only
                && (name.contains("address")
                    || name.contains("location")
                    || name.contains("العنوان")));
        if !browser_only && address_like && control_type != Some(UIA_EditControlTypeId) {
            let location = raw_name
                .split_once(':')
                .map(|(_, value)| value.trim())
                .filter(|value| !value.is_empty());
            if let Some(location) = location {
                return Some(location.to_string());
            }
        }
        if !is_password && control_type == Some(UIA_EditControlTypeId) && address_like {
            if let Ok(pattern) = unsafe {
                element.GetCurrentPatternAs::<IUIAutomationValuePattern>(UIA_ValuePatternId)
            } {
                if let Ok(value) = unsafe { pattern.CurrentValue() } {
                    let value = value.to_string();
                    if !value.trim().is_empty() {
                        return Some(value);
                    }
                }
            }
        }
        if let Some(value) =
            unsafe { find_accessible_value(walker, &element, depth + 1, visited, browser_only) }
        {
            return Some(value);
        }
        child = unsafe { walker.GetNextSiblingElement(&element).ok() };
    }
    None
}

fn normalize_http_url(value: &str) -> Option<String> {
    let value = value.trim();
    if value.is_empty() || value.chars().any(char::is_whitespace) {
        return None;
    }
    let candidate = if value.contains("://") {
        value.to_string()
    } else {
        format!("https://{value}")
    };
    let parsed = Url::parse(&candidate).ok()?;
    if !["http", "https"].contains(&parsed.scheme()) || parsed.host_str().is_none() {
        return None;
    }
    Some(truncate_1000(parsed.as_str()))
}

fn url_domain(value: &str) -> Option<String> {
    Url::parse(value)
        .ok()?
        .host_str()
        .map(|host| host.trim_start_matches("www.").to_ascii_lowercase())
}

fn keyboard_events() -> u32 {
    (8..=255)
        .filter(|key| unsafe { GetAsyncKeyState(*key) } & 1 != 0)
        .count() as u32
}

fn cursor_position() -> POINT {
    let mut point = POINT::default();
    unsafe {
        let _ = GetCursorPos(&mut point);
    }
    point
}

fn idle_seconds() -> u32 {
    let mut info = LASTINPUTINFO {
        cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
        dwTime: 0,
    };
    unsafe {
        if GetLastInputInfo(&mut info).as_bool() {
            GetTickCount().wrapping_sub(info.dwTime) / 1000
        } else {
            0
        }
    }
}

fn opened_applications() -> Vec<String> {
    let mut names = BTreeSet::new();
    unsafe {
        let Ok(snapshot) = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) else {
            return Vec::new();
        };
        let mut entry = PROCESSENTRY32W {
            dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };
        if Process32FirstW(snapshot, &mut entry).is_ok() {
            loop {
                let length = entry
                    .szExeFile
                    .iter()
                    .position(|value| *value == 0)
                    .unwrap_or(entry.szExeFile.len());
                let name = String::from_utf16_lossy(&entry.szExeFile[..length]);
                if !name.is_empty() {
                    names.insert(name);
                }
                if Process32NextW(snapshot, &mut entry).is_err() {
                    break;
                }
            }
        }
        let _ = CloseHandle(snapshot);
    }
    names.into_iter().take(200).collect()
}

fn context_is_sensitive(context: &ActivityContext) -> bool {
    is_sensitive(
        &context.process_name,
        context.window_title.as_deref().unwrap_or_default(),
    ) || context.resource_name.as_deref() == Some("[REDACTED]")
}

fn is_sensitive(application: &str, title: &str) -> bool {
    let value = format!("{application} {title}").to_ascii_lowercase();
    let configured = std::env::var("MONITORING_EXCLUDED_TERMS").unwrap_or_else(|_| {
        "1password,bitwarden,keepass,password,private browsing,incognito,inprivate".into()
    });
    configured
        .split(',')
        .map(str::trim)
        .filter(|term| !term.is_empty())
        .any(|term| value.contains(&term.to_ascii_lowercase()))
}

fn screen_for_window(hwnd: HWND) -> Result<Screen, String> {
    let mut rect = RECT::default();
    if hwnd != HWND::default() && unsafe { GetWindowRect(hwnd, &mut rect) }.is_ok() {
        let x = rect.left + (rect.right - rect.left) / 2;
        let y = rect.top + (rect.bottom - rect.top) / 2;
        if let Ok(screen) = Screen::from_point(x, y) {
            return Ok(screen);
        }
    }
    let cursor = cursor_position();
    if let Ok(screen) = Screen::from_point(cursor.x, cursor.y) {
        return Ok(screen);
    }
    Screen::all()
        .map_err(|error| error.to_string())?
        .into_iter()
        .next()
        .ok_or_else(|| "No display available".to_string())
}

fn capture_screenshot(
    state: &AppState,
    directory: &Path,
    session_id: &str,
    hwnd: HWND,
) -> Result<(), String> {
    let screen = screen_for_window(hwnd)?;
    let captured = screen.capture().map_err(|error| error.to_string())?;
    let rgba = RgbaImage::from_raw(captured.width(), captured.height(), captured.into_raw())
        .ok_or("Invalid screenshot buffer")?;
    let image = DynamicImage::ImageRgba8(rgba);
    let width = image.width();
    let height = image.height();
    let mut jpeg = Vec::new();
    JpegEncoder::new_with_quality(&mut jpeg, 92)
        .encode_image(&image)
        .map_err(|error| error.to_string())?;
    if active_session(state).as_deref() != Some(session_id) {
        return Ok(());
    }
    std::fs::create_dir_all(directory).map_err(|error| error.to_string())?;
    let id = Uuid::new_v4().to_string();
    let path = directory.join(format!("{id}.bin"));
    let cipher = Aes256Gcm::new_from_slice(&state.key).map_err(|error| error.to_string())?;
    let mut nonce = [0u8; 12];
    OsRng.fill_bytes(&mut nonce);
    let encrypted = cipher
        .encrypt(Nonce::from_slice(&nonce), jpeg.as_ref())
        .map_err(|error| error.to_string())?;
    std::fs::write(&path, encrypted).map_err(|error| error.to_string())?;
    let db = state.db.lock().map_err(|_| "Database lock poisoned")?;
    db.execute(
        "INSERT INTO screenshot_outbox(id,session_id,encrypted_path,nonce,captured_at,width,height) VALUES(?1,?2,?3,?4,?5,?6,?7)",
        params![id, session_id, path.to_string_lossy(), nonce.to_vec(), Utc::now().to_rfc3339(), width, height],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{initialize_db, SyncStatus};
    use std::sync::Mutex;

    #[test]
    fn normalizes_browser_urls_and_domains() {
        let url = normalize_http_url("example.com/work?q=1").unwrap();
        assert_eq!(url, "https://example.com/work?q=1");
        assert_eq!(url_domain(&url).as_deref(), Some("example.com"));
        assert!(normalize_http_url("New tab search").is_none());
    }

    #[test]
    fn recognizes_vscode_files_and_workspace_context() {
        let parts = title_parts("main.ts - RemoteWorkAnalytics - Visual Studio Code");
        assert_eq!(parts[0], "main.ts");
        assert_eq!(parts[1], "RemoteWorkAnalytics");
        assert!(looks_like_file(&parts[0]));
    }

    #[test]
    fn removes_browser_name_from_page_title() {
        assert_eq!(
            browser_page_title("Dashboard - Microsoft Edge", "Microsoft Edge").as_deref(),
            Some("Dashboard")
        );
    }

    #[test]
    fn extracts_word_document_name_and_friendly_application() {
        let parts = title_parts("Project Report.docx - Compatibility Mode - Word");
        assert_eq!(parts.first().map(String::as_str), Some("Project Report.docx"));
        assert_eq!(friendly_application_name("WINWORD.EXE"), "Microsoft Word");
        assert!(looks_like_file(&parts[0]));
    }

    #[test]
    fn closing_current_activity_persists_its_final_sample() {
        let state = AppState {
            db: Mutex::new(initialize_db(PathBuf::from(":memory:")).unwrap()),
            auth: Mutex::new(None),
            sync_status: Mutex::new(SyncStatus::default()),
            collector: Mutex::new(CollectorState::default()),
            key: [5u8; 32],
        };
        let now = Utc::now();
        state.collector.lock().unwrap().current = Some(TrackedActivity {
            id: Uuid::new_v4().to_string(), session_id: Uuid::new_v4().to_string(),
            context: ActivityContext { idle: false, resource_type: "FILE", application_name: "Microsoft Word".into(), process_name: "WINWORD.EXE".into(), window_title: Some("Project Report.docx - Word".into()), resource_name: Some("Project Report.docx".into()), context_name: None, url: None, domain: None },
            started_at: now - chrono::Duration::seconds(5), last_seen_at: now, last_sent_at: now - chrono::Duration::seconds(5),
            idle_seconds: 0, keyboard_activity: 3, mouse_activity: 2, window_switches: 0,
        });

        close_current(&state);

        assert!(state.collector.lock().unwrap().current.is_none());
        assert_eq!(state.db.lock().unwrap().query_row("SELECT COUNT(*) FROM outbox", [], |row| row.get::<_, i64>(0)).unwrap(), 1);
    }
}
