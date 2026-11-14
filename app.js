/* LIFE — game controller. Model, storytelling and artwork stay separate.
   No network calls; all random life decisions are reproducible from a journal.
*/
(function(){
 "use strict";
 const L=window.LifeModel,J=window.LifeJournal,S=window.LifeStory,V=window.LifeScene;
 const $=id=>document.getElementById(id);
 const AUTO="life-2026-autosave-v1",SLOT="life-2026-slot-",PREF="life-2026-voice-v1";
 const params=new URLSearchParams(location.search);
 function makeSeed(){
  if(window.crypto&&window.crypto.getRandomValues){
   const a=new Uint32Array(1);window.crypto.getRandomValues(a);return (a[0]%2147483646)+1;
  }
  return 1+Math.floor(Math.random()*2147483646);
 }
 function urlSeed(){
  const s=Number(params.get("seed"));return Number.isSafeInteger(s)&&s>0&&s<2147483647?s:makeSeed();
 }
 let seed=urlSeed(),journal=J.newJournal(seed),life=J.replay(journal),book=[],roll=0,started=false;
 let overlays={},voicePrefs={auto:false,name:"",speed:.9};
 let overrides={},currentStory=null;
 let artCache={},artTag="",lastDraw=0,stageW=0,stageH=0,stageDPR=1;
 let toastTime=0,savedDraft=null;
 const canvas=$("worldCanvas"),ctx=canvas.getContext("2d");
 const endCanvas=$("endCanvas"),endCtx=endCanvas.getContext("2d");
 const modalNames=["intro","fork","saves","voices","ending"];
 const show=(id,on=true)=>$(id).classList.toggle("hidden",!on);
 const money=v=>v>=1000?"€"+(v/1000).toFixed(2)+"m":v>=0?"€"+Math.round(v)+"k":"−€"+Math.abs(Math.round(v))+"k";
 function notify(message){
  $("toast").textContent=message;show("toast",true);
  if(toastTime)clearTimeout(toastTime);
  toastTime=setTimeout(()=>show("toast",false),3500);
 }
 function safeStorageGet(key){try{return localStorage.getItem(key)}catch(e){return null}}
 function safeStorageSet(key,val){try{localStorage.setItem(key,val);return true}catch(e){notify("Storage blocked or full. Download a life file instead.");return false}}
 function safeStorageDelete(key){try{localStorage.removeItem(key)}catch(e){}}
 function snapshot(){
  return {format:"LIFE-ARCHIVE-1",journal,book,roll,overrides,at:Date.now()};
 }
 function validateArchive(input){
  const raw=input&&input.format==="LIFE-ARCHIVE-1"?input:input&&input.version===1?{journal:input,book:[],roll:0,overrides:{}}:null;
  if(!raw||!raw.journal)throw Error("Not a compatible LIFE archive");
  J.verify(raw.journal);
  const model=J.replay(raw.journal);
  const cleanBook=Array.isArray(raw.book)?raw.book.slice(0,500).filter(x=>x&&typeof x==="object")
   .map(x=>({age:Number.isInteger(x.age)?x.age:0,at:String(x.at||"").slice(0,80),
     title:String(x.title||"").slice(0,160),body:String(x.body||"").slice(0,2500),
     choice:String(x.choice||"").slice(0,240)})):[];
  const cleanOverrides={};
  if(raw.overrides&&typeof raw.overrides==="object"){
   for(const [k,val] of Object.entries(raw.overrides).slice(0,200)){
    if(!/^(year|event|end):[0-9]{2,3}(?::[a-z]+)?$/.test(k))continue;
    if(val&&typeof val==="object"&&typeof val.body==="string"){
     cleanOverrides[k]={title:String(val.title||"").slice(0,150),body:val.body.slice(0,2600),
       scene:String(val.scene||"").slice(0,40)};
    }
   }
  }
  return {journal:raw.journal,life:model,book:cleanBook,roll:Math.max(0,Math.min(9999,Number(raw.roll)||0)),
    overrides:cleanOverrides};
 }
 function restore(data){
  const a=validateArchive(data);
  journal=a.journal;life=a.life;book=a.book;roll=a.roll;overrides=a.overrides;
  seed=journal.seed;started=true;history.replaceState(null,"","?seed="+seed);
  haltSpeech();show("intro",false);show("saves",false);show("voices",false);
  render(true);autoSave();
 }
 function autoSave(){
  if(!started)return;
  const ok=safeStorageSet(AUTO,JSON.stringify(snapshot()));
  $("saveStatus").textContent=ok?"● Autosaved on this device":"● Storage unavailable";
 }
 function rememberBookmark(){
  const s=safeStorageGet(AUTO);
  if(!s)return null;
  try{return validateArchive(JSON.parse(s))}catch(e){return null}
 }
 function beginFresh(newSeed,keepIntro=false){
  seed=newSeed;journal=J.newJournal(seed);life=J.replay(journal);book=[];roll=0;overrides={};
  started=!keepIntro;haltSpeech();
  history.replaceState(null,"","?seed="+seed);
  if(!keepIntro)show("intro",false);else {
   const remembered=rememberBookmark();
   $("resumeButton").classList.toggle("hidden",!remembered);
   if(remembered)$("resumeButton").textContent="Resume age "+remembered.life.age+" · life #"+remembered.journal.seed;
   show("intro",true);
  }
  show("fork",false);show("ending",false);
  render(!keepIntro);
  if(!keepIntro)autoSave();
 }
 function stateKey(){
  if(!life.alive)return "end:"+life.age;
  const e=life.pending[0];return e?"event:"+life.age+":"+e.id:"year:"+life.age;
 }
 function narrative(){
  const base=S.describe(life,roll),custom=overrides[stateKey()];
  if(custom&&custom.body)return {...base,title:custom.title||base.title,body:custom.body,
   speak:custom.body,scene:/^(rain|night|evening|home|garden|city|train|studio|street)$/.test(custom.scene)?custom.scene:base.scene};
  return base;
 }
 function artwork(scene){
  if(scene===artTag)return artCache[scene]||null;
  artTag=scene;
  const manifest=window.LifeArtManifest||{};
  const filename=manifest[scene];
  if(!filename||!/^[A-Za-z0-9_-]+\.(png|jpg|jpeg|webp)$/.test(filename))return null;
  if(!artCache[scene]){
   const img=new Image();img.decoding="async";
   img.onload=()=>{artCache[scene]=img;drawStage(performance.now());};
   img.onerror=()=>{artCache[scene]=null;};
   img.src="./art/"+filename;
   artCache[scene]=img;
  }
  return artCache[scene];
 }
 function resize(){
  const rect=canvas.getBoundingClientRect();
  if(rect.width<10||rect.height<10)return;
  stageDPR=Math.min(2,window.devicePixelRatio||1);
  stageW=rect.width;stageH=rect.height;
  canvas.width=Math.max(1,Math.round(stageW*stageDPR));
  canvas.height=Math.max(1,Math.round(stageH*stageDPR));
  drawStage(performance.now());
 }
 function drawStage(now){
  if(stageW<10||stageH<10)return;
  const art=currentStory?artwork(currentStory.scene):null;
  ctx.setTransform(stageDPR,0,0,stageDPR,0,0);
  V.render(ctx,stageW,stageH,life,currentStory||S.describe(life),roll,
    window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches?-1:now,{image:art});
 }
 function animate(now){
  if(now-lastDraw>35){drawStage(now);lastDraw=now}
  requestAnimationFrame(animate);
 }
 function channelItem(c){
  const item=document.createElement("div");item.className="branch"+(c.D<.45?" declining":"");
  const about=document.createElement("div"),who=document.createElement("div");who.className="branchName";
  who.textContent=c.kind==="dream"?(c.dream||"A dream"):c.kind==="work"?"Work":c.name;
  const kind=document.createElement("span");kind.className="branchKind";kind.textContent=c.kind.toUpperCase();
  who.append(kind);about.append(who);
  const meter=document.createElement("div");meter.className="branchMeter";
  const bar=document.createElement("i");bar.style.width=Math.max(1,Math.min(100,c.D/2*100))+"%";
  meter.append(bar);about.append(meter);
  const controls=document.createElement("div");controls.className="branchControls";
  for(const [label,delta] of [["−",-1],["+",1]]){
   const button=document.createElement("button");button.type="button";button.textContent=label;
   button.setAttribute("aria-label",(delta>0?"Give":"Remove")+" attention: "+who.firstChild.textContent);
   button.disabled=(!life.alive||life.pending.length>0||(delta<0&&c.drops===0)||(delta>0&&(L.usedDrops(life)>=L.budget(life)||c.drops>=8)));
   button.addEventListener("click",()=>adjust(c.id,delta));controls.append(button);
   if(delta<0){const b=document.createElement("b");b.textContent=c.drops;b.setAttribute("aria-label",c.drops+" attention drops");controls.append(b);}
  }
  item.append(about,controls);return item;
 }
 function selfItem(){
  const item=document.createElement("div");item.className="branch";
  const about=document.createElement("div"),who=document.createElement("div");
  who.className="branchName";who.textContent="Yourself";
  const kind=document.createElement("span");kind.className="branchKind";kind.textContent="REST / HEALTH";
  who.append(kind);about.append(who);
  const meter=document.createElement("div");meter.className="branchMeter";
  const bar=document.createElement("i");bar.style.width=Math.min(100,life.selfDrops/8*100)+"%";
  meter.append(bar);about.append(meter);
  const controls=document.createElement("div");controls.className="branchControls";
  const minus=document.createElement("button");minus.textContent="−";minus.disabled=life.selfDrops<=0||!!life.pending.length;
  minus.setAttribute("aria-label","Less attention to yourself");minus.onclick=()=>adjust("self",-1);
  const num=document.createElement("b");num.textContent=life.selfDrops;
  const plus=document.createElement("button");plus.textContent="+";plus.disabled=life.selfDrops>=8||!!life.pending.length||L.usedDrops(life)>=L.budget(life);
  plus.setAttribute("aria-label","More attention to yourself");plus.onclick=()=>adjust("self",1);
  controls.append(minus,num,plus);item.append(about,controls);return item;
 }
 function adjust(id,delta){
  if(!started||!life.alive||life.pending.length)return;
  const c=id==="self"?{drops:life.selfDrops}:L.alive(life).find(x=>x.id===id);
  if(!c)return;
  const value=c.drops+delta;
  if(value<0||value>8)return;
  const before=L.usedDrops(life);
  J.append(journal,life,{op:"pour",id,value});
  if(L.usedDrops(life)===before&&delta>0&&c.drops===value)notify("This year's attention is already spoken for.");
  render();autoSave();
 }
 function renderBranches(){
  const host=$("allocationRows");host.replaceChildren();
  host.append(selfItem());
  for(const c of L.alive(life))host.append(channelItem(c));
  $("attentionCount").textContent=L.usedDrops(life)+" / "+L.budget(life);
 }
 function renderLife(){
  $("seedTop").textContent="LIFE #"+seed;$("introSeed").textContent="SEED "+seed;
  $("ageNumber").textContent=life.age;
  $("healthValue").textContent=Math.round(life.health);
  $("warmthValue").textContent=Math.round(life.warmth);
  $("moneyValue").textContent=money(life.money);
  $("healthBar").style.width=Math.max(0,Math.min(100,life.health))+"%";
  $("warmthBar").style.width=Math.max(0,Math.min(100,life.warmth))+"%";
  const progress=Math.min(100,100*(life.age-18)/(104-18));
  $("timelineFill").style.width=progress+"%";
  $("timelineLabel").textContent="18 — "+life.age;
  const m=$("milestones");m.replaceChildren();
  for(const ev of book.slice(-7)){
   const el=document.createElement("span");el.className="milestone";
   const b=document.createElement("b");b.textContent=ev.age;el.append(b,document.createTextNode(ev.title.slice(0,26)));m.append(el);
  }
  $("yearButton").disabled=!life.alive||!!life.pending.length;
  $("fiveButton").disabled=!life.alive||!!life.pending.length;
  $("turnInfo").textContent=life.pending.length?"A choice is waiting. The year will not move without you.":
   life.alive?"Unused attention fades at the year's end. Older branches change more slowly.":
   "There is no next year. This life has reached its end.";
  renderBranches();
  const log=$("chronicleItems");log.replaceChildren();
  for(const event of life.log.slice(-11).reverse()){
   const div=document.createElement("div");div.className="memory "+event.tone;
   const date=document.createElement("time");date.textContent="AGE "+event.age;
   div.append(date,document.createTextNode(event.text));log.append(div);
  }
 }
 function renderStory(){
  currentStory=narrative();
  $("chapterTag").textContent="CHAPTER "+Math.max(1,life.age-17)+" · AGE "+life.age;
  $("sceneTag").textContent=currentStory.scene.toUpperCase()+" / "+(life.warmth>55?"WARM LIGHT":"LOW LIGHT");
  $("narrationLabel").textContent=currentStory.label.toUpperCase();
  $("storyTitle").textContent=currentStory.title;
  $("storyText").textContent=currentStory.body;
  drawStage(performance.now());
 }
 function render(present=false){
  renderLife();renderStory();
  if(!started)return;
  if(present){
   if(!life.alive){renderEnding();show("ending",true);show("fork",false);}
   else if(life.pending.length)renderFork();
   else show("fork",false);
  }
 }
 function renderFork(){
  const e=life.pending[0];if(!e){show("fork",false);return;}
  const s=narrative();
  $("forkAge").textContent="A FORK IN THE ROAD · AGE "+life.age;
  $("forkTitle").textContent=e.title;
  $("forkText").textContent=s.body;
  $("forkFoot").textContent=e.choices.length>1?"Only you can decide what this year becomes.":"Some events give us no choice.";
  const box=$("forkChoices");box.replaceChildren();
  e.choices.forEach((choice,i)=>{
   const btn=document.createElement("button");btn.textContent=choice.label;
   btn.addEventListener("click",()=>choose(i));box.append(btn);
  });
  show("fork",true);show("ending",false);
  if(voicePrefs.auto)readAloud();
 }
 function addBook(page,at,choice=""){
  if(book.length>=500)book.shift();
  book.push({age:life.age,at,title:String(page.title).slice(0,160),
    body:String(page.body).slice(0,2500),choice:String(choice).slice(0,240)});
 }
 function choose(index){
  const e=life.pending[0];if(!e)return;
  const before=S.eventStory(life,e,roll);
  const label=e.choices[index]?.label;if(label==null)return;
  J.append(journal,life,{op:"choice",event:e.id,n:index});
  const last=life.log[life.log.length-1];
  addBook(before,"event:"+life.age+":"+e.id,label+" — "+(last?last.text:""));
  roll=0;render(true);autoSave();
  if(!life.pending.length){
   notify(last?last.text:"Your choice has become part of this life.");
   if(voicePrefs.auto)readAloud();
  }
 }
 function year(n=1){
  if(!started||!life.alive||life.pending.length)return;
  let count=0;
  for(let i=0;i<n&&life.alive&&!life.pending.length;i++){
   J.append(journal,life,{op:"year"});count++;
   const page=S.yearStory(life,0);
   addBook(page,"year:"+life.age);
  }
  roll=0;render(true);autoSave();
  if(count>1)notify(count+" quiet years passed.");
  if(life.alive&&!life.pending.length&&voicePrefs.auto)readAloud();
 }
 function shortBook(){
  const entries=book.slice(-90).map(e=>"AGE "+e.age+" — "+e.title+"\n"+e.body+(e.choice?"\nChoice: "+e.choice:""));
  return "LIFE #"+seed+" · "+life.age+" YEARS\n\n"+entries.join("\n\n")+"\n\nThe end of the book is still being written.";
 }
 function renderEnding(){
  const ep=L.epitaph(life),s=narrative();
  $("endAge").textContent="LIFE #"+seed+" · AGE "+ep.age;
  $("endingTitle").textContent="The shape you leave.";
  $("endQuote").textContent=ep.line;
  $("endProse").textContent=s.body;
  $("endFuneral").textContent=ep.funeral;
  $("endMoney").textContent=ep.money;
  $("endWho").textContent=ep.funeralNames.length?ep.funeralNames.join(", "):"Not recorded in the model.";
  $("endLost").textContent=ep.withered.length?ep.withered.slice(0,12).map(c=>c.name+" ("+c.age+")").join(", "):"No withered branches recorded.";
  drawPortrait();
 }
 function drawPortrait(){
  const w=endCanvas.width,h=endCanvas.height;
  endCtx.setTransform(1,0,0,1,0,0);
  V.render(endCtx,w,h,life,currentStory||S.describe(life,roll),roll,-1,{labels:false,image:artwork("night")});
  const gradient=endCtx.createLinearGradient(0,h*.6,0,h);
  gradient.addColorStop(0,"#09120d00");gradient.addColorStop(1,"#09120de6");
  endCtx.fillStyle=gradient;endCtx.fillRect(0,h*.6,w,h*.4);
  endCtx.textAlign="center";endCtx.fillStyle="#efe6cf";endCtx.font="40px Georgia,serif";
  endCtx.fillText("L I F E",w/2,h-122);
  endCtx.font="25px Georgia,serif";endCtx.fillStyle="#e3cd9f";
  endCtx.fillText("A life lived · "+life.age+" years",w/2,h-80);
  endCtx.fillStyle="#9eae9a";endCtx.font="17px monospace";
  endCtx.fillText("seed "+seed,w/2,h-48);
 }
 function downloadBlob(name,blob){
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=name;a.rel="noopener";document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
 }
 function exportLife(){
  const blob=new Blob([JSON.stringify(snapshot(),null,2)],{type:"application/json"});
  downloadBlob("life-"+seed+"-age-"+life.age+".json",blob);notify("Life file downloaded.");
 }
 function exportCurrentImage(){
  const w=1400,h=1020;
  const imageCanvas=document.createElement("canvas");
  imageCanvas.width=w;imageCanvas.height=h;
  const gc=imageCanvas.getContext("2d");
  const image=currentStory?artwork(currentStory.scene):null;
  V.render(gc,w,h,life,currentStory||S.describe(life),roll,-1,{image});
  const fade=gc.createLinearGradient(0,h*.64,0,h);
  fade.addColorStop(0,"#09140e00");fade.addColorStop(1,"#08130dde");
  gc.fillStyle=fade;gc.fillRect(0,h*.64,w,h*.36);
  gc.textAlign="center";gc.fillStyle="#f1dfbb";gc.font="40px Georgia,serif";
  gc.fillText("LIFE · "+life.age+" YEARS",w/2,h-90);
  gc.font="19px monospace";gc.fillStyle="#bac6ae";
  gc.fillText("SEED "+seed+" · "+(currentStory?.scene||"memory").toUpperCase(),w/2,h-55);
  imageCanvas.toBlob(blob=>{
   if(blob)downloadBlob("life-"+seed+"-age-"+life.age+"-scene.png",blob);
   else notify("Could not export image.");
  },"image/png");
 }
 function exportPortrait(){
  drawPortrait();
  endCanvas.toBlob(blob=>{
   if(!blob){notify("Image export unavailable in this browser.");return}
   downloadBlob("life-"+seed+"-portrait.png",blob);
  },"image/png");
 }
 async function copy(text){
  try{await navigator.clipboard.writeText(text);notify("Copied.");}
  catch(e){window.prompt("Copy this text:",text);}
 }
 function renderSlots(){
  const box=$("saveSlots");box.replaceChildren();$("saveMessage").textContent="";
  for(let i=0;i<3;i++){
   const row=document.createElement("div");row.className="slot";
   const left=document.createElement("div");const strong=document.createElement("strong");
   strong.textContent="Memory "+(i+1);left.append(strong);
   const note=document.createElement("span");
   let saved=null;
   const raw=safeStorageGet(SLOT+i);
   if(raw){try{saved=validateArchive(JSON.parse(raw))}catch(e){}}
   note.textContent=saved?"Life #"+saved.journal.seed+" · age "+saved.life.age:
    "Empty";
   left.append(note);
   const bs=document.createElement("div");bs.className="slotButtons";
   const write=document.createElement("button");write.textContent="Save here";
   write.onclick=()=>{
    safeStorageSet(SLOT+i,JSON.stringify(snapshot()));renderSlots();
    $("saveMessage").textContent="Saved memory "+(i+1)+" on this device.";
   };
   bs.append(write);
   if(saved){
    const load=document.createElement("button");load.textContent="Load";
    load.onclick=()=>{
     if(confirm("Load this life? The current unsaved timeline will be replaced.")){
      restore(JSON.parse(safeStorageGet(SLOT+i)));notify("Life restored from memory "+(i+1)+".");
     }
    };
    const clear=document.createElement("button");clear.textContent="Erase";
    clear.onclick=()=>{
     if(confirm("Erase memory "+(i+1)+" on this device?")){safeStorageDelete(SLOT+i);renderSlots();}
    };bs.append(load,clear);
   }
   row.append(left,bs);box.append(row);
  }
 }
 function doRewind(){
  const previous=J.rewind(journal);
  if(!previous){notify("No earlier year to rewind.");return;}
  journal=previous;life=J.replay(journal);
  book=book.filter(x=>x.age<life.age);roll=0;
  haltSpeech();show("saves",false);show("ending",false);render(true);autoSave();
  notify("One year rewound. You may now make different choices.");
 }
 function initVoice(){
  const raw=safeStorageGet(PREF);
  if(raw)try{const p=JSON.parse(raw);voicePrefs={auto:p.auto===true,name:String(p.name||""),speed:Math.max(.65,Math.min(1.2,Number(p.speed)||.9))};}catch(e){}
  $("autoVoice").checked=voicePrefs.auto;$("voiceSpeed").value=voicePrefs.speed;
  $("speedLabel").textContent=voicePrefs.speed.toFixed(2)+"×";
  refreshVoices();
  if("speechSynthesis" in window)speechSynthesis.addEventListener("voiceschanged",refreshVoices);
 }
 function localVoices(){
  if(!("speechSynthesis" in window))return [];
  return speechSynthesis.getVoices().filter(v=>v.localService===true);
 }
 function refreshVoices(){
  const select=$("voiceSelect"),voices=localVoices();select.replaceChildren();
  if(!voices.length){
   const option=document.createElement("option");option.textContent="No verified offline voice installed";option.value="";
   select.append(option);select.disabled=true;$("testVoice").disabled=true;
   $("voiceHelp").textContent="No voice is explicitly marked local by this browser. Spoken narration is disabled rather than using an unknown cloud voice. Text narration still works.";
   return;
  }
  select.disabled=false;$("testVoice").disabled=false;
  for(const v of voices){
   const op=document.createElement("option");op.value=v.name;op.textContent=v.name+" · "+v.lang+" (on device)";select.append(op);
  }
  const match=voices.find(v=>v.name===voicePrefs.name)||
   voices.find(v=>/^en-/i.test(v.lang))||voices[0];
  select.value=match.name;voicePrefs.name=match.name;
  $("voiceHelp").textContent="Only voices reported as local by your browser are listed. Offline availability can still depend on installed operating-system voice data.";
 }
 function rememberVoice(){
  safeStorageSet(PREF,JSON.stringify(voicePrefs));
 }
 function haltSpeech(){if("speechSynthesis" in window)speechSynthesis.cancel();}
 function readAloud(sample=false){
  const voices=localVoices();
  if(!voices.length){notify("No verified local voice available. Narration remains text-only.");return;}
  const voice=voices.find(v=>v.name===voicePrefs.name)||voices[0];
  haltSpeech();
  const u=new SpeechSynthesisUtterance(sample?
   "A life is a living network. Some branches grow from choices. Others grow from time.":
   currentStory?.speak||currentStory?.body||"");
  u.voice=voice;u.lang=voice.lang;u.rate=voicePrefs.speed;u.pitch=.92;u.volume=.95;
  speechSynthesis.speak(u);
 }
 function importData(file){
  if(!file)return;
  if(file.size>1_000_000){notify("File too large. Maximum 1 MB.");return;}
  const reader=new FileReader();
  reader.onerror=()=>notify("Could not read file.");
  reader.onload=()=>{
   try{
    const obj=JSON.parse(String(reader.result));
    if(obj&&obj.format==="LIFE-NARRATION-1"&&Array.isArray(obj.stories)){
     const next={};
     for(const item of obj.stories.slice(0,200)){
      if(!item||!(/^(year|event|end):[0-9]{2,3}(?::[a-z]+)?$/.test(String(item.at||""))))continue;
      next[item.at]={title:String(item.title||"").slice(0,150),
       body:String(item.body||"").slice(0,2600),scene:String(item.scene||"").slice(0,40)};
     }
     overrides={...overrides,...next};roll=0;render();autoSave();
     show("saves",false);notify("Imported "+Object.keys(next).length+" locally generated narration passages.");
    }else{
     restore(obj);notify("Life imported. Every event was replayed from its original seed.");
    }
   }catch(e){notify("Import rejected: "+(e.message||"invalid life file"));}
  };
  reader.readAsText(file);
 }
 function bind(){
  $("beginButton").onclick=()=>beginFresh(seed,false);
  $("resumeButton").onclick=()=>{
   const r=rememberBookmark();if(!r){notify("No valid autosave found.");return;}
   restore(JSON.parse(safeStorageGet(AUTO)));notify("Welcome back.");
  };
  $("newSeedButton").onclick=()=>{
   seed=makeSeed();beginFresh(seed,true);
  };
  $("newButton").onclick=()=>{
   if(started&&!confirm("Begin a different life? Your current life is autosaved; export or save to a slot if you want to keep both."))return;
   seed=makeSeed();beginFresh(seed,true);
  };
  $("yearButton").onclick=()=>year(1);$("fiveButton").onclick=()=>year(5);
  $("rerollButton").onclick=()=>{
   roll=(roll+1)%10000;renderStory();autoSave();notify("Same life. A different telling.");
   if(voicePrefs.auto)readAloud();
  };
  $("readButton").onclick=()=>readAloud();
  $("saveSceneButton").onclick=exportCurrentImage;
  $("stopVoiceButton").onclick=haltSpeech;
  $("saveButton").onclick=()=>{renderSlots();show("saves",true);};
  $("closeSaves").onclick=()=>show("saves",false);
  $("voiceButton").onclick=()=>{refreshVoices();show("voices",true);};
  $("closeVoices").onclick=()=>show("voices",false);
  $("voiceSelect").onchange=()=>{
   voicePrefs.name=$("voiceSelect").value;rememberVoice();
  };
  $("voiceSpeed").oninput=()=>{
   voicePrefs.speed=Number($("voiceSpeed").value);
   $("speedLabel").textContent=voicePrefs.speed.toFixed(2)+"×";rememberVoice();
  };
  $("autoVoice").onchange=()=>{
   voicePrefs.auto=$("autoVoice").checked;rememberVoice();
   if(voicePrefs.auto&&!localVoices().length)notify("Auto-narration needs an installed offline voice.");
  };
  $("testVoice").onclick=()=>readAloud(true);
  $("exportButton").onclick=exportLife;
  $("importButton").onclick=()=>$("importFile").click();
  $("importFile").onchange=e=>{
   importData(e.target.files[0]);e.target.value="";
  };
  $("undoButton").onclick=doRewind;
  $("portraitButton").onclick=exportPortrait;
  $("endExport").onclick=exportLife;
  $("endCopy").onclick=()=>{
   const ep=L.epitaph(life);
   copy(ep.share+"\n\nSame starting life, different choices: "+location.origin+location.pathname+"?seed="+seed+
    "\nExact decisions require an exported life file.");
  };
  $("copyChronicle").onclick=()=>copy(shortBook());
  $("endAgain").onclick=()=>beginFresh(makeSeed(),true);
  $("endReplay").onclick=()=>beginFresh(seed,true);
  document.addEventListener("keydown",e=>{
   if(e.key==="Escape"){
    if(!$("saves").classList.contains("hidden"))show("saves",false);
    if(!$("voices").classList.contains("hidden"))show("voices",false);
   }
   if(e.code==="Space"&&started&&!e.repeat&&!["INPUT","SELECT","BUTTON","TEXTAREA"].includes(document.activeElement?.tagName)&&
    $("fork").classList.contains("hidden")&&$("ending").classList.contains("hidden")&&
    $("saves").classList.contains("hidden")&&$("voices").classList.contains("hidden")){
    e.preventDefault();year(1);
   }
  });
  window.addEventListener("resize",resize);
  if("ResizeObserver" in window)new ResizeObserver(resize).observe(canvas);
  document.addEventListener("visibilitychange",()=>{if(document.hidden)haltSpeech();});
 }
 function boot(){
  bind();initVoice();
  const r=rememberBookmark();
  if(r){
   $("resumeButton").classList.remove("hidden");
   $("resumeButton").textContent="Resume age "+r.life.age+" · life #"+r.journal.seed;
  }
  show("intro",true);show("fork",false);show("ending",false);show("saves",false);show("voices",false);
  render(false);requestAnimationFrame(animate);resize();
 }
 boot();
})();
