import React, {useId, useLayoutEffect, useRef} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
import './modal-viewport.css';

interface ModalProps {isOpen:boolean; onClose:()=>void; title:string; children:React.ReactNode; subtitle?:string; className?:string; id?:string; maxWidth?:number}
const stack: HTMLElement[] = [];
let unlock: (()=>void) | undefined;

export const Modal: React.FC<ModalProps> = ({isOpen,onClose,title,children,subtitle,className='',id,maxWidth}) => {
  const heading = useId();
  const panel = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useLayoutEffect(() => {
    const node: HTMLDivElement | null = panel.current, overlay: HTMLDivElement | null = backdrop.current;
    if (!isOpen || !node || !overlay) return;
    const previous = document.activeElement;
    if (!stack.length) {
      const body = document.body, root = document.documentElement;
      const saved = [body.style.overflow, root.style.overflow, root.style.overscrollBehavior];
      body.style.overflow = root.style.overflow = 'hidden';
      root.style.overscrollBehavior = 'none';
      unlock = () => { [body.style.overflow, root.style.overflow, root.style.overscrollBehavior] = saved; };
    }
    stack.push(node);
    const viewport = window.visualViewport;
    let frame = 0;
    const sync = () => {
      overlay.style.setProperty('--dialog-vh', `${viewport?.height ?? window.innerHeight}px`);
      overlay.style.setProperty('--dialog-top', `${viewport?.offsetTop ?? 0}px`);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(sync); };
    sync();
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    node.focus({preventScroll:true});
    const key = (event: KeyboardEvent) => {
      if (stack.at(-1) !== node) return;
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const items = Array.from(node.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],[tabindex]'))
        .filter(el => el.tabIndex >= 0 && !el.matches(':disabled') && el.getClientRects().length && getComputedStyle(el).visibility === 'visible');
      const first = items[0], last = items.at(-1), active = document.activeElement;
      if (!first || (event.shiftKey && (active === first || active === node || !node.contains(active))) ||
          (!event.shiftKey && (active === last || !node.contains(active)))) {
        event.preventDefault();
        (event.shiftKey ? last ?? node : first ?? node).focus({preventScroll:true});
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      const wasTop = stack.at(-1) === node;
      stack.splice(stack.indexOf(node), 1);
      cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('keydown', key);
      if (!stack.length) { unlock?.(); unlock = undefined; }
      if (wasTop) {
        const remaining = stack.at(-1);
        if (previous instanceof HTMLElement && previous.isConnected && (!remaining || remaining.contains(previous))) previous.focus({preventScroll:true});
        else remaining?.focus({preventScroll:true});
      }
    };
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;
  return createPortal(<div ref={backdrop} className="inex-modal-backdrop inex-viewport-modal">
    <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={heading} id={id} className={`inex-dialog ${className}`} style={maxWidth?{maxWidth}:undefined}>
      <div className="inex-sheet-handle" aria-hidden="true"/>
      <header className="inex-dialog-heading"><div><h3 id={heading}>{title}</h3>{subtitle&&<p className="inex-dialog-subtitle">{subtitle}</p>}</div><button type="button" onClick={onClose} aria-label="Fechar janela"><X size={18}/></button></header>
      <div className="inex-dialog-content">{children}</div>
    </div>
  </div>,document.body);
};
