// Static review harness: actual shelf/spine/layout source with mocked platform effects.
// It verifies browser layout/overflow only, not production gesture or animation behavior.
const fs = require('fs'), path = require('path'), ts = require('typescript');
const React = require('react'), {renderToStaticMarkup} = require('react-dom/server');
const RN = require('react-native-web');
const cache = new Map();
function load(filename) {
  filename = path.resolve(filename);
  if(cache.has(filename)) return cache.get(filename).exports;
  const module = {exports:{}}; cache.set(filename,module);
  function resolve(name) {
    if(name==='react-native') return RN;
    if(name==='expo-haptics') return {impactAsync:async()=>{},ImpactFeedbackStyle:{Light:'Light'}};
    if(name==='expo-image') return {Image:({source,contentFit,...props})=>React.createElement(RN.Image,{...props,source,resizeMode:contentFit==='fill'?'stretch':'cover'})};
    if(name==='@expo/vector-icons') return {Ionicons:()=>null};
    if(name==='expo-linear-gradient') return {LinearGradient:({colors,locations,start,end,...props})=>React.createElement(RN.View,{...props,style:[props.style,{backgroundImage:`linear-gradient(${start?.x===0&&end?.x===1?'90deg':'180deg'},${colors.join(',')})`}]})};
    if(name==='react-native-reanimated') return {__esModule:true,default:{View:RN.View},useReducedMotion:()=>true,useSharedValue:v=>({value:v}),useAnimatedStyle:f=>{const s=f();return 'opacity' in s?{opacity:1,transform:[{translateY:0}]}:s;},withTiming:v=>v,Easing:{bezier:()=>()=>0}};
    if(name.endsWith('LibraryTypography')) return {useLibraryTypography:()=>({serif:'Georgia',heading:'Georgia',body:'Arial',label:'Arial'})};
    if(name==='@/hooks/useTheme') return {useTheme:()=>({phase:'midnight'})};
    if(name.startsWith('@/')||name.startsWith('.')) {
      const base = name.startsWith('@/')?path.resolve('src',name.slice(2)):path.resolve(path.dirname(filename),name);
      for(const ext of ['.ts','.tsx']) if(fs.existsSync(base+ext)) return load(base+ext);
    }
    return require(name);
  }
  const js=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
  new Function('exports','require','module',js)(module.exports,resolve,module);
  return module.exports;
}
const {LibraryShelf}=load('src/components/library/LibraryShelf.tsx');
const {LibraryFilterBar}=load('src/components/library/LibraryFilterBar.tsx');
const {getLibraryFilterChips}=load('src/features/books/utils/libraryShelf.ts');
const books=Array.from({length:40},(_,i)=>({id:'fixture-'+i,reading_status:i%2?'reading':'completed',ownership:'owned',book:{title:i===0?'Very long title '.repeat(20):i%3?'Duplicate Title':'The Science of Dune',authors:null,cover_url:null,page_count:i%4?430:null}}));
const markup=renderToStaticMarkup(React.createElement(RN.View,{style:{width:'100%',maxWidth:600,padding:24}},
  React.createElement(RN.Text,{},'Review fixture — actual components; effects mocked; 40 books / null authors and covers / long and duplicate titles'),
  React.createElement(LibraryFilterBar,{chips:getLibraryFilterChips(Array.from({length:10000},()=>books[0])),activeFilter:'all',onChange:()=>{}}),
  React.createElement(LibraryShelf,{books,onBookPress:()=>{}})));
const css=RN.StyleSheet.getSheet();
fs.writeFileSync(path.join(__dirname,'fixtures.html'),`<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css.textContent}body{margin:0;background:#211e1a;color:#f3eada}</style><body>${markup}</body></html>`);
console.log('Generated actual-component static fixture. Platform animation/haptics/audio mocked; no production interaction certification.');
