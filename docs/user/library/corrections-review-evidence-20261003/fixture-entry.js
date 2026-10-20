// Independent simulated-data review. Actual List/Picker/Header/filter components;
// theme, fonts, icons and images mocked; no auth, database or books services.
import React from 'react';
import {AppRegistry, Pressable, Text, View} from 'react-native';
import {LibraryBookList} from '../../../../src/components/library/LibraryBookList';
import {LibraryBookPicker} from '../../../../src/components/library/LibraryBookPicker';
import {LibraryHeader} from '../../../../src/components/library/LibraryHeader';
import {LibraryFilterBar} from '../../../../src/components/library/LibraryFilterBar';
import {LibrarySummary} from '../../../../src/components/library/LibrarySummary';
import {getLibraryFilterChips,filterLibraryBooks} from '../../../../src/features/books/utils/libraryShelf';
import {FixtureTheme} from './fixture-theme';
const h=React.createElement;
const makeBooks=n=>Array.from({length:n},(_,i)=>({id:`independent-${i}`,ownership:i%4===0?'wishlist':i%9===0?null:'owned',reading_status:i%2?'reading':'completed',book:{title:i<2?'Duplicate title':i===2?'A full long title '.repeat(15):`Fixture Book ${i+1}`,authors:i%3?['Fixture Author']:null,cover_url:null,page_count:i%3?430:null}}));
function Fixture(){
 const [books,setBooks]=React.useState(()=>makeBooks(1000));
 const [mode,setMode]=React.useState('list'),[filter,setFilter]=React.useState('all'),[selected,setSelected]=React.useState('None');
 const filtered=React.useMemo(()=>filterLibraryBooks(books,filter),[books,filter]);
 const control=(name,fn)=>h(Pressable,{key:name,accessibilityRole:'button',accessibilityLabel:name,onPress:fn,style:{minHeight:44,padding:8,backgroundColor:'#fffdf8',margin:2}},h(Text,{},name));
 const header=h(View,null,h(LibraryHeader,{viewMode:mode,onViewModeChange:setMode,onSearch:()=>{},focusSelectedView:true}),h(LibraryFilterBar,{chips:getLibraryFilterChips(books),activeFilter:filter,onChange:setFilter}),h(LibrarySummary,{count:filtered.length,activeFilterLabel:filter}));
 return h(FixtureTheme.Provider,{value:{phase:'daylight'}},h(View,{style:{flex:1,backgroundColor:'#faf6ee'}},
  h(Text,{style:{fontSize:15}},'Independent fixture: simulated data; presentation assets mocked'),
  h(View,{style:{flexDirection:'row',flexWrap:'wrap'}},control('Empty',()=>setBooks([])),control('Single',()=>setBooks(makeBooks(1))),control('Large',()=>setBooks(makeBooks(1000))),control('Replace after opening',()=>setTimeout(()=>setBooks(makeBooks(4)),2000))),
  h(Text,{testID:'fixture-selection'},`Selected ID: ${selected}`),
  h(View,{style:{flex:1,width:'100%',maxWidth:600,alignSelf:'center',paddingHorizontal:24}},mode==='list'?h(LibraryBookList,{books:filtered,activeFilter:filter,activeFilterLabel:filter,isRefetching:false,onRefresh:()=>setBooks(makeBooks(4)),onBookPress:b=>setSelected(b.id),header}):h(View,{style:{flex:1}},header,h(LibraryBookPicker,{books:filtered,onBookPress:b=>setSelected(b.id)})))));
}
AppRegistry.registerComponent('IndependentReviewFixture',()=>Fixture);
AppRegistry.runApplication('IndependentReviewFixture',{rootTag:document.getElementById('root')});
