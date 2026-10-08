import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {AsyncLocalStorage} from 'node:async_hooks';
import {DatabaseSync} from 'node:sqlite';

// Execute real application modules. Auth and D1 transport are simulated;
// all SQL runs against SQLite without touching any deployed user data.
const root=new URL('../',import.meta.url);
const require=createRequire(new URL('package.json',root));
const ts=require('typescript');
const identity=new AsyncLocalStorage();
const sqlite=new DatabaseSync(':memory:');
for(const migration of readdirSync(new URL('drizzle/',root)).filter(f=>f.endsWith('.sql')).sort().map(f=>`drizzle/${f}`)){
  sqlite.exec(readFileSync(new URL(migration,root),'utf8'));
}
let assertionCount=0;
let apiCount=0;
let raceGate=null;
const failures=[];
const passed=[];
const eq=(actual,expected,message)=>{assert.equal(actual,expected,message);assertionCount++;};
const deep=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);assertionCount++;};
const ok=(value,message)=>{assert.ok(value,message);assertionCount++;};

function beginRace(user,ids){
  assert.equal(raceGate,null);
  const gate={uid:user.userId,ids:new Set(ids),waiters:[],reads:0,timer:null};
  gate.timer=setTimeout(()=>{
    if(raceGate===gate)raceGate=null;
    for(const waiter of gate.waiters)waiter.reject(new Error('Race pre-read barrier timed out'));
  },5000);
  raceGate=gate;
  return gate;
}
async function afterPreRead(sql,values){
  const gate=raceGate;
  if(!gate||!sql.startsWith('SELECT language,lesson_id,mode FROM study_sessions')||values[0]!==gate.uid||!gate.ids.has(values[1]))return;
  // first() has already captured its result. Both API requests therefore
  // observe their pre-write snapshot before either starts its transaction.
  gate.reads++;
  await new Promise((resolve,reject)=>{
    gate.waiters.push({resolve,reject});
    if(gate.waiters.length===2){
      clearTimeout(gate.timer);
      raceGate=null;
      for(const waiter of gate.waiters)waiter.resolve();
    }
  });
}
function bound(sql,values=[]){
  return {
    sql,values,
    bind(...args){return bound(sql,args);},
    async first(column){
      const row=sqlite.prepare(sql).get(...values)??null;
      await afterPreRead(sql,values);
      return column&&row?row[column]:row;
    },
    async run(){
      const result=sqlite.prepare(sql).run(...values);
      return {success:true,meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}};
    },
  };
}
const DB={
  prepare:sql=>bound(sql),
  async batch(statements){
    sqlite.exec('BEGIN');
    try{
      const result=statements.map(s=>{
        const statement=sqlite.prepare(s.sql);
        if(statement.columns().length)return {results:statement.all(...s.values),success:true,meta:{changes:0}};
        const changed=statement.run(...s.values);
        return {results:[],success:true,meta:{changes:Number(changed.changes),last_row_id:Number(changed.lastInsertRowid)}};
      });
      sqlite.exec('COMMIT');
      return result;
    }catch(error){sqlite.exec('ROLLBACK');throw error;}
  },
};
const modules=new Map();
function moduleAt(file){
  if(modules.has(file))return modules.get(file).exports;
  const module={exports:{}};
  modules.set(file,module);
  const result=ts.transpileModule(readFileSync(new URL(file,root),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},
    reportDiagnostics:true,
  });
  assert.equal(result.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length??0,0,`Transpile errors in ${file}`);
  const dependency=name=>{
    if(name==='cloudflare:workers')return {env:{DB}};
    if(name==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>identity.getStore()??null};
    if(name==='@/lib/learning')return moduleAt('lib/learning.ts');
    if(name==='@/lib/vocabulary')return moduleAt('lib/vocabulary.ts');
    if(name==='@/db/store'||name==='./store')return moduleAt('db/store.ts');
    if(name==='@/lib/backup')return moduleAt('lib/backup.ts');
    if(name==='@/db/import-backup')return moduleAt('db/import-backup.ts');
    if(name==='./learning')return moduleAt('lib/learning.ts');
    if(name==='./vocabulary')return moduleAt('lib/vocabulary.ts');
    if(name==='./release')return moduleAt('lib/release.ts');
    if(name==='./curriculum.json'||name==='./vocabulary.json')return JSON.parse(readFileSync(new URL(`lib/${name.slice(2)}`,root),'utf8'));
    return require(name);
  };
  new Function('require','module','exports',result.outputText)(dependency,module,module.exports);
  return module.exports;
}
const api=moduleAt('app/api/progress/route.ts');
const {lessons,dateKey,plusDays}=moduleAt('lib/learning.ts');
const {vocabulary}=moduleAt('lib/vocabulary.ts');
const today=dateKey();
const tomorrow=plusDays(today,1);
const user=id=>({userId:`v4_${id}`,email:`${id}@example.test`});
const wordIds=(language,start=0)=>vocabulary[language].slice(start,start+5).map(word=>word.id);
const full=(language,lessonId,id=crypto.randomUUID())=>({action:'finish',id,language,lessonId,mode:'full',seconds:60,quizCorrect:true});
const game=(language,start=0,id=crypto.randomUUID())=>({action:'vocab_finish',id,language,wordIds:wordIds(language,start),seconds:30});
const favorite=(language,wordId,value=true)=>({action:'vocab_favorite',language,wordId,favorite:value});
const packKey=ids=>'vocab-pack:'+ids.slice().sort().join('|');
function canonical(state){
  return {...state,
    sessions:state.sessions.slice().sort((a,b)=>a.id.localeCompare(b.id)),
    completions:state.completions.slice().sort((a,b)=>(a.language+a.lesson_id).localeCompare(b.language+b.lesson_id)),
    cards:state.cards.slice().sort((a,b)=>(a.language+a.lesson_id+a.phrase_index).localeCompare(b.language+b.lesson_id+b.phrase_index)),
    words:state.words.slice().sort((a,b)=>(a.language+a.word_id).localeCompare(b.language+b.word_id)),
  };
}
async function get(who,status=who?200:401){
  const response=await identity.run(who,()=>api.GET());
  apiCount++;
  eq(response.status,status,await response.clone().text());
  eq(response.headers.get('cache-control'),'no-store');
  const body=await response.json();
  if(status===200)eq(body.accountId,who.userId);
  return body;
}
async function postRaw(who,body){
  const request=new Request('https://mam.example.test/api/progress',{
    method:'POST',headers:{'Content-Type':'application/json',Origin:'https://mam.example.test'},
    body:JSON.stringify({accountId:who?.userId??'anonymous',...body}),
  });
  const response=await identity.run(who,()=>api.POST(request));
  apiCount++;
  eq(response.headers.get('cache-control'),'no-store');
  const data=await response.json();
  if(response.status===200)eq(data.accountId,who.userId);
  return {status:response.status,data};
}
async function post(who,body,status=200){
  const result=await postRaw(who,body);
  eq(result.status,status,JSON.stringify(result.data));
  return result.data;
}
function word(state,id){return state.words.find(card=>card.word_id===id);}
function seedDue(who,language,wordId,strength,due=today){
  const result=sqlite.prepare('UPDATE vocabulary_progress SET due=?,strength=? WHERE user_id=? AND language=? AND word_id=?').run(due,strength,who.userId,language,wordId);
  eq(Number(result.changes),1);
}
async function test(name,run){
  try{await run();passed.push(name);console.log(`PASS ${name}`);}
  catch(error){failures.push({name,error});console.error(`FAIL ${name}: ${error.stack??error}`);}
}

