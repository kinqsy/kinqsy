(async()=>{
const pause=ms=>new Promise(r=>setTimeout(r,ms||80));let results=JSON.parse(sessionStorage.getItem('draft-test-results')||'[]');
function check(ok,name){results.push({name,ok:!!ok});if(!ok)throw Error(name);}
const field=id=>document.getElementById('compose-'+id),change=(id,v)=>{field(id).value=v;field(id).dispatchEvent(new Event('input',{bubbles:true}));field(id).dispatchEvent(new Event('change',{bubbles:true}));};
const list=(kind='manual',section=KQDraftAdapter.section,owner=window.__uid)=>KQDraftStore.list(owner,section,kind);
const open=async()=>{KQDraftAdapter.open();await pause(160);};
const click=(root,label)=>{const b=[...root.querySelectorAll('button')].find(b=>b.textContent===label);if(!b)throw Error('missing button '+label);b.click();};
async function show(){await KQDrafts.showList();await pause();return document.getElementById('kqd-dialog');}
async function resumeTitle(title){let dialog=await show(),row=[...dialog.querySelectorAll('.kqd-row')].find(r=>r.querySelector('h3').textContent===title);if(!row)throw Error('missing draft '+title);click(row,'Продолжить');await pause(180);}
function checkpoint(phase,url){sessionStorage.setItem('draft-test-results',JSON.stringify(results));sessionStorage.setItem('draft-test-phase',phase);location.href=url;}
try{
await pause(180);window.kqOpenStickerTray=async()=>{};
const phase=sessionStorage.getItem('draft-test-phase')||'notes-first';
if(phase==='notes-first'){
 await open();let top=document.querySelector('.kqd-content'),bottom=document.querySelector('.kqd-appearance'),canvas=document.querySelector('#compose-overlay .compose-preview-box');
 check(canvas.previousElementSibling===top&&canvas.nextElementSibling===bottom,'content and appearance panels surround canvas');
 check(top.contains(field('title'))&&top.contains(field('media-url'))&&top.querySelector('.kql-tools-sel'),'content panel contains fields and existing object controls');
 check(['title-size','body-size','title-font','body-font','title-color','body-color','post-bg'].every(id=>bottom.contains(field(id))),'appearance panel contains all seven style fields');
 change('title','Первый черновик');change('content','Полная композиция сохраняется локально.');change('title-size',42);change('body-size',20);change('title-color','#884466');change('post-bg','lilac');
 KQL.compose.addSticker('rabbit',' /\\_/\\\n( o.o )\n > ^ <');let decor=KQL.compose.decor();decor.objs.push({id:'image',type:'image',src:location.origin+'/sample.svg',ar:1.5,mode:'behind',x:7,y:60,w:35,pad:2,locked:true,z:3});decor.objs[2].x=45;decor.objs[2].y=33;decor.objs[2].rot=15;decor.objs[2].fx=-1;decor.objs[2].z=8;KQL.compose.load(decor);await pause();
 let before=JSON.stringify(KQDrafts.read());top.open=false;bottom.open=true;bottom.open=false;check(canvas.getClientRects().length&&JSON.stringify(KQDrafts.read())===before,'collapsing both panels leaves canvas visible and preserves all settings');top.open=true;
 let node=canvas.querySelector('[data-id="'+decor.objs[2].id+'"]'),r=node.getBoundingClientRect(),u=canvas.querySelector('.kql-card').clientWidth/100;
 node.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:r.x+2,clientY:r.y+2,pointerType:'mouse',button:0}));window.dispatchEvent(new PointerEvent('pointermove',{clientX:r.x+2+5*u,clientY:r.y+2+8*u,pointerType:'mouse'}));window.dispatchEvent(new PointerEvent('pointerup',{pointerType:'mouse'}));await pause();
 check(Math.abs(KQL.compose.decor().objs[2].x-50)<.2,'original object dragging remains unchanged');
 let current=canvas.querySelector('[data-id="'+decor.objs[2].id+'"]'),rect=current.getBoundingClientRect(),oldSize=KQL.compose.decor().objs[2].fs;
 current.querySelector('.kql-resize').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:rect.right,clientY:rect.bottom,pointerType:'mouse',button:0}));window.dispatchEvent(new PointerEvent('pointermove',{clientX:rect.right+4*u,clientY:rect.bottom,pointerType:'mouse'}));window.dispatchEvent(new PointerEvent('pointerup',{pointerType:'mouse'}));await pause();check(KQL.compose.decor().objs[2].fs>oldSize,'resize handle still works after panel reorganization');
 await KQDrafts.save();let saved=await list();check(saved.length===1&&saved[0].owner==='owner-a'&&saved[0].section==='notes'&&saved[0].id&&saved[0].createdAt&&saved[0].updatedAt,'manual draft includes scoped ID and timestamps');
 check(JSON.stringify(saved[0].payload)===JSON.stringify(KQDrafts.read()),'manual draft retains complete composition and appearance');
 const first=saved[0];change('content','Обновлённый основной текст');await KQDrafts.save();saved=await list();check(saved.length===1&&saved[0].id===first.id&&saved[0].revision===2&&saved[0].createdAt===first.createdAt,'repeat save updates same draft without duplication');
 check(document.querySelector('.kqd-status strong').textContent==='Сохранено','saved status follows completed local write');
 change('content','Аварийная версия отдельно');await pause(1050);let recovery=await list('recovery');check(recovery.some(d=>d.payload.content==='Аварийная версия отдельно')&&(await list())[0].payload.content==='Обновлённый основной текст','autosave creates separate recovery without changing manual draft');
 check(sessionStorage.getItem('kinqsy:notes:draft:owner-a:new').includes('legacy text')&&recovery.some(d=>d.legacy),'legacy session draft remains and is imported despite corrupt neighbour');
 await open();change('title','Второй черновик');change('content','Вторая запись');await KQDrafts.save();check((await list()).length===2,'multiple Notes drafts coexist');
 checkpoint('notes-reloaded','notes.html');return;
}
if(phase==='notes-reloaded'){
 check((await list()).length===2,'manual drafts survive real page reload');await resumeTitle('Первый черновик');
 check(field('content').value==='Обновлённый основной текст'&&field('title-color').value==='#884466'&&field('post-bg').value==='lilac'&&KQL.compose.decor().objs.some(o=>o.id==='image'&&o.locked),'manual restore recovers saved fields, images, lock and appearance');
 let dialog=await show();check(dialog.textContent.includes('Аварийная версия')||dialog.textContent.includes('Аварийное восстановление'),'different recovery versions are offered separately');click(dialog,'Закрыть');
 dialog=await show();let emergency=[...dialog.querySelectorAll('.kqd-row')].find(r=>r.querySelector('h3').textContent==='Первый черновик'&&r.querySelector('.kqd-badge').textContent.includes('Восстановление'));click(emergency,'Продолжить');await pause(180);check(field('content').value==='Аварийная версия отдельно'&&(await list()).find(d=>d.payload.title==='Первый черновик').payload.content==='Обновлённый основной текст','user can restore emergency version without overwriting manual version');
 window.__switchUser('owner-b');await pause();check(!document.getElementById('compose-overlay').classList.contains('open')&&!field('title').value,'account switch closes and clears previous account editor');
 dialog=await show();check(!dialog.textContent.includes('Первый черновик')&&(await list()).length===0,'another account does not see previous drafts');click(dialog,'Закрыть');
 await open();change('title','Другой аккаунт');await KQDrafts.save();check((await list()).length===1,'second account saves its own local draft');
 window.__switchUser('owner-a');await pause();await resumeTitle('Первый черновик');
 let manual=(await list()).find(d=>d.payload.title==='Первый черновик');let newer={...manual,payload:{...manual.payload,content:'Новее в другой вкладке'}};
 await KQDraftStore.save('manual',newer,manual.revision);change('content','Старая вкладка');await KQDrafts.save();
 check(document.getElementById('kqd-dialog').textContent.includes('Старая вкладка её не перезаписала')&&(await list()).find(d=>d.id===manual.id).payload.content==='Новее в другой вкладке','stale manual save is rejected with explicit version choice');
 click(document.getElementById('kqd-dialog'),'Сохранить мою версию отдельно');await pause(160);check((await list()).length===3,'conflicting editor version can be saved separately');
 let actual=await list(),cas=actual.find(d=>d.id===manual.id);let attempts=await Promise.allSettled([KQDraftStore.save('manual',{...cas,payload:{...cas.payload,content:'race one'}},cas.revision),KQDraftStore.save('manual',{...cas,payload:{...cas.payload,content:'race two'}},cas.revision)]);
 check(attempts.filter(r=>r.status==='fulfilled').length===1&&attempts.filter(r=>r.reason&&r.reason.name==='DraftConflict').length===1,'IndexedDB atomically rejects one concurrent stale revision');
 const realSave=KQDraftStore.save;change('content','Сохранение ещё выполняется');let release;KQDraftStore.save=(...args)=>new Promise((resolve,reject)=>{release=()=>realSave(...args).then(resolve,reject);});let pending=KQDrafts.save();await pause();check(document.querySelector('.kqd-status strong').textContent!=='Сохранено','UI does not claim saved before transaction completes');release();await pending;KQDraftStore.save=realSave;
 KQDraftStore.save=async()=>{throw Error('quota unavailable');};await KQDrafts.save();check(document.querySelector('.kqd-status strong').textContent==='Ошибка сохранения','storage failure never reports saved');change('content','Не потерять при закрытии');await document.getElementById('compose-close').onclick();check(document.getElementById('compose-overlay').classList.contains('open')&&field('content').value==='Не потерять при закрытии','storage failure prevents closing and losing unsaved composition');KQDraftStore.save=realSave;
 dialog=await show();let second=[...dialog.querySelectorAll('.kqd-row')].find(r=>r.querySelector('h3').textContent==='Второй черновик');click(second,'Удалить');check((await list()).length===3&&second.querySelector('.kqd-confirm'),'delete asks in-page confirmation before changing storage');click(second.querySelector('.kqd-confirm'),'Отмена');check((await list()).length===3,'delete cancellation keeps draft');click(second,'Удалить');click(second.querySelector('.kqd-confirm'),'Да, удалить');await pause(140);check((await list()).length===2,'confirmed deletion removes only selected version');
 await resumeTitle('Первый черновик');window.__mode='error';let count=(await list()).length;await document.getElementById('compose-publish').onclick();check((await list()).length===count&&document.getElementById('compose-overlay').classList.contains('open'),'rejected publication keeps manual draft and editor');
 window.__mode='ok';await document.getElementById('compose-publish').onclick();check((await list()).length===count-1&&!document.getElementById('compose-overlay').classList.contains('open'),'confirmed normal publication removes its manual draft');
 check(sessionStorage.getItem('kinqsy:notes:draft:owner-a:new')!==null,'publishing does not delete legacy source during compatible migration');
 checkpoint('dreams','dreams.html');return;
}
if(phase==='dreams'){
 check((await list()).length===0,'Dreams list excludes all Notes drafts');await open();change('title','Сон — отдельный черновик');change('content','Dreams body');change('post-bg','cream');
 let add=[...document.querySelectorAll('.kql-tools button')].find(b=>b.textContent==='+ текст');add.click();await pause();let d=KQL.compose.decor();d.objs[d.objs.length-1].text='Отдельный текст во сне';d.objs[d.objs.length-1].y=90;KQL.compose.load(d);await KQDrafts.save();
 let saved=await list();check(saved.length===1&&saved[0].section==='dreams'&&saved[0].payload.post_bg==='cream','Dreams drafts include appearance and own section');
 checkpoint('dreams-reloaded','dreams.html');return;
}
 if(phase==='dreams-reloaded'){
 await resumeTitle('Сон — отдельный черновик');check(field('content').value==='Dreams body'&&KQL.compose.decor().objs.some(o=>o.y===90),'Dreams restores full composition after real reload');
 const oldCount=(await list('manual','notes')).length;await document.getElementById('compose-publish').onclick();check((await list()).length===0&&(await list('manual','notes')).length===oldCount,'Dreams publication cleans only its own draft');
 check(window.__writes[0].category==='dreams'&&window.__writes[0].post_bg==='cream'&&window.__writes[0].decor.objs.some(o=>o.y===90),'ordinary Dreams publish submits full restored payload');
 check(!window.__errors.length,'no uncaught editor errors in Dreams');
}
}catch(e){results.push({error:e.message,stack:e.stack});}
sessionStorage.removeItem('draft-test-phase');sessionStorage.removeItem('draft-test-results');document.getElementById('test-results').textContent=JSON.stringify(results);
})();
