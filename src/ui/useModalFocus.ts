import {useEffect,type RefObject} from 'react';

const modalStack:HTMLElement[]=[];
const selector='button, a[href], input, select, textarea, [tabindex], [contenteditable="true"]';

/** Keep keyboard focus inside the active custom modal and return it on close. */
export function useModalFocus(ref:RefObject<HTMLElement|null>,active=true){
  useEffect(()=>{
    const modal=ref.current;if(!active||!modal)return;
    const previous=document.activeElement;
    modalStack.push(modal);
    const isTop=()=>modalStack.at(-1)===modal;
    const controls=()=>Array.from(modal.querySelectorAll<HTMLElement>(selector)).filter(element=>element.tabIndex>=0&&!element.matches(':disabled')&&!element.closest('[inert]')&&element.getClientRects().length>0&&getComputedStyle(element).visibility!=='hidden');
    const focusFirst=()=>{(controls()[0]??modal).focus({preventScroll:true});};
    const onFocus=(event:FocusEvent)=>{if(isTop()&&!modal.contains(event.target as Node))focusFirst();};
    const onKey=(event:KeyboardEvent)=>{
      if(!isTop()||event.key!=='Tab')return;
      const items=controls(),first=items[0],last=items.at(-1);
      if(!first){event.preventDefault();modal.focus();return;}
      if(event.shiftKey&&(document.activeElement===first||document.activeElement===modal)){event.preventDefault();last!.focus();}
      else if(!event.shiftKey&&(document.activeElement===last||!modal.contains(document.activeElement))){event.preventDefault();first.focus();}
    };
    document.addEventListener('focusin',onFocus);document.addEventListener('keydown',onKey);
    focusFirst();
    return()=>{
      document.removeEventListener('focusin',onFocus);document.removeEventListener('keydown',onKey);
      const index=modalStack.lastIndexOf(modal);if(index>=0)modalStack.splice(index,1);
      if(previous instanceof HTMLElement&&previous.isConnected&&!previous.closest('[inert]'))previous.focus({preventScroll:true});
    };
  },[ref,active]);
}
