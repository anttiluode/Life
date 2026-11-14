/* Life — offline state-conditioned generative storytelling.
   This isn't a hosted LLM. Narrative variations are composed locally from
   authored fragments and actual events. Never call life.R(): rendering must
   not change the simulation's random state.
*/
(function(root){
 "use strict";
 const EVENT={
  meet:{scene:"evening",lines:["A stranger enters the ordinary day, and for a moment it seems less ordinary.","A conversation lasts only minutes. The space it leaves behind is much larger.","Nothing announces a beginning. Sometimes a beginning is just a name you remember."]},
  child:{scene:"home",lines:["The question arrives quietly, as questions that rearrange a life often do.","There is room at the table for someone who does not yet exist. There is also everything you would have to give.","A child is not a branch on a chart. A child is another life whose future you cannot choose."]},
  friend:{scene:"street",lines:["Someone has invited you into their Saturday.","The city has a thousand rooms you will never enter. Someone opens one door.","A friendship can begin with something as small as showing up."]},
  dream:{scene:"studio",lines:["An idea refuses to disappear even when you stop looking at it.","Some possible lives are quieter than others. That does not make them less real.","What you might make has been waiting without knowing your name."]},
  old:{scene:"rain",lines:["A familiar name lights up a screen. The years between you do not fit inside a message.","The past does not return, but someone who knew it can still knock.","An old connection reaches across the gap without knowing whether anyone is there."]},
  ill:{scene:"home",lines:["The telephone rings and the world acquires a before and an after.","Someone who once carried you needs something that cannot be counted cleanly.","There is a cost to being present. There is also a cost to not being present."]},
  pill:{scene:"home",lines:["Illness has its own calendar, and it does not ask permission.","The person beside you is still the same person, even when routines change.","Love becomes a collection of small practical acts."]},
  teen:{scene:"rain",lines:["A call comes from school. You listen for what is being left unsaid.","Someone is growing away from you at precisely the age they still need you.","The person asking for help may not know how to ask."]},
  promo:{scene:"city",lines:["A new title arrives with an older bargain hidden inside it.","The office offers more money, and asks for hours that belong to someone else.","A promotion is a doorway with a price attached."]},
  move:{scene:"train",lines:["Another city sends an invitation addressed to your ambition.","The train goes somewhere. It also leaves something behind.","You can imagine the new streets more clearly than the distance from the old ones."]},
  house:{scene:"home",lines:["The rooms are empty now. In your mind they are already full.","A house is a shape made out of money, patience, and weather.","The keys have weight even before they are yours."]},
  layoff:{scene:"city",lines:["An envelope becomes a door closing.","The company made a decision. The morning still has to be lived.","For a moment the work branch stops carrying light."]},
  job:{scene:"train",lines:["A job is available. It is not a dream.","Work can keep the lights on even when it gives little back.","The offer is ordinary. Your need for it is not."]},
  midlife:{scene:"night",lines:["At four in the morning there are no meetings, no errands, and no good places to hide the question.","The clock moves. Something in you refuses to move with it.","You wake before dawn, surrounded by all the things that ought to have been enough."]}
 };
 function hash(){
  let h=2166136261>>>0;
  for(const ch of Array.from(arguments).join("|")){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
  return h>>>0;
 }
 function pick(a){return a[hash.apply(null,Array.prototype.slice.call(arguments,1))%a.length]}
 function theme(l){
  if(l.warmth<26)return "cold";
  if(l.health<25)return "fragile";
  if(l.warmth>76)return "warm";
  if(l.money<0)return "strained";
  return "middle";
 }
 function eventStory(life,e,roll){
  const meta=EVENT[e.id]||{scene:"evening",lines:["A choice appears between one ordinary moment and the next.","You know what is being asked. You cannot know everything it will change.","The future arrives without an explanation."]};
  const first=pick(meta.lines,life.seed,life.age,e.id,roll);
  return {title:e.title.replace(/[.!?]+$/,""),body:first+" "+e.text,
   scene:meta.scene,label:"A fork · age "+life.age,
   speak:first+" "+e.text,tag:e.id};
 }
 const AGES=[
  {max:24,title:"The first rooms",lines:["At this age the years still seem to stretch ahead without edges.","You can spend a whole afternoon without thinking how many remain.","The future has not yet learned to look ordinary."]},
  {max:34,title:"Learning the weight",lines:["The days are beginning to resemble the choices that built them.","The people you know are becoming part of the architecture of an ordinary Tuesday.","A few years pass before you notice that a habit has become a life."]},
  {max:49,title:"The middle distance",lines:["There is more history inside each conversation now.","You have become responsible for more than you can hold at once.","The years stop asking who you might be and begin asking who you already are."]},
  {max:64,title:"What remains",lines:["The past is no longer a small place.","Some things are easier now, and others ask to be learned again.","Your days contain the accumulated weight of people who have known you."]},
  {max:79,title:"The slower light",lines:["The calendar is gentler in some places and less forgiving in others.","Certain memories arrive before the names attached to them.","You discover how much of a day can fit inside a familiar ritual."]},
  {max:200,title:"Old wood",lines:["There are names you can say without speaking aloud.","Much of your life is now something you carry, not something you can revisit.","The branches that remain do not tell the whole story of those that grew."]}
 ];
 function yearStory(life,roll){
  const stage=AGES.find(x=>life.age<=x.max),key=[life.seed,life.age,roll];
  const lines=[pick(stage.lines,...key,"stage")];
  const warm=life.warmth>72?[
   "The house is not necessarily full, but warmth moves through its rooms.",
   "Somewhere in the day, someone makes room for you.",
   "The strongest threads have held through another ordinary year."]:
  life.warmth<26?[
   "The rooms answer more quietly than you remember.",
   "Some voices have become difficult to reach, even when their names are close.",
   "There are evenings when the silence feels like an extra piece of furniture."]:
  ["Warmth arrives in uneven amounts, rarely where arithmetic says it should.",
   "Some connections ask for more than they give; others give without being asked.",
   "The ordinary work of caring for people continues without an audience."];
  lines.push(pick(warm,...key,"warmth"));
  const recent=life.log.filter(l=>l.age>=life.age-1&&["loss","grief"].includes(l.tone));
  const anchors=life.channels.filter(c=>c.alive&&["partner","child","friend","parent"].includes(c.kind))
    .sort((a,b)=>b.D-a.D).slice(0,1);
  if(recent.length&&roll%3!==2)lines.push(pick([
    "Some absences are noticed in the middle of an unrelated task.",
    "A name remains in the shape of the day even when its owner does not.",
    "Grief changes the rhythm of a room without moving its furniture."],...key,"loss"));
  else if(life.health<30)lines.push(pick([
    "Your body asks for more patience than your plans allowed.",
    "Even the smallest errand seems to have its own weather.",
    "You begin planning the day around what your strength will permit."],...key,"health"));
  else if(life.money<0)lines.push(pick([
    "Money leaves faster than it arrives. Every choice carries another price.",
    "The bills have a rhythm you did not choose.",
    "There is a tiredness that comes from calculating what can wait."],...key,"money"));
  else if(anchors.length)lines.push(pick([
    anchors[0].name+" remains part of the shape of your days.",
    "You have said "+anchors[0].name+"'s name often enough that it feels like a place.",
    "Some of the year's quiet moments belong to "+anchors[0].name+"."],...key,"anchor"));
  else lines.push(pick([
    "A quiet life is still a life crowded with details.",
    "You have learned to keep your own company, not always easily.",
    "There is meaning here that no visitor could measure."],...key,"alone"));
  const tag=theme(life),scene=tag==="warm"?"home":tag==="cold"?"rain":tag==="fragile"?"night":
    tag==="strained"?"city":pick(["garden","evening","street","train","home"],...key,"scene");
  const title=pick([stage.title,life.age+" · The ordinary year",
    tag==="warm"?"Rooms with the lights on":tag==="cold"?"The quiet rooms":"One more season"],...key,"title");
  return {title,body:lines.join(" "),scene,tag,label:"The story continues · age "+life.age,speak:lines.join(" ")};
 }
 function endStory(life,roll){
  const L=typeof module!=="undefined"&&module.exports?require("./life.js"):root.LifeModel;
  const e=L.epitaph(life);
  const first=e.children>0?"There were "+e.children+" children in the life you made.":
    life.channels.some(c=>c.kind==="dream")?"Something you wanted to make remained part of the story.":"Not every life is marked by a family tree.";
  const second=e.funeral>0?"At the end, "+e.funeral+" came. Some knew the person you became; others remembered who you had been.":
    "At the end, the room was quiet. That does not make all the years before it empty.";
  const third=pick([
    "There is no number here that can tell you whether this life was enough.",
    "What you gave did not always return in the form you expected.",
    "A life is not its final balance. It is what happened between its beginnings and endings."
  ],life.seed,life.age,roll);
  return {title:"The shape you leave",body:first+" "+second+" "+third,scene:"night",tag:"end",
   label:"The last chapter · age "+e.age,speak:first+" "+second,epitaph:e};
 }
 function describe(life,roll=0){
  return !life.alive?endStory(life,roll):life.pending.length?eventStory(life,life.pending[0],roll):yearStory(life,roll);
 }
 const api={describe,eventStory,yearStory,endStory,hash};
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 root.LifeStory=api;
})(typeof window!=="undefined"?window:globalThis);
