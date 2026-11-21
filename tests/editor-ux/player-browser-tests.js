(async()=>{
const tick=()=>new Promise(r=>setTimeout(r,70));let results=JSON.parse(sessionStorage.getItem('fixture-results')||'[]');
function check(ok,name){results.push({name,ok:!!ok});if(!ok)throw Error(name);}
function pointer(el,type,x,y,pointerType='mouse',id=1){el.dispatchEvent(new PointerEvent(type,{bubbles:true,clientX:x,clientY:y,pointerId:id,pointerType,button:0}));}
try{
await tick();const host=document.getElementById('kq-player'),handle=document.getElementById('kq-p-drag'),frame=document.getElementById('kq-frame');
if(!sessionStorage.getItem('fixture-phase')){
 check(!!handle&&getComputedStyle(handle).touchAction==='none','dedicated handle supports touch gestures');
 let h=handle.getBoundingClientRect(),p=document.getElementById('kq-p-play').getBoundingClientRect();check(h.right<=p.left||h.left>=p.right||h.bottom<=p.top||h.top>=p.bottom,'vinyl handle does not overlap Play/Pause');
 let r=host.getBoundingClientRect();pointer(handle,'pointerdown',h.x+4,h.y+4);pointer(handle,'pointermove',h.x+64,h.y+34);pointer(handle,'pointerup',h.x+64,h.y+34);await tick();
 let moved=host.getBoundingClientRect();check(Math.abs(moved.x-r.x)>20,'mouse drag changes player position');check(window.__plays===0,'mouse drag does not play audio');
 h=handle.getBoundingClientRect();pointer(handle,'pointerdown',h.x+4,h.y+4,'touch',2);pointer(handle,'pointermove',h.x-30,h.y-20,'touch',2);pointer(handle,'pointercancel',h.x-30,h.y-20,'touch',2);check(!host.classList.contains('kq-dragging'),'cancelled touch drag cleans up');
 h=handle.getBoundingClientRect();pointer(handle,'pointerdown',h.x+4,h.y+4,'touch',3);pointer(handle,'pointermove',-5000,5000,'touch',3);pointer(handle,'pointerup',-5000,5000,'touch',3);r=host.getBoundingClientRect();check(r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,'drag clamps entire vinyl host to viewport');check(window.__plays===0,'touch drag does not play audio');
 let saved=JSON.parse(localStorage.getItem('kq-player-pos'));check(Number.isFinite(saved.x)&&Number.isFinite(saved.y),'position persisted as finite coordinates');
 sessionStorage.setItem('fixture-position',JSON.stringify(saved));sessionStorage.setItem('fixture-results',JSON.stringify(results));sessionStorage.setItem('fixture-phase','reload');location.reload();return;
}
 const saved=JSON.parse(sessionStorage.getItem('fixture-position')),restored=host.getBoundingClientRect();results.push({restoreDebug:{saved,x:restored.x,y:restored.y,style:host.getAttribute('style'),docked:host.className,width:innerWidth,height:innerHeight}});check(Math.abs(restored.x-saved.x)<2&&Math.abs(restored.y-saved.y)<2,'position restored after real page reload');
 const audio=document.getElementById('kq-p-audio');frame.contentDocument.getElementById('modal').classList.add('open');await tick();check(host.classList.contains('kq-docked'),'iframe editor docks player to separate strip');check(frame.getBoundingClientRect().bottom<=host.getBoundingClientRect().top,'docked player does not cover iframe modal');
 check(document.getElementById('kq-p-play').getClientRects().length && document.getElementById('kq-p-lib').getClientRects().length,'music controls stay available while editor open');
 frame.contentDocument.getElementById('modal').classList.remove('open');await tick();check(!host.classList.contains('kq-docked')&&audio===document.getElementById('kq-p-audio'),'closing editor restores vinyl without replacing audio');
 frame.contentWindow.focus();frame.contentDocument.getElementById('comment').focus();await tick();if(!frame.contentDocument.hasFocus()){window.__needsTrustedFocus=true;for(let i=0;i<60&&!host.classList.contains('kq-docked');i++)await tick();}check(host.classList.contains('kq-docked'),'comment input reserves space for player');frame.contentDocument.getElementById('comment').blur();await tick();
 frame.src='frame-fixture.html?next=1';await new Promise(r=>frame.addEventListener('load',r,{once:true}));await tick();check(audio===document.getElementById('kq-p-audio'),'iframe navigation preserves audio element');
 document.getElementById('kq-p-lib').click();await tick();document.getElementById('kq-p-reset').click();await tick();check(!localStorage.getItem('kq-player-pos'),'reset removes saved position');check(host.getBoundingClientRect().left>=0 && host.getBoundingClientRect().bottom<=innerHeight,'reset returns visible default position');
 document.getElementById('kq-lib-x').click();document.getElementById('kq-p-play').click();await tick();check(window.__plays===1,'Play remains a separate working action');
}catch(e){results.push({error:e.message,stack:e.stack});}
sessionStorage.removeItem('fixture-results');sessionStorage.removeItem('fixture-phase');document.getElementById('test-results').textContent=JSON.stringify(results);
})();
