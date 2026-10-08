'use client';
import {useRef,useState} from 'react';
import {Download,Upload,Check,Database,GitBranch} from 'lucide-react';
import {backupSchema,makeBackup,backupChunks,backupSummary,backupFilename,type Backup} from '@/lib/backup';
import type {StudyState} from '@/lib/learning';
import {release} from '@/lib/release';

export default function BackupSettings({state,busy,mutate}:{state:StudyState;busy:boolean;mutate:(payload:Record<string,unknown>)=>Promise<StudyState|null>}){
  const [pending,setPending]=useState<Backup|null>(null),[message,setMessage]=useState(''),[transferring,setTransferring]=useState(false),[completed,setCompleted]=useState(0);
  const input=useRef<HTMLInputElement>(null),lock=useRef(false);
  const summary=pending?backupSummary(pending):null;
  function download(){
    const url=URL.createObjectURL(new Blob([JSON.stringify(makeBackup(state),null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=backupFilename();link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    setMessage('Đã tạo file sao lưu. Giữ file cho riêng bạn vì có lịch sử học cá nhân.');
  }
  async function choose(file?:File){
    setPending(null);setMessage('');if(!file)return;
    if(file.size>10*1024*1024){setMessage('File lớn hơn 10 MB. Hãy chọn một bản sao lưu Mầm nhỏ hơn.');return;}
    try{
      const raw=JSON.parse(await file.text());
      if(raw?.formatVersion!==1){setMessage('Chưa hỗ trợ phiên bản file này. Hãy dùng bản Mầm mới hơn hoặc chọn file sao lưu định dạng 1.');return;}
      const result=backupSchema.safeParse(raw);
      if(!result.success){setMessage('File chưa đúng định dạng sao lưu Mầm hoặc có nội dung bài học không được hỗ trợ.');return;}
      if(result.data.ownerId!==state.accountId){setMessage('File thuộc tài khoản khác. Đăng nhập đúng người học trước khi nhập.');return;}
      setPending(result.data);
    }catch{setMessage('Chưa đọc được file. Hãy chọn file JSON đã xuất từ Mầm.');}
  }
  async function restore(){
    if(!pending||busy||lock.current)return;lock.current=true;setTransferring(true);setCompleted(0);setMessage('');
    const chunks=backupChunks(pending);
    try{
      for(let i=0;i<chunks.length;i++){
        if(!await mutate({action:'import',backup:chunks[i]})){setMessage('Đã dừng nhập. Những phần đã nhập vẫn được giữ; bạn có thể nhập lại cùng file để tiếp tục.');return;}
        setCompleted(i+1);
      }
      setPending(null);setMessage('Đã nhập bổ sung dữ liệu. Tiến bộ có sẵn và lịch ôn hiện tại được giữ.');
    }finally{lock.current=false;setTransferring(false);}
  }
  return <>
    <section className="account-card backup-card"><Database size={29}/><h2>Dữ liệu học đi cùng bạn</h2><p>Tiến bộ được lưu theo tài khoản. Bạn cũng có thể giữ một file sao lưu cho riêng mình.</p><div className="backup-actions"><button className="secondary" disabled={busy||transferring} onClick={download}><Download size={18}/>Tải bản sao lưu</button><button className="secondary" disabled={busy||transferring} onClick={()=>input.current?.click()}><Upload size={18}/>Chọn file để nhập</button><input ref={input} type="file" accept=".json,application/json" hidden onChange={e=>{void choose(e.target.files?.[0]);e.target.value='';}}/></div>
    {pending&&summary&&<div className="backup-preview"><h3>Nhập bổ sung vào tài khoản này?</h3><p>{summary.sessions} lượt học · {summary.lessons} bài · {summary.cards} câu ôn · {summary.words} từ</p><p>Chỉ thêm mục còn thiếu. Không thay thế mục tiêu, tiến bộ hoặc lịch ôn đang có. Nhập lại cùng file không nhân đôi dữ liệu.</p><div className="backup-actions"><button className="primary ink" disabled={busy||transferring} onClick={()=>void restore()}><Check size={18}/>{transferring?`Đang nhập ${completed}/${backupChunks(pending).length} phần…`:'Nhập bổ sung'}</button><button className="text-button" disabled={transferring} onClick={()=>setPending(null)}>Hủy</button></div></div>}
    {message&&<p role="status" className="backup-status">{message}</p>}</section>
    <section className="version-card"><GitBranch size={22}/><div><h2>Mầm {release.version}</h2><p>Đường dẫn và nơi lưu dữ liệu của v4 được giữ qua các lần nâng cấp.</p><a href={release.repository} target="_blank" rel="noreferrer">Theo dõi mã nguồn và lịch sử trên GitHub</a></div></section>
  </>;
}
