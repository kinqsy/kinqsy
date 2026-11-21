document.getElementById('compose-title').value='маленькая композиция';
document.getElementById('compose-content').value='Текст можно переместить, изменить размер и расположить рядом с рисунком.';
window.openNotesCompose();
document.getElementById('compose-title').value='маленькая композиция';
document.getElementById('compose-content').value='Текст можно переместить, изменить размер и расположить рядом с рисунком.';
KQL.compose.refresh();KQL.compose.addSticker('demo',' /\_/\\\n( o.o )\n > ^ <');
const o=KQL.compose._objs().find(o=>o.type==='sticker');o.x=52;o.y=40;KQL.compose.refresh();
window.kqLoadCatalog=async()=>[{id:'demo',text:' /\_/\\\n( o.o )\n > ^ <',kind:'ascii'},{id:'demo2',text:'(づ｡◕‿‿◕｡)づ',kind:'kaomoji'}];
window.kqOpenStickerTray=window.__realTray;window.kqOpenStickerTray().then(()=>{document.querySelector('.compose-preview-box').scrollIntoView({block:'center'});document.getElementById('test-results').textContent=JSON.stringify({width:innerWidth,modal:document.querySelector('.compose-layout').getBoundingClientRect().toJSON(),dock:document.getElementById('kq-sticker-pop').getBoundingClientRect().toJSON()});});
