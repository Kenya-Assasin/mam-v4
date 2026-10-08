import curriculum from './curriculum.json';
export type Lang = 'en' | 'zh' | 'ja';
export const languages:Lang[]=['en','zh','ja'];
export const languageNames:Record<Lang,string>={en:'Tiếng Anh',zh:'Tiếng Trung',ja:'Tiếng Nhật'};
export const languageSymbols:Record<Lang,string>={en:'EN',zh:'中',ja:'日'};
export const locale:Record<Lang,string>={en:'en-US',zh:'zh-CN',ja:'ja-JP'};
export type Phrase = {text:string; meaning:string; pinyin?:string; romaji?:string};
export type ConversationTurn = {speaker:Phrase; options:Phrase[]; correctIndex:number; feedback:string};
export type BuildExercise = {prompt:string; tokens:string[]; answer:string[]; acceptedAnswers?:string[][]; meaning:string; pinyin?:string; romaji?:string};
export type Lesson = {
  id:string; title:string; context:string; phrases:Phrase[];
  quiz:{question:string; options:string[]; correctIndex:number; feedback:string};
  conversation:{intro:string; speaker:Phrase; options:Phrase[]; correctIndex:number; feedback:string};
  speak:{prompt:string; text:string; pinyin?:string; romaji?:string; optional:boolean};
  stage?:number; focus?:string; tip?:string; checkpoint?:boolean;
  build?:BuildExercise; dialogue?:ConversationTurn[];
};
export const lessons = curriculum as unknown as Record<Lang,Lesson[]>;
export const stages = [
  {name:'Khởi động',label:'Chặng 1',goal:{en:'Chào hỏi, giới thiệu và nói điều mình cần.',zh:'Làm quen pinyin và những câu đầu tiên.',ja:'Làm quen kana, romaji và lời chào lịch sự.'}},
  {name:'Giao tiếp hằng ngày',label:'Chặng 2',goal:{en:'Dùng câu cơ bản khi mua sắm, đi lại và nói về bản thân.',zh:'Hỏi giá, nói giờ, gia đình và sinh hoạt thường ngày.',ja:'Gọi món, mua đồ, hỏi giờ và nói về bản thân.'}},
  {name:'Nói nhiều hơn',label:'Chặng 3',goal:{en:'Kể việc đã làm, lên kế hoạch và giải thích ý kiến đơn giản.',zh:'Kết nối câu, hẹn gặp và trao đổi kế hoạch đơn giản.',ja:'Hỏi đường, nhờ giúp, hẹn gặp và nói kế hoạch ngắn.'}},
] as const;
export function lessonStage(lesson:Lesson){return lesson.stage ?? 0;}
export function lessonSteps(lesson:Lesson,mode:'quick'|'full'){
  if(mode==='quick')return ['learn','quickquiz','speak','done'];
  return ['learn','learn','learn','quiz',...(lesson.build?['build']:[]),...(lesson.dialogue?.length?lesson.dialogue.map((_,i)=>`talk:${i}`):['talk']),'speak','done'];
}
export function sentenceText(tokens:string[],lang:Lang){return tokens.join(lang==='en'?' ':'').replace(/\s+([?.!,])/g,'$1');}
export type Card = {language:Lang; lesson_id:string; phrase_index:number; due:string; strength:number};
export type StudyState = {
  accountId:string;
  weeklyGoal:number;
  language:Lang; today:string; sessions:{id:string; language:Lang; lesson_id:string; mode:string; day:string; seconds:number; xp:number}[];
  completions:{language:Lang;lesson_id:string;day:string}[]; cards:Card[];
  words:{language:Lang;word_id:string;favorite:number;learned:number;due:string;strength:number}[];
};
export function dateKey() {
  const parts = new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  return ['year','month','day'].map(k=>parts.find(p=>p.type===k)?.value).join('-');
}
export function plusDays(day:string,days:number){return new Date(Date.parse(day+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);}
