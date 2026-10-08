import data from './vocabulary.json';
import type {Lang, StudyState} from './learning';
export type Vocabulary={id:string;term:string;reading?:string;meaning:string;category:string;example:{text:string;meaning:string;reading?:string}};
export const vocabulary=data as Record<Lang,Vocabulary[]>;
export const categories=[
 {id:'greetings',name:'Chào hỏi'},{id:'people',name:'Con người'},
 {id:'numbers',name:'Số & lượng'},{id:'food',name:'Ăn uống'},
 {id:'places',name:'Địa điểm'},{id:'time',name:'Thời gian'},
 {id:'actions',name:'Hành động'},{id:'feelings',name:'Cảm xúc'},
 {id:'study',name:'Học tập'},{id:'travel',name:'Đi lại'},
];
export function achievements(state:StudyState){
 const days=new Set(state.sessions.map(s=>s.day)).size;
 const learned=state.words.filter(w=>w.learned===1).length;
 const reviews=state.sessions.filter(s=>s.mode==='review'||s.mode==='vocab-review').length;
 const activeLanguages=new Set(state.sessions.map(s=>s.language)).size;
 return [
  {name:'Mầm đầu tiên',description:'Có mặt trong một buổi học.',done:state.sessions.length>0,symbol:'🌱'},
  {name:'Một câu dùng được',description:'Hoàn thành một bài giao tiếp.',done:state.completions.length>0,symbol:'💬'},
  {name:'Túi từ nhỏ',description:'Gặp 15 từ trong trò ghép cặp.',done:learned>=15,symbol:'🎒'},
  {name:'Gặp lại bạn cũ',description:'Có mặt trong 5 lượt ôn.',done:reviews>=5,symbol:'🍃'},
  {name:'Năm lần quay lại',description:'Học trong 5 ngày, không cần liền nhau.',done:days>=5,symbol:'🌤️'},
  {name:'Thử một ngôn ngữ mới',description:'Có buổi học ở hai ngôn ngữ.',done:activeLanguages>=2,symbol:'🧭'},
 ];
}
