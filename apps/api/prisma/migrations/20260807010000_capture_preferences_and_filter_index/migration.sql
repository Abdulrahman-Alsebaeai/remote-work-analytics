ALTER TABLE `organization_settings`
  ADD COLUMN `screenshot_interval_seconds` INTEGER NOT NULL DEFAULT 300;

CREATE INDEX `screenshot_captures_organization_id_employee_id_captured_at_idx`
  ON `screenshot_captures`(`organization_id`, `employee_id`, `captured_at`);