await test('anonymous, stale-account guard, and strict owner rejection',async()=>{
  const A=user('guards_A'),B=user('guards_B');
  await get(null);
  await post(null,game('en'),401);
  const initial=canonical(await get(A));
  const changed=await post(A,{action:'preferences',language:'ja',accountId:B.userId},409);
  eq(changed.code,'ACCOUNT_CHANGED');
  await post(A,{action:'preferences',language:'en',user_id:B.userId},400);
  await post(A,{action:'preferences',language:'en',userId:B.userId},400);
  await post(A,{action:'preferences',language:'en',accountId:undefined},400);
  deep(canonical(await get(A)),initial);
  eq((await get(B)).sessions.length,0);
});

await test('Japanese full and quick study, replay, and daily lesson XP',async()=>{
  const A=user('Japanese');
  const payload=full('ja',lessons.ja[0].id);
  let state=await post(A,payload);
  eq(state.completions.length,1);eq(state.cards.length,3);eq(state.sessions[0].xp,20);
  ok(state.cards.every(card=>card.language==='ja'));
  const baseline=canonical(state);
  deep(canonical(await post(A,payload)),baseline);
  state=await post(A,{...full('ja',lessons.ja[1].id),mode:'quick'});
  eq(state.cards.length,4);eq(state.completions.length,1);
  eq(state.sessions.reduce((sum,s)=>sum+s.xp,0),25);
  state=await post(A,full('ja',lessons.ja[0].id));
  eq(state.sessions.length,3);eq(state.sessions.filter(s=>s.xp===0).length,1);eq(state.cards.length,4);
  await post(A,{action:'preferences',language:'ja'});
  eq((await get(A)).language,'ja');
});

