import type {Backup} from '@/lib/backup';
import {database} from './store';

// Merge missing records only. A repeated or older backup cannot roll back
// current progress. Ownership is always supplied by authenticated server code.
export async function importBackup(uid:string,backup:Backup){
  const db=database();
  const statements=[db.prepare('INSERT OR IGNORE INTO preferences (user_id,language,weekly_goal) VALUES (?,?,?)').bind(uid,backup.preferences.language,backup.preferences.weeklyGoal)];
  function insert(table:string,columns:string[],rows:unknown[][]){
    const perStatement=Math.floor(90/columns.length);
    for(let i=0;i<rows.length;i+=perStatement){
      const pack=rows.slice(i,i+perStatement);
      const sql=`INSERT OR IGNORE INTO ${table} (${columns.join(',')}) VALUES ${pack.map(()=>`(${columns.map(()=>'?').join(',')})`).join(',')}`;
      statements.push(db.prepare(sql).bind(...pack.flat()));
    }
  }
  insert('study_sessions',['user_id','id','language','lesson_id','mode','day','seconds','xp'],backup.sessions.map(r=>[uid,r.id,r.language,r.lesson_id,r.mode,r.day,r.seconds,r.xp]));
  insert('completions',['user_id','language','lesson_id','day'],backup.completions.map(r=>[uid,r.language,r.lesson_id,r.day]));
  insert('review_cards',['user_id','language','lesson_id','phrase_index','due','strength'],backup.cards.map(r=>[uid,r.language,r.lesson_id,r.phrase_index,r.due,r.strength]));
  insert('vocabulary_progress',['user_id','language','word_id','favorite','learned','due','strength'],backup.words.map(r=>[uid,r.language,r.word_id,r.favorite,r.learned,r.due,r.strength]));
  await db.batch(statements);
}
