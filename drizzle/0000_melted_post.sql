CREATE TABLE `review_cards` (
	`user_id` text NOT NULL,
	`language` text NOT NULL,
	`lesson_id` text NOT NULL,
	`phrase_index` integer NOT NULL,
	`due` text NOT NULL,
	`strength` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `language`, `lesson_id`, `phrase_index`)
);
--> statement-breakpoint
CREATE TABLE `completions` (
	`user_id` text NOT NULL,
	`language` text NOT NULL,
	`lesson_id` text NOT NULL,
	`day` text NOT NULL,
	PRIMARY KEY(`user_id`, `language`, `lesson_id`)
);
--> statement-breakpoint
CREATE TABLE `preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`language` text DEFAULT 'en' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `study_sessions` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`language` text NOT NULL,
	`lesson_id` text NOT NULL,
	`mode` text NOT NULL,
	`day` text NOT NULL,
	`seconds` integer NOT NULL,
	`xp` integer NOT NULL,
	PRIMARY KEY(`user_id`, `id`)
);
