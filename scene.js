/* Life — generative canvas art, no image API, no external requests.
   Draws the world and the relationship-vine directly from game state.
   If an optional local art pack is present, an image can appear behind the vine.
*/
(function(root){
 "use strict";
 const PI=Math.PI,TAU=2*PI;
 const COLORS={
  parent:"#9ab8a8",partner:"#e6bf84",child:"#e6cd9e",friend:"#7ec3a8",dream:"#b9b5ec",work:"#90a6b7"
 };
 function noise(n){let x=Math.sin(n*13.387+18.231)*43758.5453;return x-Math.floor(x)}
 function line(ctx,a,b,color,width){
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
 }
 function ellipse(ctx,x,y,rx,ry,color,rot=0){
  ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),rot,0,TAU);ctx.fill();
 }
 function site(ctx,w,h,life,story,v){
  const warm=life.warmth/100,night=["night","rain"].includes(story.scene);
  const sky=ctx.createLinearGradient(0,0,0,h);
  const top=night?"#080f20":story.scene==="garden"?"#152a28":story.scene==="home"?"#283528":
    story.scene==="city"?"#171e2d":"#1e2c30";
  sky.addColorStop(0,top);sky.addColorStop(.53,night?"#242d3c":"#41463e");
  sky.addColorStop(1,warm>.55?"#514132":"#222f32");
  ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
  const sourceX=w*(.22+.08*noise(v+life.seed)),sourceY=h*.28;
  const glow=ctx.createRadialGradient(sourceX,sourceY,6,sourceX,sourceY,w*.62);
  glow.addColorStop(0,warm>.38?"#e5bd7a44":"#9dbbd039");glow.addColorStop(1,"#00000000");
  ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
  const rain=story.scene==="rain",city=["city","train"].includes(story.scene);
  if(night||rain)for(let i=0;i<92;i++){
   let x=noise(i+life.seed*7+v*51)*w,y=noise(i+life.seed*11+v*17)*h*.58;
   if(rain)line(ctx,{x,y},{x:x-3,y:y+12},"#a3b8be20",.6);
   else ellipse(ctx,x,y,.6,.6,"#efe7ce"+(i%3===0?"99":"44"));
  }
  if(city){
   for(let i=0;i<15;i++){
    const bw=w/13.5,bx=i*bw-bw*.2,bh=h*(.14+noise(i*17+life.seed)*.25);
    ctx.fillStyle=i%3===0?"#202831":"#212d2f";ctx.fillRect(bx,h*.68-bh,bw*.88,bh+h*.32);
    for(let j=0;j<7;j++)for(let k=0;k<3;k++){
     if(noise(i*91+j*11+k*17+v)>.38){
      ctx.fillStyle=warm>.4?"#d3b27a30":"#9eb3ae16";
      ctx.fillRect(bx+6+k*bw*.21,h*.7-bh+9+j*bh*.12,3,5);
     }
    }
   }
  }else{
   // A distant low landscape and a few silhouettes, like remembered places.
   ctx.fillStyle="#202c29";
   ctx.beginPath();ctx.moveTo(0,h*.73);
   for(let x=0;x<=w;x+=w/26)ctx.lineTo(x,h*(.66+noise(x*.007+life.seed*.003)*.06));
   ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.fill();
  }
  // House/window: a warm source that is never merely the amount in the bank.
  const wx=w*.11,wy=h*.44,ww=w*.13,wh=h*.22;
  ctx.fillStyle="#151e1d";ctx.fillRect(wx-ww*.17,wy-16,ww*1.35,wh+25);
  ctx.fillStyle=warm>.38?"#c8a36b66":"#829ba844";ctx.fillRect(wx,wy,ww,wh);
  ctx.fillStyle="#242b29";ctx.fillRect(wx+ww*.47,wy,ww*.055,wh);ctx.fillRect(wx,wy+wh*.46,ww,wh*.06);
  if(["home","evening","garden"].includes(story.scene)){
   ctx.beginPath();ctx.moveTo(wx-ww*.25,wy-16);ctx.lineTo(wx+ww*.5,wy-h*.1);ctx.lineTo(wx+ww*1.2,wy-16);ctx.fillStyle="#192823";ctx.fill();
  }
  // Foreground haze creates a stage for the living network.
  const ground=ctx.createLinearGradient(0,h*.68,0,h);
  ground.addColorStop(0,"#0b1a1600");ground.addColorStop(1,"#08130ffc");
  ctx.fillStyle=ground;ctx.fillRect(0,h*.67,w,h*.33);
  for(let i=0;i<24;i++){
   let x=noise(i*3.3+v)*w,y=h*(.7+.29*noise(i*8+life.seed));
   ellipse(ctx,x,y,1+noise(i*4)*4,2+noise(i*7)*4,"#d1c696"+(i%2?"1b":"12"));
  }
 }
 function coords(c,life,w,h){
  const same=life.channels.filter(x=>x.kind===c.kind&&x.id<c.id).length;
  let a,r;
  switch(c.kind){
   case "parent":a=-1.19+same*.29;r=.36;break;
   case "partner":a=-.18+same*.25;r=.52;break;
   case "child":a=-.52+(same%5)*.25;r=.78+Math.floor(same/5)*.05;break;
   case "friend":a=.48+(same%6)*.19;r=.53+(same%2)*.12+Math.floor(same/6)*.05;break;
   case "dream":a=-.95-same*.15;r=.75;break;
   case "work":a=1.27;r=.55;break;
   default:a=0;r=.5;
  }
  a+=(c.wobble-.5)*.20;r+=(c.slot-.5)*.08;
  const root={x:w*.51,y:h*.88};
  return {x:Math.max(35,Math.min(w-35,root.x+Math.sin(a)*r*w*.58)),
          y:Math.max(35,Math.min(h-45,root.y-Math.cos(a)*r*h*.80))};
 }
 function bezier(ctx,a,b,offset){
  const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
  const p1={x:a.x+dx*.16+len*offset*.22,y:a.y+dy*.24-len*.13};
  const p2={x:b.x-dx*.30-len*offset*.18,y:b.y-dy*.28+len*.10};
  ctx.bezierCurveTo(p1.x,p1.y,p2.x,p2.y,b.x,b.y);
  return {a,b,p1,p2};
 }
 function point(c,t){
  const u=1-t;return {
   x:u*u*u*c.a.x+3*u*u*t*c.p1.x+3*u*t*t*c.p2.x+t*t*t*c.b.x,
   y:u*u*u*c.a.y+3*u*u*t*c.p1.y+3*u*t*t*c.p2.y+t*t*t*c.b.y};
 }
 function render(ctx,w,h,life,story,variant=0,time=0,options={}){
  if(!ctx||w<20||h<20)return;
  ctx.save();ctx.clearRect(0,0,w,h);
  site(ctx,w,h,life,story,variant);
  const img=options.image;
  if(img&&img.complete&&img.naturalWidth){
   ctx.globalAlpha=.46;ctx.drawImage(img,0,0,w,h);ctx.globalAlpha=1;
   const grade=ctx.createLinearGradient(0,0,0,h);
   grade.addColorStop(0,"#0b1a1744");grade.addColorStop(1,"#0b1a17c9");
   ctx.fillStyle=grade;ctx.fillRect(0,0,w,h);
  }
  const rootPos={x:w*.51,y:h*.88};
  // Root radiates old rings: the body that keeps the network alive.
  for(let i=4;i>0;i--){
   const r=i*10;ctx.beginPath();ctx.arc(rootPos.x,rootPos.y,r,0,TAU);
   ctx.strokeStyle=i%2?"#bbcf9b22":"#e5bb8433";ctx.lineWidth=1.4;ctx.stroke();
  }
  const ordered=life.channels.slice().sort((a,b)=>a.kind===b.kind?a.id-b.id:
   (a.kind==="child"?1:0)-(b.kind==="child"?1:0));
  for(const c of ordered){
   const b=coords(c,life,w,h);
   let a=rootPos;
   if(c.kind==="child"){
    const related=life.channels.find(x=>x.id===c.parentId && x.alive)||
     life.channels.find(x=>x.kind==="partner"&&x.alive);
    if(related)a=coords(related,life,w,h);
   }
   const t=Math.min(1,Math.max(0,c.D/(c.D+0.95)));
   const thick=1.4+Math.min(13,c.Dpeak*3.6),current=1.1+Math.min(11,c.D*3.2);
   const green=COLORS[c.kind]||"#9dbaa7";
   const path={};
   ctx.beginPath();ctx.moveTo(a.x,a.y);
   const curve=bezier(ctx,a,b,c.wobble-.5);ctx.lineCap="round";
   ctx.strokeStyle="#0b130f";ctx.lineWidth=thick+3;ctx.stroke();
   ctx.strokeStyle=c.alive?"#574737":"#5a4c3b";ctx.lineWidth=thick;ctx.stroke();
   if(c.alive){
    ctx.strokeStyle=green;ctx.lineWidth=current;
    ctx.globalAlpha=.18+.66*t;ctx.stroke();ctx.globalAlpha=1;
   }
   const leafN=Math.min(10,Math.max(0,Math.round(c.alive?2+c.D*3:0)));
   for(let j=0;j<leafN;j++){
    const f=(j+1)/(leafN+1),p=point(curve,f);
    const dir=j%2?1:-1,off=6+6*noise(c.id*7+j+life.seed);
    ellipse(ctx,p.x+off*dir,p.y-3+off*.18,Math.max(2,2+current*.3),Math.max(3,5+current*.47),
     c.kind==="child"?"#e0bb8c88":green+"99",dir*.55);
   }
   ellipse(ctx,b.x,b.y,Math.max(2,2+current*.5),Math.max(2,2+current*.5),
     c.alive?green:"#785a45");
   if(c.alive&&c.D>.35&&time>=0){
    const progress=((time*.00017*(1.1+.2*c.D)+c.slot)%1+1)%1;
    const p=point(curve,progress);
    ellipse(ctx,p.x,p.y,2+Math.min(2,c.D),"#f0cf94cf");
   }
   if(c.alive&&c.D>.53 && options.labels!==false){
    ctx.fillStyle="#dbe3c7d2";ctx.font=Math.round(Math.max(10,Math.min(14,w/85)))+"px Georgia, serif";
    ctx.textAlign="center";ctx.fillText(c.kind==="dream"?(c.dream||"dream"):c.kind==="work"?"work":c.name,
       b.x,b.y-13);
   }
  }
  ellipse(ctx,rootPos.x,rootPos.y,8,"#e3bf87");ellipse(ctx,rootPos.x,rootPos.y,3,"#fff4cb");
  ctx.textAlign="left";ctx.fillStyle="#e9e5d7bd";ctx.font=Math.round(Math.max(12,w/78))+"px ui-monospace,monospace";
  ctx.fillText("LIFE · "+life.age,w*.035,h*.07);
  ctx.font=Math.round(Math.max(10,w/105))+"px ui-monospace,monospace";
  ctx.fillStyle="#d4dbc9a3";ctx.fillText(story.scene.toUpperCase()+" / SEED "+life.seed,w*.035,h*.07+23);
  ctx.restore();
 }
 const api={render,coords,COLORS};
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 root.LifeScene=api;
})(typeof window!=="undefined"?window:globalThis);
