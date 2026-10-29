const task=await taskSpace(22),page=task.page('p3'),fs=await import('node:fs/promises');
const folder='/tmp/artduo-continuity-20261029-5mHOfY',basic=JSON.parse(await fs.readFile(folder+'/local-basic.json','utf8'));
const target=new URL(basic.settings.url);target.searchParams.set('artworkId','smk-KKS1960-741');
await page.cdp('Emulation.setDeviceMetricsOverride',{width:320,height:640,deviceScaleFactor:1,mobile:true});
try{await page.goto(target.href)}catch(e){if(!String(e).includes('navigation committed'))throw e}
await page.waitForFunction(()=>Boolean(document.querySelector('.experience-next'))&&!document.querySelector('.experience-next').disabled,undefined,{timeout:30000});
await page.click('.experience-next',{label:'主动结束本次观展'});await page.waitForSelector('.experience-closing',{state:'visible'});
await page.click('.experience-closing-actions button:first-child',{label:'回看最后一件作品'});await page.waitForSelector('.experience-walk',{state:'visible'});
if(new URL(await page.url()).searchParams.get('artworkId')!=='smk-KKS1960-741')throw new Error('Revisit changed the last work');
await page.waitForFunction(()=>!document.querySelector('.experience-next')?.disabled);await page.click('.experience-next',{label:'回到结语检查分享失败恢复'});
await page.waitForSelector('.experience-closing',{state:'visible'});
await page.evaluate(()=>{window.__originalImage=window.Image;window.Image=function(){const image=document.createElement('img');Object.defineProperty(image,'src',{set(){queueMicrotask(()=>image.onerror?.(new Event('error')))}});return image;};});
try{
  await page.waitForFunction(()=>!document.querySelector('.experience-closing-actions button:last-child')?.disabled);
  await page.click('.experience-closing-actions button:last-child',{label:'注入本地分享图片失败'});await page.waitForSelector('.experience-share-fallback',{state:'visible'});
  await page.click('.experience-share-fallback button:first-of-type',{label:'核对分享失败后的重试入口'});await page.waitForSelector('.experience-share-fallback',{state:'visible'});
  await page.evaluate(()=>{document.querySelector('.experience-closing-artwork figcaption').firstChild.textContent='LongUnbrokenArtworkTitle'.repeat(12);});
  await page.click('.experience-closing-actions button:first-child',{label:'长标题后仍可回看作品'});await page.waitForSelector('.experience-walk',{state:'visible'});
  if(new URL(await page.url()).searchParams.get('artworkId')!=='smk-KKS1960-741')throw new Error('Long title blocked the closing action');
}finally{await page.evaluate(()=>{window.Image=window.__originalImage;delete window.__originalImage;});}
const result={width:320,height:640,activeEnd:true,revisitSameLastWork:true,controlledShareFailure:true,retryAvailable:true,longTitleActionReachable:true,noActualDownload:true};
await fs.writeFile(folder+'/local-closing-actions.json',JSON.stringify(result,null,2));console.log(result);