await test('same UUID belongs independently to each authenticated user',async()=>{
  const A=user('same_uuid_A'),B=user('same_uuid_B'),id=crypto.randomUUID();
  let a=await post(A,full('en',lessons.en[8].id,id));
  let b=await post(B,{...full('zh',lessons.zh[8].id,id),mode:'quick'});
  eq(a.sessions.length,1);eq(b.sessions.length,1);
  eq(a.cards.length,3);eq(b.cards.length,1);
  eq(a.completions.length,1);eq(b.completions.length,0);
  await post(A,{action:'preferences',language:'en'});
  await post(B,{action:'preferences',language:'zh'});
  a=await get(A);b=await get(B);
  eq(a.language,'en');eq(b.language,'zh');
  ok(a.sessions.every(s=>s.language==='en'));ok(b.sessions.every(s=>s.language==='zh'));
  const sharedGameId=crypto.randomUUID();
  a=await post(A,game('ja',0,sharedGameId));
  b=await post(B,game('ja',5,sharedGameId));
  deep(a.words.map(w=>w.word_id).sort(),wordIds('ja',0).sort());
  deep(b.words.map(w=>w.word_id).sort(),wordIds('ja',5).sort());
  eq(a.sessions.find(s=>s.id===sharedGameId).xp,5);eq(b.sessions.find(s=>s.id===sharedGameId).xp,5);
});

await test('favorites do not mark words learned or create an early review',async()=>{
  const A=user('favorite'),id=vocabulary.zh[0].id;
  let state=await post(A,favorite('zh',id));
  deep(word(state,id),{language:'zh',word_id:id,favorite:1,learned:0,due:'',strength:0});
  eq(state.sessions.length,0);
  await post(A,{action:'vocab_review',language:'zh',wordId:id,strength:0,remembered:true},409);
  state=await post(A,favorite('zh',id,false));
  eq(word(state,id).favorite,0);eq(word(state,id).learned,0);eq(word(state,id).due,'');
  await post(A,favorite('zh','zh-invalid'),400);
  eq((await get(A)).words.length,1);
});

