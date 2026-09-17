CREATE TABLE `organization_settings` (
  `organization_id` CHAR(36) NOT NULL,
  `font_key` VARCHAR(40) NOT NULL DEFAULT 'cairo',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`organization_id`),
  CONSTRAINT `organization_settings_organization_id_fkey`
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
