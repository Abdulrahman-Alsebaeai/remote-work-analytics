ALTER TABLE `agent_events`
  MODIFY `type` ENUM('SESSION_STARTED', 'SESSION_PAUSED', 'SESSION_RESUMED', 'SESSION_ENDED', 'ACTIVITY_SAMPLE') NOT NULL;

CREATE TABLE `screenshot_assets` (
  `id` CHAR(36) NOT NULL,
  `content_hash` CHAR(64) NOT NULL,
  `storage_key` VARCHAR(500) NOT NULL,
  `mime_type` VARCHAR(80) NOT NULL,
  `byte_size` INTEGER NOT NULL,
  `width` INTEGER NOT NULL,
  `height` INTEGER NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `screenshot_assets_content_hash_key`(`content_hash`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `screenshot_captures` (
  `id` CHAR(36) NOT NULL,
  `organization_id` CHAR(36) NOT NULL,
  `employee_id` CHAR(36) NOT NULL,
  `session_id` CHAR(36) NOT NULL,
  `asset_id` CHAR(36) NOT NULL,
  `captured_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `screenshot_captures_employee_id_session_id_captured_at_key`(`employee_id`, `session_id`, `captured_at`),
  INDEX `screenshot_captures_organization_id_captured_at_idx`(`organization_id`, `captured_at`),
  INDEX `screenshot_captures_session_id_captured_at_idx`(`session_id`, `captured_at`),
  INDEX `screenshot_captures_asset_id_idx`(`asset_id`),
  CONSTRAINT `screenshot_captures_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `screenshot_captures_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `work_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `screenshot_captures_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `screenshot_assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
