const assert=require("node:assert/strict");
const fs=require("node:fs");
const L=require("../life.js");
const J=require("../journal.js");
const S=require("../story.js");
const V=require("../scene.js");

function state(l){
 return JSON.parse(JSON.stringify({
  seed:l.seed,age:l.age,health:l.health,warmth:l.warmth,money:l.money,alive:l.alive,
  channels:l.channels,log:l.log,pending:l.pending.map(e=>({id:e.id,title:e.title,choices:e.choices.map(c=>c.label)})),
  history:l.history,diedAt:l.diedAt,diedOf:l.diedOf,flags:l.flags,house:l.house,
  selfDrops:l.selfDrops,retired:l.retired,peakMoney:l.peakMoney
 }));
}
function lifeToEnd(seed){
 const j=J.newJournal(seed);const life=J.replay(j);
 let steps=0;
 while(life.alive&&steps<115){
  while(life.pending.length){
   const e=life.pending[0];
   const n=(e.id==="child"||e.id==="meet"||e.id==="friend"||e.id==="dream"||e.id==="old")?0:1%Math.max(1,e.choices.length);
   J.append(j,life,{op:"choice",event:e.id,n});
  }
  // Every action is recorded, even if the value changes due to other commitments.
  if(steps%3===0)J.append(j,life,{op:"pour",id:"self",value:Math.min(8,2+steps%4)});
  const work=L.alive(life,"work")[0];
  if(work&&steps%5===0)J.append(j,life,{op:"pour",id:work.id,value:Math.min(8,3+steps%4)});
  J.append(j,life,{op:"year"});steps++;
  // Narration must not alter fate. R is NEVER called from S or V.
  S.describe(life,steps%3);
 }
 return {j,life,steps};
}
for(const seed of [1,2,3,7,32,111,1105,2026]){
 const {j,life}=lifeToEnd(seed);
 const restored=J.replay(JSON.parse(JSON.stringify(j)));
 assert.deepEqual(state(restored),state(life),"exact replay for seed "+seed);
 assert.equal(restored.alive,false,"life reaches an ending");
 const e1=L.epitaph(restored),e2=L.epitaph(life);
 assert.deepEqual(e1,e2,"epitaph preserves outcomes");
 const prior=J.rewind(j);
 assert(prior&&prior.commands.length<j.commands.length,"rewind removes at least one year");
 const earlier=J.replay(prior);
 assert(earlier.age<life.age,"rewind returns to earlier age");
}
const x=L.createLife(2026),y=L.createLife(2026);
for(let i=0;i<40;i++){
 const a=S.describe(x,i),b=S.describe(x,i);
 assert.deepEqual(a,b,"same scene and retelling input yields same prose");
 assert(a.title&&a.body&&a.speak&&a.scene,"complete story");
}
assert.equal(x.R(),y.R(),"narration must not consume model's seeded randomness");
const q=J.newJournal(1234);
assert.throws(()=>J.replay({...q,commands:[{op:"choice",event:"fake",n:0}]}));
assert.throws(()=>J.replay({...q,commands:[{op:"year"},{op:"year"},{op:"choice",event:"fake",n:0}]}));
assert.throws(()=>J.verify({...q,commands:[{op:"pour",id:"self",value:-5}]}));
assert.throws(()=>J.verify({...q,commands:[{op:"year"}].concat(Array(12001).fill({op:"year"}))}));
assert.throws(()=>J.verify({...q,seed:"javascript:evil"}));
const calls=[];
const g={addColorStop(){}};
const ctx=new Proxy({}, {get:(o,k)=>k in o?o[k]:
 (typeof k==="string"&&["createRadialGradient","createLinearGradient"].includes(k)?()=>g:
 typeof k==="string"&&["save","restore","clearRect","fillRect","strokeRect","beginPath","moveTo","lineTo","bezierCurveTo","ellipse","arc","fill","stroke","fillText","setTransform","drawImage"].includes(k)?()=>calls.push(k):undefined),
 set:(o,k,v)=>{o[k]=v;return true;}});
const drawn=L.createLife(1105);
for(let i=0;i<6;i++)V.render(ctx,920,700,drawn,S.describe(drawn,i),i,0,{labels:true});
assert(calls.length>100,"draws locally without external image loading");
const html=fs.readFileSync(require("node:path").join(__dirname,"..","index.html"),"utf8");
assert(!/<script[^>]+src="https?:/.test(html),"no external scripts");
assert(!/fonts\.googleapis/.test(html),"no remote fonts");
const app=fs.readFileSync(require("node:path").join(__dirname,"..","app.js"),"utf8");
assert(!/\bfetch\s*\(|XMLHttpRequest/.test(app),"no browser HTTP transport");
console.log("PASS: eight complete replayed lives, exact epigraphs, no RNG pollution, rewind, invalid-save rejection, procedural scene, offline resources.");
