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
KQL.compose.load({v:3,objs:Array.from({length:23},(_,i)=>({id:'full'+i,type:'sticker',text:'x',mode:'square',fs:3}))});button('+ текст').click();check(KQL.compose.decor().objs.length===23&&!KQL.compose.decor().canvas,'conversion at capacity never truncates existing objects');
KQL.compose.reset();KQL.compose.addSticker('first','first');KQL.compose.addSticker('second','second');let order=KQL.compose.decor().objs;check(order[order.length-1].z>Math.max(...order.slice(0,-1).map(o=>o.z)),'new objects appear above existing layers');
// Published geometry: editor workspace must not become publication whitespace.
function publication(decor,content){const h=document.createElement('div');h.style.width='600px';document.body.appendChild(h);const before=JSON.stringify(decor);KQL.render(h,KQL.fromPost({title:'short',content:content||'one line',decor}));return {host:h,card:h.querySelector('.kql-card'),before,decor};}
const basic={v:3,canvas:true,height:70,objs:[{id:'t',type:'text',role:'title',mode:'front',x:3,y:3,w:94},{id:'b',type:'text',role:'body',mode:'front',x:3,y:12,w:94}]};
let short=publication(basic);await tick();check(short.card.offsetHeight<180,'short legacy-default canvas shrinks to content');check(JSON.stringify(basic)===short.before,'render does not rewrite stored decor');
const marker=document.createElement('div');marker.textContent='reactions and comments';short.host.after(marker);check(marker.getBoundingClientRect().top-short.card.getBoundingClientRect().bottom<2,'following reactions start directly after visual content');
let long=publication(basic,Array(90).fill('a line of longer text').join('\n'));await tick();check(long.card.offsetHeight>short.card.offsetHeight+400,'long text expands publication');
let ascii=publication({v:3,canvas:true,height:70,objs:[{id:'rabbit',type:'sticker',text:' /\\_/\\\n( o.o )\n > ^ <',mode:'front',x:3,y:8,fs:3,w:30}]});await tick();check(ascii.card.offsetHeight<160,'one ASCII object has no workspace-sized blank area');
let multi=publication({v:3,canvas:true,height:70,objs:[{id:'high',type:'plate',text:'high',mode:'front',x:3,y:10,w:30},{id:'low',type:'plate',text:'low',mode:'behind',x:35,y:130,w:30}]});await tick();let low=multi.host.querySelector('[data-id=low]').getBoundingClientRect();check(multi.card.getBoundingClientRect().bottom>=low.bottom+10,'lowest object on either layer is not cut off');
let fixed=publication({...basic,heightMode:'fixed',height:100});await tick();check(fixed.card.offsetHeight>=600,'explicit large minimum height is retained');
let oldFixed=publication({...basic,height:110});await tick();check(oldFixed.card.offsetHeight>=660,'non-default legacy height remains preserved');
let oldFlow=publication({v:3,objs:[{id:'below',type:'plate',text:'below',mode:'front',x:3,y:150,w:30}]});await tick();check(oldFlow.host.querySelector('[data-id=below]').getBoundingClientRect().top-oldFlow.card.getBoundingClientRect().top>=899,'old flow/free object keeps its original lower position');
KQL.compose.reset();KQL.compose.addSticker('advanced','test');check(!document.querySelector('.kql-advanced').open,'advanced settings closed by default');check(document.querySelector('.kql-tools-sel > button').getClientRects().length,'basic resize/delete controls remain visible');
document.querySelector('.kql-advanced').open=true;change(document.querySelector('input[aria-label="X"]'),12);check(document.querySelector('.kql-advanced').open,'advanced panel stays open while changing coordinates');
change(document.querySelector('select[aria-label="Режим высоты"]')||document.querySelector('.kql-document-options select:last-of-type'),'fixed');
const heightInput=document.querySelector('input[aria-label="Минимальная высота в процентах ширины"]');if(heightInput)change(heightInput,100);
let round=KQL.compose.decor();KQL.compose.reset();KQL.compose.load(round);check(KQL.compose.decor().heightMode===round.heightMode && KQL.compose.decor().objs[2].x===12,'height mode and coordinates survive re-edit');
let flowCSS=document.createElement('link');flowCSS.rel='stylesheet';flowCSS.href='notes-flow.css';document.head.appendChild(flowCSS);await new Promise(r=>flowCSS.onload=r);
let legacyArticle=document.createElement('article');legacyArticle.className='post has-board';legacyArticle.style.width='600px';legacyArticle.innerHTML='<div class="kq-canvas"><h2 class="post-title">old title</h2><div class="post-content">old text</div></div>';document.body.appendChild(legacyArticle);
let legacyHost=legacyArticle.firstChild;kqMountDecor(legacyHost,{board:{},stickers:[]});await tick();check(legacyHost.offsetHeight<200,'pre-v3 flow no longer inherits fixed 380px board height');
kqMountDecor(legacyHost,{board:{},stickers:[{text:'old lower sticker',wrap:'front',x:8,y:180,w:30}]});await tick();check(legacyHost.getBoundingClientRect().bottom>=legacyHost.querySelector('.kq-obj').getBoundingClientRect().bottom,'pre-v3 lower decoration stays inside publication height');
}catch(error){results.push({error:error.message,stack:error.stack});}
document.getElementById('test-results').textContent=JSON.stringify(results);
})();
