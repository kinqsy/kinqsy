/* Local-only, account-scoped documents. IndexedDB transactions serialize revision checks across tabs. */
(function(g){
  "use strict";
  var opening;
  function open(){
    if(opening)return opening;
    opening=new Promise(function(resolve,reject){
      if(!g.indexedDB){reject(new Error("Локальное хранилище недоступно"));return;}
      var request=indexedDB.open("kinqsy-editor-drafts",1);
      request.onupgradeneeded=function(){var db=request.result;
        ["manual","recovery"].forEach(function(name){var s=db.createObjectStore(name,{keyPath:["owner","section","id"]});s.createIndex("scope",["owner","section"]);});
        db.createObjectStore("imports",{keyPath:["owner","section","source"]});
      };
      request.onsuccess=function(){var db=request.result;db.onversionchange=function(){db.close();opening=null;};resolve(db);};
      request.onerror=function(){opening=null;reject(request.error);};
      request.onblocked=function(){opening=null;reject(new Error("Закрой другие вкладки KINQSY для открытия хранилища"));};
    });return opening;
  }
  function validScope(owner,section){if(!owner || ["notes","dreams"].indexOf(section)<0)throw new Error("Неверный аккаунт или раздел");}
  function conflict(current){var e=new Error("В другой вкладке уже сохранена другая версия");e.name="DraftConflict";e.current=current;return e;}
  async function list(owner,section,kind){validScope(owner,section);var db=await open();return new Promise(function(resolve,reject){var tx=db.transaction(kind,"readonly"),r=tx.objectStore(kind).index("scope").getAll(IDBKeyRange.only([owner,section]));r.onsuccess=function(){resolve(r.result.filter(function(d){return d.version===1 && d.payload && d.id && typeof d.createdAt==="string" && typeof d.updatedAt==="string" && Number.isInteger(d.revision);}).sort(function(a,b){return b.updatedAt.localeCompare(a.updatedAt);}));};r.onerror=function(){reject(r.error);};});}
  async function save(kind,record,expected){validScope(record.owner,record.section);if(!record.id || !record.payload || record.version!==1)throw new Error("Неполный черновик");var db=await open();return new Promise(function(resolve,reject){
    var tx=db.transaction(kind,"readwrite"),store=tx.objectStore(kind),r=store.get([record.owner,record.section,record.id]),value,failure;
    r.onsuccess=function(){var old=r.result;if((old?old.revision:0)!==expected){failure=conflict(old);tx.abort();return;}
      value=Object.assign({},record,{revision:expected+1,createdAt:old?old.createdAt:record.createdAt,updatedAt:new Date().toISOString()});store.put(value);
    };
    tx.oncomplete=function(){resolve(value);};tx.onabort=tx.onerror=function(){reject(failure||tx.error||new Error("Не удалось сохранить черновик"));};
  });}
  async function remove(kind,record){validScope(record.owner,record.section);var db=await open();return new Promise(function(resolve,reject){var tx=db.transaction(kind,"readwrite"),store=tx.objectStore(kind),r=store.get([record.owner,record.section,record.id]),failure;
    r.onsuccess=function(){if(r.result&&r.result.revision!==record.revision){failure=conflict(r.result);tx.abort();return;}store.delete([record.owner,record.section,record.id]);};tx.oncomplete=function(){resolve();};tx.onabort=tx.onerror=function(){reject(failure||tx.error||new Error("Не удалось удалить черновик"));};
  });}
  async function importLegacy(owner){
    var prefix="kinqsy:notes:draft:"+owner+":",entries=[];
    try{for(var i=0;i<sessionStorage.length;i++){var key=sessionStorage.key(i);if(key&&key.indexOf(prefix)===0){var p;try{p=JSON.parse(sessionStorage.getItem(key));}catch(invalid){continue;}if(p&&p.decor&&p.decor.v===3&&(!p.user_id||p.user_id===owner))entries.push({source:key,payload:p,target:key.slice(prefix.length)});}}}catch(ignore){/* Existing session data is never deleted or overwritten. */}
    if(!entries.length)return;var db=await open();
    await new Promise(function(resolve,reject){var tx=db.transaction(["imports","recovery"],"readwrite");entries.forEach(function(e){var key=[owner,"notes",e.source],r=tx.objectStore("imports").get(key);r.onsuccess=function(){if(r.result && r.result.fingerprint===JSON.stringify(e.payload))return;var now=new Date().toISOString();tx.objectStore("recovery").put({version:1,id:"legacy:"+e.target+":"+(g.crypto&&crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)),owner:owner,section:"notes",revision:1,createdAt:now,updatedAt:now,legacy:true,targetPostId:/^\d+$/.test(e.target)?e.target:null,payload:e.payload});tx.objectStore("imports").put({owner:owner,section:"notes",source:e.source,fingerprint:JSON.stringify(e.payload)});};});tx.oncomplete=resolve;tx.onabort=tx.onerror=function(){reject(tx.error||new Error("Не удалось открыть старую аварийную копию"));};});
  }
  g.KQDraftStore={list:list,save:save,remove:remove,importLegacy:importLegacy};
})(window);
