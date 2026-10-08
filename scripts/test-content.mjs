import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const read=file=>readFileSync(new URL(file,root),'utf8');
const course=JSON.parse(read('lib/curriculum.json'));
const words=JSON.parse(read('lib/vocabulary.json'));
const baseline=JSON.parse(read('lib/content-manifest.json'));
let lessons=0,vocabulary=0;
for(const lang of ['en','zh','ja']){
  const items=course[lang],bank=words[lang];
  assert(items.length>=30&&bank.length>=120);
  assert.equal(new Set(items.map(l=>l.id)).size,items.length);
  assert.equal(new Set(bank.map(w=>w.id)).size,bank.length);
  for(const old of baseline.lessons[lang]){
    const current=items.find(l=>l.id===old.id);
    assert(current,`Published lesson ${old.id} must remain available`);
    assert.deepEqual(current.phrases.map(p=>p.text),old.phrases,`Phrase order/text anchors review data: ${old.id}`);
  }
  for(const old of baseline.words[lang])assert.equal(bank.find(w=>w.id===old.id)?.term,old.term,`Published word ${old.id} must retain its identity`);
  for(const lesson of items){
    assert.equal(lesson.phrases.length,3);
    for(const p of lesson.phrases){assert(p.text&&p.meaning);if(lang==='zh')assert(p.pinyin);if(lang==='ja')assert(p.romaji);}
    for(const question of [lesson.quiz,lesson.conversation,...(lesson.dialogue??[])]){
      assert(question.options.length>=2);
      assert(Number.isInteger(question.correctIndex)&&question.correctIndex>=0&&question.correctIndex<question.options.length);
      assert(question.feedback);
    }
    if(lesson.build){
      const b=lesson.build;
      const counts=t=>t.reduce((m,x)=>({...m,[x]:(m[x]??0)+1}),{});
      assert.deepEqual(counts(b.tokens),counts(b.answer),`Puzzle must be solvable: ${lesson.id}`);
      for(const answer of b.acceptedAnswers??[])assert.deepEqual(counts(b.tokens),counts(answer));
    }
  }
  for(const word of bank){assert(word.term&&word.meaning&&word.example.text&&word.example.meaning);if(lang!=='en')assert(word.reading&&word.example.reading);}
  assert.equal(new Set(bank.map(w=>w.category)).size,10);
  lessons+=items.length;vocabulary+=bank.length;
}
for(const [file,hash] of Object.entries(baseline.migrations)){
  const actual=createHash('sha256').update(read(`drizzle/${file}`).replaceAll('\r\n','\n')).digest('hex');
  assert.equal(actual,hash,`Published migration must be immutable: ${file}`);
}
console.log(`PASS content: ${lessons} lessons, ${vocabulary} words; stable IDs, review anchors, exercises, readings and immutable migrations.`);
