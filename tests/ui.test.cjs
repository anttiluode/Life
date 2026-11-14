/* Dependency-free headless browser smoke test for LIFE's actual controller.
 * Simulates DOM, canvas and localStorage; exercises choices, saves and rewind.
 */
const assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const root=path.resolve(__dirname,"..");
class ClassList{
 constructor(classes=""){this.items=new Set(classes.split(/\s+/).filter(Boolean))}
 add(x){this.items.add(x)} remove(x){this.items.delete(x)}
 contains(x){return this.items.has(x)}
 toggle(x,force){const yes=force===undefined?!this.items.has(x):!!force;
  if(yes)this.items.add(x);else this.items.delete(x);return yes;}
}
const stubGradient={addColorStop(){}};
function fakeContext(){
 const c={};
 const names=["save","restore","beginPath","clearRect","fillRect","moveTo","lineTo",
 "bezierCurveTo","ellipse","arc","stroke","fill","fillText","setTransform","drawImage",
 "strokeRect"];
 for(const n of names)c[n]=()=>{};
 c.createLinearGradient=()=>stubGradient;c.createRadialGradient=()=>stubGradient;
 return c;
}
class Element{
 constructor(id="",classes=""){this.id=id;this.classList=new ClassList(classes);this.style={};
 this.children=[];this.attributes={};this.listeners={};this._text="";this._value="";this.disabled=false;
 this.width=id==="endCanvas"?800:1000;this.height=id==="endCanvas"?940:920;this.files=[]}
 set textContent(t){this._text=String(t);this.children=[{textContent:this._text,nodeType:3}]}
 get textContent(){return this._text}
 set value(v){this._value=v}get value(){return this._value}
 get firstChild(){return this.children[0]||null}
 append(...nodes){this.children.push(...nodes)}
 replaceChildren(...nodes){this.children=[...nodes];this._text=""}
 setAttribute(a,v){this.attributes[a]=v}
 addEventListener(type,fn){(this.listeners[type]??=[]).push(fn)}
 click(){if(this.disabled)return;if(typeof this.onclick==="function")this.onclick({target:this});
  for(const fn of this.listeners.click||[])fn({target:this});}
 getContext(){if(!this.ctx)this.ctx=fakeContext();return this.ctx}
 getBoundingClientRect(){return {width:900,height:650,left:0,top:0}}
 toBlob(fn){fn({fakeBlob:true})}
 remove(){}
}
const markup=fs.readFileSync(path.join(root,"index.html"),"utf8");
const elements=new Map();
for(const match of markup.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)){
 const frag=match[0],c=/class="([^"]*)"/.exec(frag);
 elements.set(match[1],new Element(match[1],c?c[1]:""));
}
const required=["intro","fork","saves","voices","ending","worldCanvas","saveButton","beginButton",
 "resumeButton","yearButton","fiveButton","forkChoices","newButton","endAgain","copyChronicle"];
for(const id of required)assert(elements.has(id),"missing HTML element "+id);
let stored=new Map();
function runBrowser(){
 const calls=[];
 const doc={
  getElementById(id){if(!elements.has(id))throw Error("Unknown DOM id "+id);return elements.get(id);},
  createElement(tag){return new Element("generated:"+tag)},
  createTextNode(text){return {textContent:String(text),nodeType:3}},
  body:{append(){}},addEventListener(name,fn){calls.push({name,fn})},
  activeElement:{tagName:"BODY"},hidden:false
 };
 const storage={
  getItem(k){return stored.has(k)?stored.get(k):null},
  setItem(k,v){stored.set(k,String(v))},removeItem(k){stored.delete(k)}
 };
 const browser={
  crypto:{getRandomValues(a){a[0]=123400;return a;}},
  devicePixelRatio:1,
  addEventListener(name,fn){calls.push({name,fn})}
 };
 const ctx=vm.createContext({
  window:browser,document:doc,localStorage:storage,
  location:{search:"?seed=1105",origin:"https://example.invalid",pathname:"/Life/"},
  history:{replaceState(){}},navigator:{clipboard:{writeText:async()=>{}}},
  URLSearchParams,URL:{createObjectURL(){return "blob:fake"},revokeObjectURL(){}},
  Image:class{constructor(){this.complete=false;this.naturalWidth=0}},
  Blob,classList:ClassList,confirm:()=>true,prompt:()=>"",
  performance:{now:()=>1000},requestAnimationFrame:()=>{},
  setTimeout:()=>1,clearTimeout:()=>{},console,
 });
 for(const src of ["life.js","journal.js","story.js","scene.js","art/manifest.js","app.js"])
  vm.runInContext(fs.readFileSync(path.join(root,src),"utf8"),ctx,{filename:src});
 return {browser,ctx,calls};
}
const first=runBrowser();
const $=id=>elements.get(id);
assert.equal($("ageNumber").textContent,"18");
$("beginButton").click();
assert($("intro").classList.contains("hidden"),"begin closes intro");
let years=0,events=0;
for(let i=0;i<380;i++){
 if(!$("ending").classList.contains("hidden"))break;
 if(!$("fork").classList.contains("hidden")){
  const btn=$("forkChoices").children[0];
  assert(btn,"event needs a choice");
  btn.click();events++;
 }else{
  $("yearButton").click();years++;
 }
}
assert(!$("ending").classList.contains("hidden"),"reached the ending");
assert(years>=10&&events>0,"life had actual years and decisions");
assert(stored.has("life-2026-autosave-v1"),"every life should autosave");
const age=$("ageNumber").textContent;
$("saveButton").click();
assert(!$("saves").classList.contains("hidden"));
const row=$("saveSlots").children[0];
assert(row,"save slot present");
row.children[1].children[0].click();
assert(stored.has("life-2026-slot-0"));
$("closeSaves").click();
$("bookButton").click();
assert(!$("bookModal").classList.contains("hidden"),"storybook opens");
assert($("bookChapters").children.length>=years,"storybook records all years");
assert($("bookPageText").textContent.length>25,"chapter prose is visible");
$("bookChapters").children[0].click();
assert($("bookPageTitle").textContent.length>4,"old chapters are readable");
$("closeBook").click();
$("saveSceneButton").click();
$("portraitButton").click();
$("newButton").click();
assert(!$("intro").classList.contains("hidden"),"new game returns to intro");
$("resumeButton").click();
assert.equal($("ageNumber").textContent,age,"resuming does not change age");
$("saveButton").click();
$("undoButton").click();
assert(Number($("ageNumber").textContent)<Number(age),"rewind returns earlier year");
$("rerollButton").click();
assert($("storyTitle").textContent&&$("storyText").textContent);
$("readButton").click(); // no voices: gracefully show an explanatory toast.
assert($("toast").textContent.includes("local voice"));
console.log("PASS: actual browser controller boot, "+years+" years, "+events+" forks, ending, save slots, storybook, PNG exports, resume, rewind, scene re-tell, local-only voice fallback.");
