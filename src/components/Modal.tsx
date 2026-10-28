import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
export function Modal({title,children,onClose}:{title:string;children:React.ReactNode;onClose:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{ref.current?.showModal();},[]);
  return <dialog ref={ref} className="modal" aria-label={title} onCancel={onClose} onClick={e=>{if(e.target===ref.current)onClose();}}>
    <div className="modal-head"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19}/></button></div>
    {children}
  </dialog>;
}
