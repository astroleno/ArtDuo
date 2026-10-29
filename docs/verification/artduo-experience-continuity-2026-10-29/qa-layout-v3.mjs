const task=await taskSpace(22),page=task.page('p3'),fs=await import('node:fs/promises');
const folder='/tmp/artduo-continuity-20261029-5mHOfY',basic=JSON.parse(await fs.readFile(folder+'/local-basic.json','utf8'));
const url=new URL(basic.settings.url);url.searchParams.set('phase','closing');url.searchParams.set('artworkId','smk-KKS1960-741');
const navigate=async()=>{try{await page.goto(url.href)}catch(error){if(!String(error).includes('navigation committed'))throw error}await page.waitForFunction(()=>document.querySelector('.experience-closing-image')?.dataset.imageState==='ready',undefined,{timeout:30000});};
const checks=[];
for(const [width,height] of [[1440,900],[390,844],[320,640]]){
  await page.cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<768});
  await navigate();
  const measure=()=>page.evaluate(()=>{
    const img=document.querySelector('.experience-closing-image img'),figure=document.querySelector('.experience-closing-artwork'),caption=figure.querySelector('figcaption'),panel=document.querySelector('.experience-closing');
    const r=img.getBoundingClientRect(),c=caption.getBoundingClientRect(),ratio=img.naturalWidth/img.naturalHeight;
    const scale=Math.min(r.width/img.naturalWidth,r.height/img.naturalHeight),w=img.naturalWidth*scale,h=img.naturalHeight*scale;
    return {width:innerWidth,height:innerHeight,natural:[img.naturalWidth,img.naturalHeight],image:{x:r.x,y:r.y,width:r.width,height:r.height},gap:c.top-(r.top+(r.height-h)/2+h),leftGap:c.left-(r.left+(r.width-w)/2),overflow:Math.max(document.documentElement.scrollWidth-innerWidth,panel.scrollWidth-panel.clientWidth,figure.scrollWidth-figure.clientWidth),ratioError:Math.abs(r.width/r.height-ratio),imageState:img.parentElement.dataset.imageState};
  });
  let row={case:'real-landscape',...await measure()};
  if(row.gap<15||row.gap>25||Math.abs(row.leftGap)>1||row.overflow>1)throw new Error('Real closing layout '+JSON.stringify(row));
  checks.push(row);await page.screenshot({path:folder+`/local-closing-${width}.png`});
  for(const [name,w,h] of [['portrait',300,600],['square',400,400],['ultrawide',1000,100]]){
    await page.evaluate(({w,h,name})=>{
      const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#8e9f99"/><text x="10" y="28" fill="white" font-size="16">Layout fixture: ${name}</text></svg>`;
      document.querySelector('.experience-closing-image img').src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
    },{w,h,name});
    await page.waitForFunction(({w,h})=>{const i=document.querySelector('.experience-closing-image img');return i.naturalWidth===w&&i.naturalHeight===h&&Math.abs(i.getBoundingClientRect().width/i.getBoundingClientRect().height-w/h)<.01},{w,h});
    row={case:name,...await measure()};checks.push(row);
    if(row.gap<15||row.gap>25||Math.abs(row.leftGap)>1||row.overflow>1)throw new Error('Fixture layout '+JSON.stringify(row));
    if(name==='portrait'&&width===390)await page.screenshot({path:folder+'/fixture-portrait-390.png'});
  }
  await page.evaluate(()=>{const c=document.querySelector('.experience-closing-artwork figcaption');c.firstChild.textContent='LongUnbrokenArtworkTitle'.repeat(12)});
  row={case:'long-title',...await measure()};checks.push(row);
  if(row.overflow>1)throw new Error('Long title overflow '+JSON.stringify(row));
  await page.evaluate(()=>document.querySelector('.experience-closing-image img').src='/ArtDuo/qa-missing-image.png');
  await page.waitForFunction(()=>document.querySelector('.experience-closing-image')?.dataset.imageState==='failed');
  const failure=await page.evaluate(()=>{
    const panel=document.querySelector('.experience-closing'),figure=document.querySelector('.experience-closing-artwork');
    return {height:document.querySelector('.experience-closing-image').getBoundingClientRect().height,text:document.querySelector('.experience-closing-image [role=status]').textContent,overflow:Math.max(document.documentElement.scrollWidth-innerWidth,panel.scrollWidth-panel.clientWidth,figure.scrollWidth-figure.clientWidth)};
  });
  if(failure.height>100||failure.overflow>1)throw new Error('Failure occupied a large empty frame '+JSON.stringify(failure));
  checks.push({case:'image-failed',width,...failure});
}
await fs.writeFile(folder+'/local-layout.json',JSON.stringify(checks,null,2));
console.log(checks.map(r=>({case:r.case,width:r.width,gap:r.gap,overflow:r.overflow,passed:true})));
console.log(await page.snapshot());
