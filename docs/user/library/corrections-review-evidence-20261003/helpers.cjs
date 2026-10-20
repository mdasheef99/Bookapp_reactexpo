const fs=require('fs'),ts=require('typescript'),assert=require('assert/strict');
function load(path){const m={exports:{}};new Function('exports','require','module',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(m.exports,require,m);return m.exports;}
const s=load('src/features/books/utils/shelfLayout.ts'),f=load('src/features/books/utils/libraryShelf.ts');
const entry=(id,status,ownership,pages=null)=>({id,reading_status:status,ownership,book:{title:id,authors:null,page_count:pages}});
const statuses=[null,'want_to_read','reading','completed'],owners=[null,'owned','borrowed','lent_out','wishlist'];
const books=statuses.flatMap(st=>owners.map(o=>entry(`${st}-${o}`,st,o)));
for(const data of [[],books,...owners.map(o=>books.map((b,i)=>i===0?{...b,ownership:o}:b))]) for(const c of f.getLibraryFilterChips(data)) assert.equal(c.count,f.filterLibraryBooks(data,c.key).length);
console.log('R3 exhaustive status/ownership combinations, empty and ownership transitions: PASS',f.getLibraryFilterChips(books));
const palette=['#445a70','#853939','#d6d0c4','#627a4d','#23354a','#b8622c','#454d52','#363a40','#c99a38','#ded6cc','#727a80','#8a9164','#bd7a42','#2e3438'];
const lum=hex=>{const c=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
const pairs=palette.map(bg=>{const fg=s.spineTextColor(bg),a=lum(bg),b=lum(fg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);assert.ok(ratio>=4.5);return{bg,fg,ratio:+ratio.toFixed(3)};});console.log('R2 all 14 corrected color pairs PASS',pairs);
const rg={top:{y:32,height:160},bottom:{y:268,height:160}};
let checks=0;
for(const n of [0,1,40,1000]){
 const data=Array.from({length:n},(_,i)=>entry(`book-${i}`,'reading','owned',i%2?63:430)),{top,bottom}=s.splitShelfRows(data),l=s.getShelfTrackLayout(top,bottom,272),wide=s.getShelfTrackLayout(top,bottom,552);
 assert.equal(l.bookLayouts.length,n);assert.equal(new Set(l.bookLayouts.map(x=>x.id)).size,n);
 assert.deepEqual(l.bookLayouts,wide.bookLayouts);
 for(const b of l.bookLayouts){
  const match=(x,y,scroll=0)=>s.resolveSweptSpine({scrollX:scroll,touchX:x-scroll,touchY:y,rowGeometry:rg,bookLayouts:l.bookLayouts});
  const y=rg[b.row].y+160-b.height,end=rg[b.row].y+160;
  const source=data.find(e=>e.id===b.id);assert.deepEqual({width:b.width,height:b.height},s.spineMetrics(s.stableSeed(source.id,source.book.title),source.book.page_count));
  for(const scroll of [0,137]){assert.equal(match(b.offsetLeft,y,scroll),b.id);assert.equal(match(b.offsetLeft,y-.01,scroll),null);assert.equal(match(b.offsetLeft,end-.01,scroll),b.id);assert.equal(match(b.offsetLeft,end,scroll),null);assert.equal(match(b.offsetLeft+b.width,y,scroll),null);checks+=5;}
 }
 console.log('R4 neutral geometry fixture',n,'books /',l.contentWidth,'track width: PASS');
}
console.log('R4 exact top/bottom/left/right bounds + nonzero scroll assertions PASS',checks);
for(const pages of [undefined,null,NaN,Infinity,-10,0,'430'])assert.equal(s.spineMetrics(100,pages).width,32);
for(const pages of [1,63,248,252,331,430,10000])assert.equal(s.spineMetrics(100,pages).width,Math.round(Math.min(44,Math.max(24,20+.04*pages))));
console.log('Page contract and height independence: PASS');
