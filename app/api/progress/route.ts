import { z } from 'zod';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { database, readState } from '@/db/store';
import { lessons, dateKey, plusDays } from '@/lib/learning';
import { vocabulary } from '@/lib/vocabulary';
import { importChunkSchema } from '@/lib/backup';
import { importBackup } from '@/db/import-backup';
export const dynamic = 'force-dynamic';
const lang=z.enum(['en','zh','ja']);
const account={accountId:z.string().min(1).max(200)};
const actions=z.discriminatedUnion('action',[
  z.object({...account,action:z.literal('goal'),weeklyGoal:z.number().int().min(1).max(7)}).strict(),
  z.object({...account,action:z.literal('import'),backup:importChunkSchema}).strict(),
  z.object({...account,action:z.literal('preferences'),language:lang}).strict(),
  z.object({...account,action:z.literal('finish'),language:lang,lessonId:z.string().max(80),mode:z.enum(['full','quick']),id:z.string().uuid(),seconds:z.number().int().min(0).max(3600),quizCorrect:z.boolean()}).strict(),
  z.object({...account,action:z.literal('review'),language:lang,lessonId:z.string().max(80),phraseIndex:z.number().int().min(0).max(2),remembered:z.boolean(),strength:z.number().int().min(0).max(4)}).strict(),
  z.object({...account,action:z.literal('vocab_favorite'),language:lang,wordId:z.string().max(40),favorite:z.boolean()}).strict(),
  z.object({...account,action:z.literal('vocab_finish'),language:lang,wordIds:z.array(z.string().max(40)).length(5),id:z.string().uuid(),seconds:z.number().int().min(0).max(600)}).strict(),
  z.object({...account,action:z.literal('vocab_review'),language:lang,wordId:z.string().max(40),remembered:z.boolean(),strength:z.number().int().min(0).max(4)}).strict(),
]);
function reply(body:unknown,status=200){return Response.json(body,{status,headers:{'Cache-Control':'no-store'}});}
type SessionKey={uid:string;id:string;language:string;lessonId:string;mode:string};
const sessionWhere=' WHERE user_id=? AND id=? AND language=? AND lesson_id=? AND mode=?';
const sessionArgs=(s:SessionKey)=>[s.uid,s.id,s.language,s.lessonId,s.mode];
async function existingSession(key:SessionKey){
  const row=await database().prepare('SELECT language,lesson_id,mode FROM study_sessions WHERE user_id=? AND id=?').bind(key.uid,key.id).first<{language:string;lesson_id:string;mode:string}>();
  return row ? row.language===key.language&&row.lesson_id===key.lessonId&&row.mode===key.mode?'same':'conflict' : 'new';
}
function sessionInsert(key:SessionKey,today:string,seconds:number,xp:number,dailyLanguageCap=false){
  return database().prepare('INSERT OR IGNORE INTO study_sessions (user_id,id,language,lesson_id,mode,day,seconds,xp) SELECT ?,?,?,?,?,?,?, CASE WHEN EXISTS (SELECT 1 FROM study_sessions WHERE user_id=? AND language=? AND mode=? AND day=? AND (?=1 OR lesson_id=?)) THEN 0 ELSE ? END').bind(...sessionArgs(key).slice(0,4),key.mode,today,seconds,key.uid,key.language,key.mode,today,dailyLanguageCap?1:0,key.lessonId,xp);
}
export async function GET(){
  const user=await getChatGPTUser();if(!user)return reply({error:'Bạn cần đăng nhập để lưu tiến bộ.'},401);
  try{return reply(await readState(user.userId));}catch(e){console.error('progress-load',e);return reply({error:'Chưa tải được tiến bộ. Bạn có thể thử lại.'},503);}
}
export async function POST(request:Request){
  const user=await getChatGPTUser();if(!user)return reply({error:'Bạn cần đăng nhập để lưu tiến bộ.'},401);
  const origin=request.headers.get('origin');if(origin && origin!==new URL(request.url).origin)return reply({error:'Yêu cầu không hợp lệ.'},403);
  let raw;try{const text=await request.text();if(text.length>65536)return reply({error:'Yêu cầu quá dài.'},400);raw=JSON.parse(text);}catch{return reply({error:'Yêu cầu không hợp lệ.'},400);}
  const parsed=actions.safeParse(raw);if(!parsed.success)return reply({error:'Dữ liệu không hợp lệ. Nếu bạn vừa mở bản mới, hãy tải lại trang.'},400);
  const a=parsed.data,uid=user.userId,today=dateKey();
  // This client ID only guards stale tabs. The signed-in user owns every query.
  if(a.accountId!==uid)return reply({error:'Tài khoản đã đổi. Mở lại Mầm để vào đúng góc học của bạn.',code:'ACCOUNT_CHANGED'},409);
  try {
    const db=database();
    if(a.action==='import'){
      if(a.backup.ownerId!==uid)return reply({error:'Bản sao lưu thuộc một tài khoản khác.'},403);
      await importBackup(uid,a.backup);
    }else if(a.action==='goal'){
      await db.prepare('INSERT INTO preferences (user_id,weekly_goal) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET weekly_goal=excluded.weekly_goal').bind(uid,a.weeklyGoal).run();
    }else if(a.action==='preferences'){
      await db.prepare('INSERT INTO preferences (user_id, language) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET language = excluded.language').bind(uid,a.language).run();
    }else if(a.action==='vocab_favorite'){
      if(!vocabulary[a.language].some(w=>w.id===a.wordId))return reply({error:'Không tìm thấy từ.'},400);
      await db.prepare('INSERT INTO vocabulary_progress (user_id,language,word_id,favorite) VALUES (?,?,?,?) ON CONFLICT(user_id,language,word_id) DO UPDATE SET favorite=excluded.favorite').bind(uid,a.language,a.wordId,a.favorite?1:0).run();
    }else if(a.action==='vocab_finish'){
      if(new Set(a.wordIds).size!==5||a.wordIds.some(id=>!vocabulary[a.language].some(w=>w.id===id)))return reply({error:'Bộ từ chưa hợp lệ.'},400);
      const key={uid,id:a.id,language:a.language,lessonId:'vocab-pack:'+a.wordIds.slice().sort().join('|'),mode:'game'};
      const exists=await existingSession(key);
      if(exists==='conflict')return reply({error:'Buổi học này đã được lưu cho một nội dung khác. Hãy mở lượt mới.'},409);
      if(exists==='new'){
        const statements=[sessionInsert(key,today,a.seconds,5,true)];
        for(const wordId of a.wordIds){
          statements.push(db.prepare('INSERT OR IGNORE INTO vocabulary_progress (user_id,language,word_id,learned,due) SELECT user_id,language,?,1,? FROM study_sessions'+sessionWhere).bind(wordId,plusDays(today,1),...sessionArgs(key)));
          statements.push(db.prepare('UPDATE vocabulary_progress SET due=CASE WHEN learned=0 THEN ? ELSE due END,learned=1 WHERE user_id=? AND language=? AND word_id=? AND EXISTS (SELECT 1 FROM study_sessions'+sessionWhere+')').bind(plusDays(today,1),uid,a.language,wordId,...sessionArgs(key)));
        }
        await db.batch(statements);
        if(await existingSession(key)==='conflict')return reply({error:'Buổi học này đã được lưu cho một nội dung khác. Hãy mở lượt mới.'},409);
      }
    }else if(a.action==='vocab_review'){
      if(!vocabulary[a.language].some(w=>w.id===a.wordId))return reply({error:'Không tìm thấy từ.'},400);
      const card=await db.prepare('SELECT strength,due FROM vocabulary_progress WHERE user_id=? AND language=? AND word_id=? AND learned=1').bind(uid,a.language,a.wordId).first<{strength:number;due:string}>();
      if(!card||card.due>today||card.strength!==a.strength)return reply({error:'Từ này đã được cập nhật. Hãy tải lại phần ôn.'},409);
      const strength=a.remembered?Math.min(card.strength+1,4):0;
      await db.batch([
        db.prepare("INSERT OR IGNORE INTO study_sessions (user_id,id,language,lesson_id,mode,day,seconds,xp) SELECT user_id,?,language,word_id,'vocab-review',?,0,0 FROM vocabulary_progress WHERE user_id=? AND language=? AND word_id=? AND learned=1 AND strength=? AND due<=?").bind(`word-review:${a.language}:${a.wordId}:${today}`,today,uid,a.language,a.wordId,card.strength,today),
        db.prepare('UPDATE vocabulary_progress SET strength=?,due=? WHERE user_id=? AND language=? AND word_id=? AND learned=1 AND strength=? AND due<=?').bind(strength,plusDays(today,a.remembered?[1,3,7,14,30][strength]:1),uid,a.language,a.wordId,card.strength,today),
      ]);
    }else {
      const lesson=lessons[a.language].find(l=>l.id===a.lessonId);if(!lesson)return reply({error:'Không tìm thấy bài học.'},400);
      if(a.action==='finish'){
        const key={uid,id:a.id,language:a.language,lessonId:a.lessonId,mode:a.mode};
        const exists=await existingSession(key);
        if(exists==='conflict')return reply({error:'Buổi này đã được lưu cho một bài khác. Hãy mở bài mới.'},409);
        if(exists==='new'){
          const statements=[sessionInsert(key,today,a.seconds,a.mode==='full'?20:5)];
          if(a.mode==='full')statements.push(db.prepare('INSERT OR IGNORE INTO completions (user_id,language,lesson_id,day) SELECT user_id,language,lesson_id,day FROM study_sessions'+sessionWhere).bind(...sessionArgs(key)));
          for(const i of a.mode==='full'?[0,1,2]:[0])statements.push(db.prepare('INSERT OR IGNORE INTO review_cards (user_id,language,lesson_id,phrase_index,due,strength) SELECT user_id,language,lesson_id,?,?,0 FROM study_sessions'+sessionWhere).bind(i,plusDays(today,1),...sessionArgs(key)));
          await db.batch(statements);
          if(await existingSession(key)==='conflict')return reply({error:'Buổi này đã được lưu cho một bài khác. Hãy mở bài mới.'},409);
        }
      }else{
        const card=await db.prepare('SELECT strength,due FROM review_cards WHERE user_id=? AND language=? AND lesson_id=? AND phrase_index=?').bind(uid,a.language,a.lessonId,a.phraseIndex).first<{strength:number;due:string}>();
        if(!card || card.due>today || card.strength!==a.strength)return reply({error:'Thẻ này đã được cập nhật. Hãy tải lại phần ôn tập.'},409);
        const strength=a.remembered?Math.min(card.strength+1,4):0;
        await db.batch([
          db.prepare("INSERT OR IGNORE INTO study_sessions (user_id,id,language,lesson_id,mode,day,seconds,xp) SELECT user_id,?,language,lesson_id,'review',?,0,0 FROM review_cards WHERE user_id=? AND language=? AND lesson_id=? AND phrase_index=? AND strength=? AND due<=?").bind(`review:${a.language}:${a.lessonId}:${a.phraseIndex}:${today}`,today,uid,a.language,a.lessonId,a.phraseIndex,card.strength,today),
          db.prepare('UPDATE review_cards SET strength=?, due=? WHERE user_id=? AND language=? AND lesson_id=? AND phrase_index=? AND strength=? AND due<=?').bind(strength,plusDays(today,a.remembered?[1,3,7,14,30][strength]:1),uid,a.language,a.lessonId,a.phraseIndex,card.strength,today),
        ]);
      }
    }
    return reply(await readState(uid));
  }catch(e){console.error('progress-save',e);return reply({error:'Chưa lưu được. Giữ trang này mở và thử lại nhé.'},503);}
}
