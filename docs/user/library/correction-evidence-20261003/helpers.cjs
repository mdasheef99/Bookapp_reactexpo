// Read-only review fixtures against actual TypeScript helpers; no application/data writes.
const fs = require('fs');
const ts = require('typescript');
function load(path) {
  const module = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('exports', 'require', 'module', js)(module.exports, require, module);
  return module.exports;
}
const shelf = load('src/features/books/utils/shelfLayout.ts');
const filters = load('src/features/books/utils/libraryShelf.ts');
const fixture = (id, status, ownership, title = id, pages = null) => ({ id, reading_status: status, ownership, book: { title, authors: null, cover_url: null, page_count: pages } });
const entries = [fixture('owned-reading', 'reading', 'owned'), fixture('wish-reading', 'reading', 'wishlist'), fixture('owned-completed', 'completed', 'owned'), fixture('wish-completed', 'completed', 'wishlist')];
console.log('FILTER COUNTS', filters.getLibraryFilterChips(entries).map(c => ({ ...c, displayed: filters.filterLibraryBooks(entries, c.key).length })));
function luminance(hex) {
  const c = hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
}
const palette = ['#445a70','#853939','#d6d0c4','#627a4d','#23354a','#b8622c','#454d52','#363a40','#c99a38','#ded6cc','#727a80','#8a9164','#bd7a42','#2e3438'];
console.log('TITLE LABEL REGION CONTRAST (opaque matching background/full-opacity text)', palette.map(bg => { const fg = shelf.spineTextColor(bg); const a = luminance(bg), b = luminance(fg); return { bg, fg, ratio: +((Math.max(a,b)+.05)/(Math.min(a,b)+.05)).toFixed(2) }; }));
console.log('PAGE FIXTURES', [undefined,null,0,-5,NaN,Infinity,'430',1,63,248,252,331,430,10000].map(pages=>({pages:String(pages),...shelf.spineMetrics(123,pages)})));
console.log('COLLECTION FIXTURES', [0,1,40,1000].map(n => {
  const books = Array.from({length:n},(_,i)=>fixture('fixture-'+i,'reading','owned',i%2 ? 'Duplicate' : 'Very long title '.repeat(20),i%3?430:null));
  const {top,bottom} = shelf.splitShelfRows(books); const layout=shelf.getShelfTrackLayout(top,bottom,272);
  const large=shelf.getShelfTrackLayout(top,bottom,552);
  return { n, top:top.length,bottom:bottom.length,contentWidth:layout.contentWidth,uniqueIds:new Set(layout.bookLayouts.map(b=>b.id)).size,stableWidths:layout.bookLayouts.every((b,i)=>b.width===large.bookLayouts[i].width),firstOffset:layout.bookLayouts[0]?.offsetLeft };
}));
const short = fixture('short','reading','owned','Short',100);
const metrics=shelf.spineMetrics(shelf.stableSeed(short.id,short.book.title),100);
const layout=shelf.getShelfTrackLayout([short],[],340);
console.log('BRUSH ABOVE VISIBLE BOOK', {visibleBookTop:32+160-metrics.height,touchY:33,result:shelf.resolveSweptSpine({scrollX:0,touchX:20,touchY:33,rowGeometry:{top:{y:32,height:160},bottom:{y:268,height:160}},bookLayouts:layout.bookLayouts})});