await test('five distinct valid vocabulary words are required and scheduled',async()=>{
  const A=user('valid_pack'),ids=wordIds('en');
  await post(A,{...game('en'),wordIds:[ids[0],ids[0],...ids.slice(2)]},400);
  await post(A,{...game('en'),wordIds:[...ids.slice(0,4),'en-invalid']},400);
  await post(A,{...game('en'),wordIds:[...ids.slice(0,4),vocabulary.zh[0].id]},400);
  await post(A,{...game('en'),wordIds:ids.slice(0,4)},400);
  await post(A,{...game('en'),wordIds:[...ids,vocabulary.en[5].id]},400);
  eq((await get(A)).words.length,0);eq((await get(A)).sessions.length,0);
  await post(A,favorite('en',ids[0]));
  const state=await post(A,game('en'));
  eq(state.words.length,5);eq(state.sessions.length,1);eq(state.sessions[0].xp,5);
  ok(state.words.every(w=>w.learned===1&&w.due===tomorrow&&w.strength===0));
  eq(word(state,ids[0]).favorite,1);eq(state.completions.length,0);eq(state.cards.length,0);
});

await test('game XP is capped by user, language, and current day',async()=>{
  const A=user('XP_A'),B=user('XP_B');
  let state=await post(A,game('en'));
  eq(state.sessions[0].xp,5);
  state=await post(A,game('en',5));
  eq(state.sessions.filter(s=>s.mode==='game'&&s.language==='en').reduce((n,s)=>n+s.xp,0),5);
  state=await post(A,game('zh'));
  state=await post(A,game('ja'));
  eq(state.sessions.reduce((n,s)=>n+s.xp,0),15);
  eq((await post(B,game('en'))).sessions[0].xp,5);
  // Test the next eligible day without replacing the production date helpers.
  sqlite.prepare('UPDATE study_sessions SET day=? WHERE user_id=?').run(plusDays(today,-1),A.userId);
  state=await post(A,game('en',10));
  eq(state.sessions.filter(s=>s.day===today).reduce((n,s)=>n+s.xp,0),5);
  eq(state.sessions.reduce((n,s)=>n+s.xp,0),20);
});

await test('game UUID replay is idempotent and conflicting content creates nothing',async()=>{
  const A=user('pack_replay'),payload=game('en');
  const baseline=canonical(await post(A,payload));
  deep(canonical(await post(A,{...payload,wordIds:payload.wordIds.slice().reverse(),seconds:100})),baseline);
  await post(A,game('en',5,payload.id),409);
  deep(canonical(await get(A)),baseline);
  await post(A,game('zh',0,payload.id),409);
  await post(A,full('en',lessons.en[0].id,payload.id),409);
  deep(canonical(await get(A)),baseline);
});

await test('word review handles due dates, remember, forget, and stale strength',async()=>{
  const A=user('review_A'),B=user('review_B'),ids=wordIds('en');
  await post(A,game('en'));
  await post(A,favorite('en',ids[0]));
  await post(A,{action:'vocab_review',language:'en',wordId:ids[0],strength:0,remembered:true},409);
  seedDue(A,'en',ids[0],0);
  let state=await post(A,{action:'vocab_review',language:'en',wordId:ids[0],strength:0,remembered:true});
  eq(word(state,ids[0]).strength,1);eq(word(state,ids[0]).due,plusDays(today,3));
  eq(word(state,ids[0]).favorite,1);eq(word(state,ids[0]).learned,1);
  const remembered=canonical(state);
  await post(A,{action:'vocab_review',language:'en',wordId:ids[0],strength:0,remembered:true},409);
  deep(canonical(await get(A)),remembered);
  seedDue(A,'en',ids[1],2);
  state=await post(A,{action:'vocab_review',language:'en',wordId:ids[1],strength:2,remembered:false});
  eq(word(state,ids[1]).strength,0);eq(word(state,ids[1]).due,tomorrow);eq(word(state,ids[1]).learned,1);
  eq(state.sessions.filter(s=>s.mode==='vocab-review').length,2);
  ok(state.sessions.filter(s=>s.mode==='vocab-review').every(s=>s.xp===0));
  seedDue(A,'en',ids[2],2);
  const staleBaseline=canonical(await get(A));
  await post(A,{action:'vocab_review',language:'en',wordId:ids[2],strength:1,remembered:true},409);
  deep(canonical(await get(A)),staleBaseline);
  await post(B,{action:'vocab_review',language:'en',wordId:ids[2],strength:2,remembered:true},409);
  eq((await get(B)).words.length,0);eq((await get(B)).sessions.length,0);
});

