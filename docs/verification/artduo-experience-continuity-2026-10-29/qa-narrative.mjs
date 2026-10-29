const task=await taskSpace(22),page=task.page('p3'),fs=await import('node:fs/promises');
const folder='/tmp/artduo-continuity-20261029-5mHOfY';
const basic=JSON.parse(await fs.readFile(folder+'/local-basic.json','utf8'));
const url=new URL(basic.settings.url);url.searchParams.set('phase','preface');url.searchParams.set('artworkId','artic-16487');
const curation=url.searchParams.get('curationId'),ids=url.searchParams.get('route').split(',');
const delivery='这次先看屋顶与海湾，再留意田野与天空。';
const results=[];
for(const item of [{name:'late',delay:8000},{name:'early',delay:200},{name:'skip-before-text',delay:4000,skip:true},{name:'storage-denied',delay:5000,denied:true}]){
  for(const file of await fs.readdir(folder+'/local-state/curations'))if(file.startsWith(curation+'.narrative-'))await fs.unlink(folder+'/local-state/curations/'+file);
  await page.evaluate(()=>sessionStorage.removeItem('artduo.presented-preface.v1'));
  const source=`(()=>{if(location.origin!=='http://127.0.0.1:3210')return;
    const config=${JSON.stringify({curation,ids,delay:item.delay,delivery,denied:Boolean(item.denied)})};
    window.__narrativeProbe={started:Date.now(),delivered:false};
    if(config.denied){const get=Storage.prototype.getItem,set=Storage.prototype.setItem;Storage.prototype.getItem=function(k){if(k==='artduo.presented-preface.v1')throw new DOMException('blocked','SecurityError');return get.call(this,k)};Storage.prototype.setItem=function(k,v){if(k==='artduo.presented-preface.v1')throw new DOMException('blocked','SecurityError');return set.call(this,k,v)}}
    const original=window.fetch.bind(window);window.fetch=async function(input,init){const path=new URL(typeof input==='string'?input:input.url,location.href).pathname;if(!path.endsWith('/api/curation/narrative'))return original(input,init);
      await new Promise(r=>setTimeout(r,config.delay));let sequence=0;
      const pieces=[{kind:'preface',text:config.delivery,evidenceIds:[config.ids[0]],source:'grounded'},...config.ids.map(id=>({kind:'note',artworkId:id,text:'留意这件作品的画面关系。',evidenceIds:[id],source:'grounded'})),{kind:'closing',text:'目光停在田野与天空之间。',evidenceIds:[config.ids.at(-1)],source:'grounded'}];
      const body=pieces.map(piece=>'event: piece\\ndata: '+JSON.stringify({schemaVersion:1,curationId:config.curation,sequence:sequence++,piece})+'\\n\\n').join('')+'event: complete\\ndata: '+JSON.stringify({schemaVersion:1,curationId:config.curation,sequence:sequence++})+'\\n\\n';
      window.__narrativeProbe.delivered=true;return new Response(body,{headers:{'content-type':'text/event-stream'}});
    };
  })();`;
  const registration=await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source});
  try{
    await page.goto(url.href);
    let first=null;
    if(item.skip){await page.waitForFunction(()=>!document.querySelector('.experience-preface-actions>button')?.disabled);await page.click('.experience-preface-actions>button',{label:'在前言正文出现前进入'});}
    else{await page.waitForSelector('.experience-preface h1',{state:'visible'});first=await page.evaluate(()=>document.querySelector('.experience-preface h1').textContent);await page.click('.experience-preface-actions>button',{label:'进入展厅核对前言'});}
    await page.waitForFunction(()=>window.__narrativeProbe?.delivered,undefined,{timeout:15000});
    await page.click('button[aria-label="观展设置"]',{label:'查看已展示前言版本'});await page.waitForSelector('.experience-settings-panel[open]',{state:'visible'});
    await page.click('.experience-settings-exhibition>summary',{label:'展开本次展览正文'});await page.waitForSelector('.experience-presented-preface',{state:'visible'});
    const shown=await page.evaluate(()=>document.querySelector('.experience-presented-preface').textContent);
    if(item.skip||item.name==='early'){if(shown!==delivery)throw new Error(item.name+' did not use early/unread delivery');}
    else if(shown!==first||shown===delivery)throw new Error(item.name+' replaced readable prose');
    const result={case:item.name,first,shown,matches:true};
    if(item.name==='late'){
      await page.reload();await page.waitForSelector('button[aria-label="观展设置"]',{state:'visible'});
      await page.click('button[aria-label="观展设置"]',{label:'刷新后核对前言'});await page.waitForSelector('.experience-settings-panel[open]',{state:'visible'});
      await page.click('.experience-settings-exhibition>summary',{label:'查看恢复的本次展览'});await page.waitForSelector('.experience-presented-preface',{state:'visible'});
      result.afterReload=await page.evaluate(()=>document.querySelector('.experience-presented-preface').textContent);
      if(result.afterReload!==first)throw new Error('Reload lost pinned prose');
    }
    results.push(result);console.log({case:item.name,passed:true});
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.experience-settings-panel')?.open);
  }finally{await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:registration.identifier});}
}
await fs.writeFile(folder+'/local-narrative.json',JSON.stringify(results,null,2));
console.log(await page.snapshot());
