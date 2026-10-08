import {z} from 'zod';
import {lessons,languages,dateKey,type StudyState} from './learning';
import {vocabulary} from './vocabulary';
import {release} from './release';

const language=z.enum(['en','zh','ja']);
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>{const d=new Date(s+'T00:00:00Z');return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===s;});
const lessonExists=(lang:StudyState['language'],id:string)=>lessons[lang].some(l=>l.id===id);
const wordExists=(lang:StudyState['language'],id:string)=>vocabulary[lang].some(w=>w.id===id);
const completion=z.object({language,lesson_id:z.string().max(80),day}).strict().refine(r=>lessonExists(r.language,r.lesson_id));
const card=z.object({language,lesson_id:z.string().max(80),phrase_index:z.number().int().min(0).max(2),due:day,strength:z.number().int().min(0).max(4)}).strict().refine(r=>lessonExists(r.language,r.lesson_id));
const word=z.object({language,word_id:z.string().max(40),favorite:z.union([z.literal(0),z.literal(1)]),learned:z.union([z.literal(0),z.literal(1)]),due:z.union([day,z.literal('')]),strength:z.number().int().min(0).max(4)}).strict().refine(r=>wordExists(r.language,r.word_id)&&(!r.learned||r.due!==''));
const session=z.object({id:z.string().min(1).max(200),language,lesson_id:z.string().max(200),mode:z.enum(['full','quick','review','game','vocab-review']),day,seconds:z.number().int().min(0).max(3600),xp:z.number().int().min(0).max(20)}).strict().refine(r=>{
  if(r.mode==='vocab-review')return wordExists(r.language,r.lesson_id)&&r.xp===0;
  if(r.mode==='game'){
    const ids=r.lesson_id.startsWith('vocab-pack:')?r.lesson_id.slice(11).split('|'):[];
    return ids.length===5&&new Set(ids).size===5&&ids.every(id=>wordExists(r.language,id))&&r.xp<=5;
  }
  return lessonExists(r.language,r.lesson_id)&&(r.mode!=='review'||r.xp===0)&&(r.mode!=='quick'||r.xp<=5);
});
export const backupSchema=z.object({
  app:z.literal('mam'),formatVersion:z.literal(1),appVersion:z.string().max(30),ownerId:z.string().min(1).max(200),
  exportedAt:z.string().datetime(),preferences:z.object({language,weeklyGoal:z.number().int().min(1).max(7)}).strict(),
  sessions:z.array(session).max(50000),completions:z.array(completion).max(1000),cards:z.array(card).max(10000),words:z.array(word).max(10000),
}).strict().refine(b=>b.sessions.length+b.completions.length+b.cards.length+b.words.length<=50000,'Backup too large');
export type Backup=z.infer<typeof backupSchema>;
export const importChunkSchema=backupSchema.refine(b=>b.sessions.length+b.completions.length+b.cards.length+b.words.length<=100,'Import at most 100 records at a time');
export function makeBackup(state:StudyState):Backup{
  return {app:'mam',formatVersion:1,appVersion:release.version,ownerId:state.accountId,exportedAt:new Date().toISOString(),preferences:{language:state.language,weeklyGoal:state.weeklyGoal},sessions:state.sessions as Backup['sessions'],completions:state.completions,cards:state.cards,words:state.words as Backup['words']};
}
export function backupChunks(backup:Backup){
  const chunks:Backup[]=[];
  let chunk:Backup={...backup,sessions:[],completions:[],cards:[],words:[]},size=0;
  for(const table of ['sessions','completions','cards','words'] as const){
    for(const row of backup[table]){
      if(size===100){chunks.push(chunk);chunk={...backup,sessions:[],completions:[],cards:[],words:[]};size=0;}
      // All rows were validated by their table schema before being partitioned.
      (chunk[table] as unknown[]).push(row);size++;
    }
  }
  if(size||!chunks.length)chunks.push(chunk);
  return chunks;
}
export function backupSummary(backup:Backup){return {sessions:backup.sessions.length,lessons:backup.completions.length,cards:backup.cards.length,words:backup.words.length};}
export const backupFilename=()=>`mam-backup-${dateKey()}.json`;
export const supportedBackupLanguages=languages;
