CREATE TABLE `vocabulary_progress` (
	`user_id` text NOT NULL,
	`language` text NOT NULL,
	`word_id` text NOT NULL,
	`favorite` integer DEFAULT 0 NOT NULL,
	`learned` integer DEFAULT 0 NOT NULL,
	`due` text DEFAULT '' NOT NULL,
	`strength` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `language`, `word_id`)
);