await test('favoriting and replay preserve learned strength and private review schedule',async()=>{
  const A=user('preserve'),ids=wordIds('en'),known=ids[0],future=plusDays(today,14);
  await post(A,game('en'));
  seedDue(A,'en',known,3,future);
  let state=await post(A,favorite('en',known));
  deep(word(state,known),{language:'en',word_id:known,favorite:1,learned:1,due:future,strength:3});
  state=await post(A,favorite('en',known,false));
  eq(word(state,known).favorite,0);eq(word(state,known).due,future);eq(word(state,known).strength,3);
  await post(A,favorite('en',known));
  const newWord=vocabulary.en[5].id;
  await post(A,favorite('en',newWord));
  state=await post(A,{...game('en'),wordIds:[known,...vocabulary.en.slice(5,9).map(w=>w.id)]});
  deep(word(state,known),{language:'en',word_id:known,favorite:1,learned:1,due:future,strength:3});
  deep(word(state,newWord),{language:'en',word_id:newWord,favorite:1,learned:1,due:tomorrow,strength:0});
  eq(state.words.length,9);
});

await test('concurrent same UUID different lessons leaves only the winner records',async()=>{
  const A=user('race_lessons'),id=crypto.randomUUID();
  const gate=beginRace(A,[id]);
  const responses=await Promise.all([
    postRaw(A,full('en',lessons.en[0].id,id)),
    postRaw(A,full('en',lessons.en[1].id,id)),
  ]);
  eq(gate.reads,2,'Both requests must read their pre-write session snapshot');
  deep(responses.map(r=>r.status).sort(),[200,409]);
  const state=await get(A),winner=state.sessions[0].lesson_id;
  eq(state.sessions.length,1);eq(state.completions.length,1);eq(state.cards.length,3);eq(state.words.length,0);
  eq(state.sessions[0].xp,20);eq(state.completions[0].lesson_id,winner);
  ok(state.cards.every(c=>c.lesson_id===winner));
});

await test('concurrent same UUID different packs leaves no losing words',async()=>{
  const A=user('race_packs'),id=crypto.randomUUID(),first=game('en',0,id),second=game('en',5,id);
  const gate=beginRace(A,[id]);
  const responses=await Promise.all([postRaw(A,first),postRaw(A,second)]);
  eq(gate.reads,2);deep(responses.map(r=>r.status).sort(),[200,409]);
  const state=await get(A);
  eq(state.sessions.length,1);eq(state.sessions[0].xp,5);eq(state.words.length,5);
  const winningIds=state.sessions[0].lesson_id===packKey(first.wordIds)?first.wordIds:second.wordIds;
  deep(state.words.map(w=>w.word_id).sort(),winningIds.slice().sort());
  eq(state.completions.length,0);eq(state.cards.length,0);
});

await test('concurrent lesson-versus-game UUID conflict creates no cross-mode records',async()=>{
  const A=user('race_modes'),id=crypto.randomUUID();
  const gate=beginRace(A,[id]);
  const responses=await Promise.all([postRaw(A,full('ja',lessons.ja[0].id,id)),postRaw(A,game('ja',0,id))]);
  eq(gate.reads,2);deep(responses.map(r=>r.status).sort(),[200,409]);
  const state=await get(A);eq(state.sessions.length,1);
  if(state.sessions[0].mode==='full'){
    eq(state.completions.length,1);eq(state.cards.length,3);eq(state.words.length,0);
  }else{
    eq(state.sessions[0].mode,'game');eq(state.words.length,5);eq(state.completions.length,0);eq(state.cards.length,0);
  }
});

