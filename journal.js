/* Life — deterministic journal, designed for browsers and Node.
   Saving closures or just JSON.stringify(life) breaks future random events.
   Replaying decisions against the original seeded model restores them exactly.
   The journal contains no real personal information unless a player manually adds it.
*/
(function(root){
 "use strict";
 const L=typeof module!=="undefined"&&module.exports?require("./life.js"):root.LifeModel;
 const VERSION=1,MAX=12000,MAX_SEED=2147483647;
 function validSeed(seed){
  return Number.isSafeInteger(seed)&&seed>=1&&seed<=MAX_SEED;
 }
 function newJournal(seed){
  if(!validSeed(seed))throw Error("Invalid seed");
  return {version:VERSION,seed,commands:[]};
 }
 function verify(j){
  if(!j||typeof j!=="object"||j.version!==VERSION||!validSeed(j.seed)||
   !Array.isArray(j.commands)||j.commands.length>MAX)throw Error("Unrecognized or oversized life");
  for(const c of j.commands){
   if(!c||typeof c!=="object"||!["pour","choice","year"].includes(c.op))throw Error("Invalid life action");
   if(c.op==="pour" && !((c.id==="self"||Number.isInteger(c.id)&&c.id>=1&&c.id<10000)
       &&Number.isInteger(c.value)&&c.value>=0&&c.value<=8))throw Error("Invalid allocation");
   if(c.op==="choice"&&!(typeof c.event==="string"&&c.event.length<80
      &&Number.isInteger(c.n)&&c.n>=0&&c.n<10))throw Error("Invalid choice");
  }
  return j;
 }
 function apply(life,c){
  switch(c.op){
   case "pour":{
    const target=c.id==="self"?true:!!L.alive(life).find(x=>x.id===c.id);
    if(!life.alive||!target)throw Error("No matching life branch");
    L.setDrops(life,c.id,c.value);return;
   }
   case "choice":{
    const event=life.pending[0];
    if(!life.alive||!event||event.id!==c.event||!event.choices[c.n])throw Error("Timeline fork differs from saved life");
    L.choose(life,0,c.n);return;
   }
   case "year":{
    if(!life.alive||life.pending.length)throw Error("Resolve the chapter before advancing");
    L.advanceYear(life);return;
   }
   default:throw Error("Unknown action");
  }
 }
 function replay(payload){
  const j=verify(payload);
  const life=L.createLife(j.seed);
  for(const cmd of j.commands)apply(life,cmd);
  return life;
 }
 function append(j,life,command){
  verify(j);
  if(j.commands.length>=MAX)throw Error("Journal is full");
  // Validate before committing the action. All actions are deterministic.
  if(command.op==="pour"){
   if(!(command.id==="self"||Number.isInteger(command.id)))throw Error("Bad branch");
   if(!Number.isInteger(command.value)||command.value<0||command.value>8)throw Error("Bad allocation");
  }else if(command.op==="choice"){
   if(typeof command.event!=="string"||!Number.isInteger(command.n))throw Error("Bad choice");
  }else if(command.op!=="year")throw Error("Bad action");
  apply(life,command);j.commands.push({...command});
  return life;
 }
 function rewind(j){
  verify(j);
  const index=j.commands.map((c,i)=>c.op==="year"?i:-1).filter(i=>i>=0);
  if(!index.length)return null;
  const prev=index.length>1?index[index.length-2]:-1;
  return {version:VERSION,seed:j.seed,commands:j.commands.slice(0,prev+1)};
 }
 function compact(j){verify(j);return JSON.stringify(j)}
 const api={newJournal,verify,replay,append,rewind,compact};
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 root.LifeJournal=api;
})(typeof window!=="undefined"?window:globalThis);
