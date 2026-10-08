'use client';
import { useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { sentenceText, locale, type BuildExercise, type Lang } from '@/lib/learning';

export default function WordPuzzle({exercise,language,onContinue}:{exercise:BuildExercise;language:Lang;onContinue:()=>void}){
  const [picked,setPicked]=useState<number[]>([]),[checked,setChecked]=useState<boolean|null>(null);
  const complete=picked.length===exercise.tokens.length;
  const sentence=sentenceText(picked.map(i=>exercise.tokens[i]),language);
  const correct=sentenceText(exercise.answer,language);
  function reset(){setPicked([]);setChecked(null);}
  function check(){if(complete)setChecked([exercise.answer,...(exercise.acceptedAnswers??[])].some(tokens=>sentenceText(tokens,language).toLocaleLowerCase()===sentence.toLocaleLowerCase()));}
  return <section className="exercise-card word-exercise">
    <p className="eyebrow">GHÉP MỘT CÂU CỦA BẠN</p><h1>Thử ghép câu này.</h1><p className="exercise-context">{exercise.prompt}</p><p className="muted small-note">Chọn các từ theo thứ tự. Chạm lại một từ đã chọn để bỏ nó.</p>
    <div className="sentence-slot" aria-label="Câu bạn đang ghép" aria-live="polite">{picked.length?picked.map((index,pos)=><button key={index} lang={locale[language]} disabled={checked!==null} className="word-token picked" aria-label={`Bỏ từ ${exercise.tokens[index]}`} onClick={()=>setPicked(p=>p.filter((_,i)=>i!==pos))}>{exercise.tokens[index]}</button>):<span>Câu của bạn sẽ xuất hiện ở đây…</span>}</div>
    <div className="word-bank" aria-label="Các từ để chọn">{exercise.tokens.map((token,i)=><button key={i} lang={locale[language]} className="word-token" aria-label={`Chọn từ ${token}`} disabled={picked.includes(i)||checked!==null} onClick={()=>setPicked(p=>[...p,i])}>{token}</button>)}</div>
    <button className="text-button puzzle-reset" onClick={reset}><RotateCcw size={16}/>Ghép lại</button>
    {checked!==null&&<div className={checked?'feedback success':'feedback'} role="status"><strong>{checked?'Bạn đã tự ghép được một câu!':'Mình xem một cách ghép tự nhiên nhé.'}</strong><p className="model-sentence" lang={locale[language]}>{correct}</p>{(exercise.pinyin||exercise.romaji)&&<span className="pinyin">{exercise.pinyin||exercise.romaji}</span>}<p>{exercise.meaning}</p></div>}
    {checked===null?<button className="primary exercise-next" disabled={!complete} onClick={check}>Kiểm tra câu <Check size={19}/></button>:<button className="primary exercise-next" onClick={onContinue}>{checked?'Tiếp tục':'Mình đã xem mẫu · tiếp tục'}</button>}
  </section>;
}