await test('concurrent different game UUIDs still earn only five XP per language',async()=>{
  const A=user('race_XP'),first=game('zh'),second=game('zh',5);
  const gate=beginRace(A,[first.id,second.id]);
  const responses=await Promise.all([postRaw(A,first),postRaw(A,second)]);
  eq(gate.reads,2);deep(responses.map(r=>r.status),[200,200]);
  const state=await get(A);
  eq(state.sessions.length,2);eq(state.words.length,10);eq(state.sessions.reduce((sum,s)=>sum+s.xp,0),5);
  deep(state.sessions.map(s=>s.xp).sort(),[0,5]);
});

const {makeBackup,backupSchema,backupChunks,importChunkSchema}=moduleAt('lib/backup.ts');
await test('weekly goal persists per account and language changes preserve it',async()=>{
  const A=user('goal_A'),B=user('goal_B');
  eq((await get(A)).weeklyGoal,3);
  await post(A,{action:'goal',weeklyGoal:1});
  await post(A,{action:'preferences',language:'ja'});
  eq((await get(A)).weeklyGoal,1);eq((await get(A)).language,'ja');
  eq((await get(B)).weeklyGoal,3);
  for(const weeklyGoal of [0,8,1.5,'3'])await post(A,{action:'goal',weeklyGoal},400);
  eq((await get(A)).weeklyGoal,1);
});
await test('additive migration preserves seeded legacy data for multiple accounts',async()=>{
  const legacy=new DatabaseSync(':memory:');
  const files=readdirSync(new URL('drizzle/',root)).filter(f=>f.endsWith('.sql')).sort();
  legacy.exec(readFileSync(new URL(`drizzle/${files[0]}`,root),'utf8'));
  for(const uid of ['legacy_A','legacy_B']){
    legacy.prepare('INSERT INTO preferences (user_id,language) VALUES (?,?)').run(uid,'zh');
    legacy.prepare('INSERT INTO study_sessions VALUES (?,?,?,?,?,?,?,?)').run(uid,'old-session','zh',lessons.zh[0].id,'full',today,70,20);
    legacy.prepare('INSERT INTO completions VALUES (?,?,?,?)').run(uid,'zh',lessons.zh[0].id,today);
    legacy.prepare('INSERT INTO review_cards VALUES (?,?,?,?,?,?)').run(uid,'zh',lessons.zh[0].id,0,tomorrow,2);
  }
  const baseline=['study_sessions','completions','review_cards'].map(t=>legacy.prepare(`SELECT * FROM ${t} ORDER BY user_id`).all());
  for(const file of files.slice(1))legacy.exec(readFileSync(new URL(`drizzle/${file}`,root),'utf8'));
  deep(['study_sessions','completions','review_cards'].map(t=>legacy.prepare(`SELECT * FROM ${t} ORDER BY user_id`).all()),baseline);
  deep(legacy.prepare('SELECT language,weekly_goal FROM preferences ORDER BY user_id').all().map(r=>({...r})),[{language:'zh',weekly_goal:3},{language:'zh',weekly_goal:3}]);
  legacy.close();
});
await test('backup export restores all three languages without crossing accounts',async()=>{
  const A=user('backup'),B=user('other_backup');
  await post(A,{action:'goal',weeklyGoal:5});
  await post(A,{action:'preferences',language:'ja'});
  for(const lang of ['en','zh','ja']){
    await post(A,full(lang,lessons[lang][0].id));
    await post(A,game(lang));
    await post(A,favorite(lang,vocabulary[lang][0].id));
  }
  const before=canonical(await get(A)),snapshot=makeBackup(before);
  ok(backupSchema.safeParse(snapshot).success);
  await post(B,{action:'import',backup:snapshot},403);
  eq((await get(B)).sessions.length,0);
  for(const table of ['preferences','study_sessions','completions','review_cards','vocabulary_progress'])sqlite.prepare(`DELETE FROM ${table} WHERE user_id=?`).run(A.userId);
  for(const chunk of backupChunks(snapshot))await post(A,{action:'import',backup:chunk});
  deep(canonical(await get(A)),before);
  for(const chunk of backupChunks(snapshot))await post(A,{action:'import',backup:chunk});
  deep(canonical(await get(A)),before);
});
await test('older backups add missing rows while preserving current review and choices',async()=>{
  const A=user('old_backup');
  await post(A,full('en',lessons.en[0].id));await post(A,game('en'));
  const snapshot=makeBackup(await get(A));
  await post(A,{action:'goal',weeklyGoal:1});await post(A,{action:'preferences',language:'zh'});
  const id=vocabulary.en[0].id,future=plusDays(today,14);
  seedDue(A,'en',id,3,future);await post(A,favorite('en',id));
  sqlite.prepare('DELETE FROM review_cards WHERE user_id=? AND phrase_index=2').run(A.userId);
  await post(A,{action:'import',backup:snapshot});
  const state=await get(A);
  eq(state.weeklyGoal,1);eq(state.language,'zh');eq(state.cards.length,3);
  deep(word(state,id),{language:'en',word_id:id,favorite:1,learned:1,due:future,strength:3});
  eq(state.sessions.length,2);
});
await test('chunked import can resume a partial transfer without duplicates',async()=>{
  const A=user('chunks'),snapshot=makeBackup(await get(A));
  snapshot.sessions=Array.from({length:205},(_,i)=>({id:crypto.randomUUID(),language:'en',lesson_id:lessons.en[0].id,mode:'quick',day:today,seconds:5,xp:0}));
  const chunks=backupChunks(backupSchema.parse(snapshot));
  eq(chunks.length,3);deep(chunks.map(c=>c.sessions.length),[100,100,5]);
  ok(chunks.every(c=>importChunkSchema.safeParse(c).success));
  await post(A,{action:'import',backup:snapshot},400);
  await post(A,{action:'import',backup:chunks[0]});
  eq((await get(A)).sessions.length,100);
  for(const chunk of chunks)await post(A,{action:'import',backup:chunk});
  const state=await get(A);eq(state.sessions.length,205);eq(new Set(state.sessions.map(s=>s.id)).size,205);
});
await test('invalid or future backup formats fail before writing any rows',async()=>{
  const A=user('invalid_backup'),baseline=canonical(await get(A)),snapshot=makeBackup(baseline);
  for(const backup of [{...snapshot,formatVersion:2},{...snapshot,ownerId:'someone_else'},{...snapshot,unexpected:'field'},
    {...snapshot,completions:[{language:'en',lesson_id:'deleted-lesson',day:today}]},
    {...snapshot,cards:[{language:'ja',lesson_id:lessons.ja[0].id,phrase_index:0,due:'2026-02-30',strength:0}]},
    {...snapshot,words:[{language:'en',word_id:vocabulary.en[0].id,favorite:1,learned:1,due:'',strength:0}]}]){
    await post(A,{action:'import',backup},backup.ownerId==='someone_else'?403:400);
    deep(canonical(await get(A)),baseline);
  }
});

sqlite.close();
console.log(`\n${failures.length?'FAILED':'PASS'}: ${passed.length} scenarios; ${assertionCount} assertions; ${apiCount} actual API calls; Node ${process.version}.`);
console.log('Loaded actual route/store/learning/vocabulary TS through transpileModule and applied every real SQLite migration.');
console.log('Limits: in-memory SQLite D1 adapter and mocked authenticated context; no live gateway/auth headers, deployed D1, browser UI, audio, or hosting verification.');
if(failures.length)process.exitCode=1;
