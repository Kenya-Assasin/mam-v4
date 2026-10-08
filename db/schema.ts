import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
export const preferences = sqliteTable('preferences', {
  userId: text('user_id').primaryKey(), language: text('language').notNull().default('en'),
  weeklyGoal: integer('weekly_goal').notNull().default(3),
});
export const sessions = sqliteTable('study_sessions', {
  userId: text('user_id').notNull(), id: text('id').notNull(), language: text('language').notNull(),
  lessonId: text('lesson_id').notNull(), mode: text('mode').notNull(), day: text('day').notNull(),
  seconds: integer('seconds').notNull(), xp: integer('xp').notNull(),
}, t => [primaryKey({columns:[t.userId,t.id]})]);
export const completions = sqliteTable('completions', {
  userId: text('user_id').notNull(), language: text('language').notNull(), lessonId: text('lesson_id').notNull(), day: text('day').notNull(),
}, t => [primaryKey({columns:[t.userId,t.language,t.lessonId]})]);
export const cards = sqliteTable('review_cards', {
  userId: text('user_id').notNull(), language: text('language').notNull(), lessonId: text('lesson_id').notNull(), phraseIndex: integer('phrase_index').notNull(),
  due: text('due').notNull(), strength: integer('strength').notNull().default(0),
}, t => [primaryKey({columns:[t.userId,t.language,t.lessonId,t.phraseIndex]})]);
export const vocabularyProgress = sqliteTable('vocabulary_progress', {
  userId:text('user_id').notNull(),language:text('language').notNull(),wordId:text('word_id').notNull(),
  favorite:integer('favorite').notNull().default(0),learned:integer('learned').notNull().default(0),
  due:text('due').notNull().default(''),strength:integer('strength').notNull().default(0),
},t=>[primaryKey({columns:[t.userId,t.language,t.wordId]})]);
