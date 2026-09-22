'use strict';
/* Local, offline display localization. Gameplay IDs, option values and saves remain
 * language-neutral. Existing text nodes are updated in place, so an open puzzle,
 * its selections, keyboard focus, scroll position and event handlers survive a switch.
 * Source strings are kept per node; no reverse translation or HTML injection. */
(function(){
 const STORE='palace:lang:v1',dict=window.PALACE_EN;
 let lang='zh';try{if(localStorage.getItem(STORE)==='en')lang='en';}catch(e){/* optional preference */}
 const hasHan=s=>/[\u3400-\u9fff]/.test(s);
 const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const pattern=new RegExp(Object.keys(dict).sort((a,b)=>b.length-a.length).map(escape).join('|'),'g');
 const cache=new Map(),texts=new WeakMap(),attributes=new WeakMap();
 function english(source){
  if(!hasHan(source))return source;
  if(cache.has(source))return cache.get(source);
  const value=Object.hasOwn(dict,source)?dict[source]:source.replace(pattern,k=>dict[k])
   .replaceAll('。','. ').replaceAll('，',', ').replaceAll('：',': ').replaceAll('；','; ').replaceAll('「','“').replaceAll('」','”').replaceAll('【','[').replaceAll('】',']');
  cache.set(source,value);return value;
 }
 const skip='script,style,noscript,[data-language-toggle],[data-no-translate]';
 function text(node){
  if(!node.parentElement||node.parentElement.closest(skip))return;
  const current=node.nodeValue,old=texts.get(node);
  const source=old&&current===old.rendered?old.source:current;
  if(!old&&!hasHan(source))return;
  const rendered=lang==='en'?english(source):source;
  texts.set(node,{source,rendered});
  if(current!==rendered)node.nodeValue=rendered;
 }
 const names=['aria-label','title','alt','placeholder'];
 function attrs(el){
  if(el.closest(skip))return;
  let values=attributes.get(el);if(!values){values={};attributes.set(el,values);}
  for(const name of names){
   if(!el.hasAttribute(name))continue;
   const current=el.getAttribute(name),old=values[name];
   const source=old&&current===old.rendered?old.source:current;
   if(!old&&!hasHan(source))continue;
   const rendered=lang==='en'?english(source):source;
   values[name]={source,rendered};if(current!==rendered)el.setAttribute(name,rendered);
  }
 }
 function walk(root){
  if(root.nodeType===Node.TEXT_NODE){text(root);return;}
  if(root.nodeType!==Node.ELEMENT_NODE)return;
  if(root.closest(skip))return;
  attrs(root);
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT,{
   acceptNode:n=>n.nodeType===Node.ELEMENT_NODE&&n.matches(skip)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT
  });
  while(walker.nextNode()){const n=walker.currentNode;n.nodeType===Node.TEXT_NODE?text(n):attrs(n);}
 }
 const options={subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:names};
 const observer=new MutationObserver(records=>{
  observer.disconnect();
  const roots=new Set();for(const record of records){
   if(record.type==='childList')for(const n of record.addedNodes)roots.add(n);
   else roots.add(record.target);
  }
  for(const root of roots)if(root.isConnected)walk(root);
  observer.observe(document.documentElement,options);
 });
 function refresh(){
  observer.disconnect();
  document.documentElement.lang=lang==='en'?'en':'zh-CN';
  document.body.classList.toggle('lang-en',lang==='en');
  walk(document.documentElement);
  for(const b of document.querySelectorAll('[data-language-toggle]')){
   b.textContent=lang==='en'?'中文':'EN';
   b.setAttribute('aria-label',lang==='en'?'Switch to Chinese':'切换至英文');
   b.title=lang==='en'?'中文 / English':'English / 中文';
  }
  observer.observe(document.documentElement,options);
 }
 function setLang(value){
  if(value!=='en'&&value!=='zh')return;
  lang=value;try{localStorage.setItem(STORE,value);}catch(e){/* gameplay unaffected */}
  refresh();window.dispatchEvent(new CustomEvent('palace:langchange',{detail:{lang:value}}));
 }
 window.I18N=Object.freeze({get lang(){return lang;},setLang,toggle:()=>setLang(lang==='en'?'zh':'en'),translate:english,refresh});
 document.querySelectorAll('[data-language-toggle]').forEach(b=>b.addEventListener('click',()=>setLang(lang==='en'?'zh':'en')));
 refresh();
})();
