(async function(){
const results=[]; function check(ok,name){results.push({name,ok:!!ok});if(!ok)throw Error(name);}
const tick=()=>new Promise(r=>setTimeout(r,40));
const box=()=>document.querySelector('#compose-overlay .compose-preview-box');
const obj=id=>box().querySelector('[data-id="'+id+'"]');
const button=t=>[...document.querySelectorAll('.kql-tools button,.kql-tools-sel button')].find(b=>b.textContent===t);
const change=(e,v)=>{e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}));};
function pointer(e,type,x,y){e.dispatchEvent(new PointerEvent(type,{bubbles:true,clientX:x,clientY:y,pointerType:'mouse',button:0}));}
try{
window.openNotesCompose(); await tick();
check(KQL.compose.decor().canvas,'new Notes uses canvas');
check(box().querySelectorAll('.kql-o.text').length===2,'title and body are independent objects');
document.getElementById('compose-title').value='Test';document.getElementById('compose-content').value='Body';KQL.compose.refresh();
window.kqAddSticker('rabbit','(rabbit)');await tick();let sticker=KQL.compose._objs().find(o=>o.type==='sticker'), id=sticker.id;
check(box().querySelectorAll('.kql-o.sticker').length===1,'one catalog add produces one sticker');
window.kqPaintStickersOnBoard();window.kqSyncBoard();window.kqUpdateBoardText();await tick();
check(box().querySelectorAll('.kql-o.sticker').length===1 && !box().querySelector('.kq-sticker-node'),'legacy repaint cannot append duplicate');
let n=obj(id), r=n.getBoundingClientRect(),unit=box().querySelector('.kql-card').clientWidth/100, oldX=sticker.x;
pointer(n,'pointerdown',r.x+5,r.y+5);pointer(window,'pointermove',r.x+5-10*unit,r.y+5+20*unit);pointer(window,'pointerup',r.x,r.y);await tick();
check(Math.abs(KQL.compose._objs().find(o=>o.id===id).x-(oldX-10))<.2,'drag updates persistent model');
check(KQL.compose._objs().filter(o=>o.type==='text').every(o=>o.x===3),'drag does not move other objects');
change(document.querySelector('input[aria-label="X"]'),23);change(document.querySelector('input[aria-label="Y"]'),110);await tick();
check(sticker.x===23 && sticker.y===110,'exact coordinates update model');
check(box().querySelector('.kql-card').clientHeight/unit>110,'canvas grows below text');
let width=sticker.w,fs=sticker.fs;n=obj(id);r=n.getBoundingClientRect();pointer(n.querySelector('.kql-resize'),'pointerdown',r.right,r.bottom);pointer(window,'pointermove',r.right+5*unit,r.bottom);pointer(window,'pointerup',r.right,r.bottom);await tick();
check(sticker.w>width && sticker.fs>fs,'resize handle changes persistent sticker size');
button('на задний план').click();check(sticker.mode==='behind','back layer persists');button('на передний план').click();check(sticker.mode==='front','front layer persists');
button('заблокировать').click();let lockedX=sticker.x;n=obj(id);r=n.getBoundingClientRect();pointer(n,'pointerdown',r.x+2,r.y+2);pointer(window,'pointermove',r.x+40,r.y+40);pointer(window,'pointerup',r.x,r.y);
check(sticker.x===lockedX && document.querySelector('input[aria-label="X"]').disabled,'locked object cannot move or change coordinates');
let d=JSON.parse(JSON.stringify(KQL.compose.decor()));KQL.compose.reset();KQL.compose.load(d);await tick();
check(JSON.stringify(KQL.compose.decor())===JSON.stringify(d),'JSON save/reopen preserves layout, size, lock and layer');
const feed=document.createElement('div');feed.style.width='360px';document.body.appendChild(feed);KQL.render(feed,KQL.fromPost({title:'Test',content:'Body',decor:d}));await tick();
check(feed.querySelectorAll('.kql-o.sticker').length===1,'published renderer has one sticker');
check(Math.abs((feed.querySelector('[data-id="'+id+'"]').getBoundingClientRect().left-feed.getBoundingClientRect().left)/3.6-23)<.3,'published mobile width keeps coordinates');
button('+ текст').click();check(KQL.compose._objs().filter(o=>o.type==='text').length===3,'additional text block');
change(document.querySelector('textarea[aria-label="Текст объекта"]'),'independent');change(document.querySelector('input[aria-label="Размер текста"]'),25);button('жирный').click();
check(KQL.compose.decor().objs.some(o=>o.text==='independent'&&o.size===25&&o.bold),'independent text formatting survives serialization');
window.__testMode='error';await document.getElementById('compose-publish').onclick();
check(document.getElementById('compose-overlay').classList.contains('open'),'failed full save keeps editor open');
check(document.getElementById('compose-error').textContent.includes('черновик'),'failure keeps local draft');
check(window.__writes.length===1 && window.__writes[0].decor.v===3,'no fallback write without decor');
KQL.compose.reset();await document.getElementById('compose-restore-draft').onclick();check(KQL.compose.decor().objs.some(o=>o.text==='independent'),'draft restore recovers composition');
window.__testMode='throw';await document.getElementById('compose-publish').onclick();check(!document.getElementById('compose-publish').disabled,'network rejection releases publish button');
window.__testMode='ok';await document.getElementById('compose-publish').onclick();check(!document.getElementById('compose-overlay').classList.contains('open')&&window.__loaded===1,'successful server receipt closes and reloads feed');
window.openNotesCompose({id:12,title:'Edit',content:'body',decor:d});window.__testMode='empty';await document.getElementById('compose-publish').onclick();check(document.getElementById('compose-overlay').classList.contains('open'),'empty update receipt is failure');
const legacy={v:3,objs:[{id:'old',type:'sticker',text:'old',mode:'square',anchor:0,side:'right',fs:3,w:30}]};KQL.compose.load(legacy);check(!KQL.compose.decor().canvas&&KQL.compose.decor().objs.length===1,'old v3 layout remains flow until explicit conversion');
button('свободный холст').click();check(KQL.compose.decor().canvas && KQL.compose.decor().objs.some(o=>o.id==='old'),'explicit conversion retains old object');
window.kqOpenStickerTray=window.__realTray;window.kqLoadCatalog=async()=>[{id:'x',kind:'ascii',text:'<img src=x onerror="window.__injected=1">'}];await window.kqOpenStickerTray();check(!document.querySelector('#kq-sticker-pop img')&&!window.__injected,'catalog renders literal text safely');
document.querySelector('#kq-sticker-pop .kq-sticker-pick').click();check(KQL.compose._objs().filter(o=>o.sid==='x').length===1,'actual catalog delegated click adds exactly once');
button('каталог').click();check(document.getElementById('kq-sticker-pop').style.display==='none','catalog collapses');
}catch(error){results.push({error:error.message,stack:error.stack});}
document.getElementById('test-results').textContent=JSON.stringify(results);
})();
