import { env } from 'cloudflare:workers';
import { dateKey, type StudyState } from '@/lib/learning';
export function database() {if(!env.DB) throw new Error('D1 binding unavailable');return env.DB;}
export async function readState(userId:string):Promise<StudyState> {
  const db=database();
  const [prefs,sessions,completions,cards,words]=await db.batch([
    db.prepare('SELECT language,weekly_goal FROM preferences WHERE user_id = ?').bind(userId),
    db.prepare('SELECT id, language, lesson_id, mode, day, seconds, xp FROM study_sessions WHERE user_id = ? ORDER BY day DESC').bind(userId),
    db.prepare('SELECT language, lesson_id, day FROM completions WHERE user_id = ?').bind(userId),
    db.prepare('SELECT language, lesson_id, phrase_index, due, strength FROM review_cards WHERE user_id = ? ORDER BY due ASC').bind(userId),
    db.prepare('SELECT language,word_id,favorite,learned,due,strength FROM vocabulary_progress WHERE user_id = ? ORDER BY due ASC').bind(userId),
  ]);
  return {accountId:userId,weeklyGoal: (prefs.results?.[0] as {weekly_goal?:number}|undefined)?.weekly_goal ?? 3,language: ((prefs.results?.[0] as {language?:string}|undefined)?.language || 'en') as StudyState['language'], today:dateKey(),sessions:sessions.results as StudyState['sessions'],completions:completions.results as StudyState['completions'],cards:cards.results as StudyState['cards'],words:words.results as StudyState['words']};
}

