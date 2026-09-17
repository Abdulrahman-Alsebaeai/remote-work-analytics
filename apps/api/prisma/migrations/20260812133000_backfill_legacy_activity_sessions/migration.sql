-- Normalize already-synchronized v1 ACTIVITY_SAMPLE events. New v1 events are
-- normalized by AgentSyncService; this migration repairs historical sessions
-- that otherwise appeared in Performance but not in the Activities timeline.
INSERT INTO `activity_sessions` (
  `id`, `organization_id`, `employee_id`, `session_id`, `resource_type`,
  `application_name`, `process_name`, `window_title`, `resource_name`, `context_name`,
  `url`, `domain`, `started_at`, `ended_at`, `duration_seconds`, `idle_seconds`,
  `keyboard_activity`, `mouse_activity`, `window_switches`, `classification`,
  `created_at`, `updated_at`
)
WITH raw_events AS (
  SELECT
    ae.`organization_id`, ae.`employee_id`, ae.`session_id`, ae.`occurred_at`,
    COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(ae.`payload`, '$.activeApplication')), ''), 'unknown') AS process_name,
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(ae.`payload`, '$.activeWindowTitle')), '') AS window_title,
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(ae.`payload`, '$.websiteTitle')), '') AS website_title,
    LEAST(300, GREATEST(1, COALESCE(JSON_EXTRACT(ae.`payload`, '$.sampleDurationSeconds') + 0, 10))) AS sample_seconds,
    LEAST(300, GREATEST(0, COALESCE(JSON_EXTRACT(ae.`payload`, '$.idleSeconds') + 0, 0))) AS idle_seconds,
    GREATEST(0, COALESCE(JSON_EXTRACT(ae.`payload`, '$.keyboardActivity') + 0, 0)) AS keyboard_activity,
    GREATEST(0, COALESCE(JSON_EXTRACT(ae.`payload`, '$.mouseActivity') + 0, 0)) AS mouse_activity,
    GREATEST(0, COALESCE(JSON_EXTRACT(ae.`payload`, '$.windowSwitches') + 0, 0)) AS window_switches
  FROM `agent_events` ae
  WHERE ae.`type` = 'ACTIVITY_SAMPLE'
    AND JSON_EXTRACT(ae.`payload`, '$.activityId') IS NULL
    AND NOT EXISTS (SELECT 1 FROM `activity_sessions` existing WHERE existing.`session_id` = ae.`session_id`)
), marked AS (
  SELECT raw_events.*,
    CASE
      WHEN LAG(process_name) OVER (PARTITION BY session_id ORDER BY occurred_at) = process_name
       AND LAG(COALESCE(window_title, '')) OVER (PARTITION BY session_id ORDER BY occurred_at) = COALESCE(window_title, '')
       AND TIMESTAMPDIFF(SECOND, LAG(occurred_at) OVER (PARTITION BY session_id ORDER BY occurred_at), occurred_at) <= GREATEST(15, sample_seconds * 2)
      THEN 0 ELSE 1
    END AS starts_group
  FROM raw_events
), numbered AS (
  SELECT marked.*,
    SUM(starts_group) OVER (PARTITION BY session_id ORDER BY occurred_at ROWS UNBOUNDED PRECEDING) AS activity_group
  FROM marked
), grouped AS (
  SELECT
    organization_id, employee_id, session_id, activity_group,
    MIN(process_name) AS process_name,
    MIN(window_title) AS window_title,
    MIN(website_title) AS website_title,
    MIN(occurred_at - INTERVAL sample_seconds SECOND) AS started_at,
    MAX(occurred_at) AS ended_at,
    SUM(LEAST(sample_seconds, idle_seconds)) AS idle_seconds,
    SUM(keyboard_activity) AS keyboard_activity,
    SUM(mouse_activity) AS mouse_activity,
    SUM(window_switches) AS window_switches
  FROM numbered
  GROUP BY organization_id, employee_id, session_id, activity_group
)
SELECT
  UUID(), organization_id, employee_id, session_id,
  CASE
    WHEN LOWER(process_name) IN ('msedge.exe','chrome.exe','firefox.exe','brave.exe') THEN 'WEBSITE'
    WHEN LOWER(process_name) = 'explorer.exe' THEN 'FOLDER'
    WHEN LOWER(process_name) IN ('notepad.exe','winword.exe','excel.exe','powerpnt.exe','acrord32.exe') THEN 'FILE'
    WHEN LOWER(process_name) IN ('code.exe','code - insiders.exe','cursor.exe')
      AND SUBSTRING_INDEX(COALESCE(window_title, ''), ' - ', 1) REGEXP '\\.[A-Za-z0-9]{1,12}$' THEN 'FILE'
    WHEN LOWER(process_name) IN ('code.exe','code - insiders.exe','cursor.exe') THEN 'WORKSPACE'
    ELSE 'APPLICATION'
  END,
  CASE LOWER(process_name)
    WHEN 'msedge.exe' THEN 'Microsoft Edge' WHEN 'chrome.exe' THEN 'Google Chrome'
    WHEN 'firefox.exe' THEN 'Mozilla Firefox' WHEN 'brave.exe' THEN 'Brave'
    WHEN 'code.exe' THEN 'Visual Studio Code' WHEN 'code - insiders.exe' THEN 'Visual Studio Code Insiders'
    WHEN 'cursor.exe' THEN 'Cursor' WHEN 'explorer.exe' THEN 'File Explorer'
    WHEN 'notepad.exe' THEN 'Notepad' WHEN 'winword.exe' THEN 'Microsoft Word'
    WHEN 'excel.exe' THEN 'Microsoft Excel' WHEN 'powerpnt.exe' THEN 'Microsoft PowerPoint'
    WHEN 'acrord32.exe' THEN 'Adobe Acrobat Reader' WHEN 'teams.exe' THEN 'Microsoft Teams'
    WHEN 'ms-teams.exe' THEN 'Microsoft Teams' WHEN 'zoom.exe' THEN 'Zoom'
    ELSE TRIM(TRAILING '.exe' FROM process_name)
  END,
  process_name, window_title,
  CASE
    WHEN LOWER(process_name) IN ('msedge.exe','chrome.exe','firefox.exe','brave.exe') THEN COALESCE(website_title, SUBSTRING_INDEX(window_title, ' - ', 1))
    ELSE SUBSTRING_INDEX(window_title, ' - ', 1)
  END,
  CASE
    WHEN LOWER(process_name) = 'explorer.exe' THEN SUBSTRING_INDEX(window_title, ' - ', 1)
    WHEN LOWER(process_name) IN ('code.exe','code - insiders.exe','cursor.exe','notepad.exe','winword.exe','excel.exe','powerpnt.exe','acrord32.exe')
      THEN NULLIF(SUBSTRING_INDEX(SUBSTRING_INDEX(window_title, ' - ', 2), ' - ', -1), SUBSTRING_INDEX(window_title, ' - ', 1))
    ELSE NULL
  END,
  NULL, NULL, started_at, ended_at,
  GREATEST(1, TIMESTAMPDIFF(SECOND, started_at, ended_at)),
  LEAST(GREATEST(1, TIMESTAMPDIFF(SECOND, started_at, ended_at)), idle_seconds),
  keyboard_activity, mouse_activity, window_switches, 'UNDEFINED', NOW(3), NOW(3)
FROM grouped;
