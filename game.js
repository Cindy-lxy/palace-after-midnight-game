'use strict';
const $=s=>document.querySelector(s), BASE=new URL('assets/',document.currentScript.src).href;
const SAVE='palace:escape:v3';
const fresh=()=>({v:3,room:0,x:12,y:12,facing:'down',inv:[],got:[],notes:['start'],flags:{},hints:{},visited:[0],ending:null,actions:0,pending:0});
let pendingPrompt=0;
let s=fresh(),active=false,selected=null,combining=false,path=[],afterWalk=null,lastStep=0,storageOK=true;
let chase={active:false,kind:1,gx:0,gy:0,mode:'hunt',hide:null,ghostTimer:0,waitSince:0};
const keys=new Set();
const FACING_LABELS={up:'向上 · 背面',down:'向下 · 正面',left:'向左 · 左侧面',right:'向右 · 右侧面'};
const SPRITES=Object.fromEntries(Object.keys(FACING_LABELS).map(dir=>[dir,BASE+'player-'+dir+'.webp']));
function renderFacing(){const dir=FACING_LABELS[s.facing]?s.facing:'down';const image=$('#player img');$('#player').dataset.facing=dir;if(image.src!==SPRITES[dir])image.src=SPRITES[dir];image.alt='像素角色：'+FACING_LABELS[dir];}
function face(dir){s.facing=dir;renderFacing();}
const plain=x=>x&&typeof x==='object'&&!Array.isArray(x);
const validSave=x=>plain(x)&&[2,3].includes(x.v)&&Number.isInteger(x.room)&&!!ROOMS[x.room]&&Number.isInteger(x.x)&&x.x>=2&&x.x<=21&&Number.isInteger(x.y)&&x.y>=7&&x.y<=15&&Array.isArray(x.inv)&&x.inv.every(i=>Object.hasOwn(ITEMS,i))&&Array.isArray(x.got)&&x.got.every(i=>Object.hasOwn(ITEMS,i))&&Array.isArray(x.notes)&&x.notes.length>0&&x.notes.every(n=>Object.hasOwn(NOTES,n))&&plain(x.flags)&&Object.values(x.flags).every(v=>typeof v==='boolean')&&plain(x.hints)&&Object.values(x.hints).every(v=>Number.isInteger(v)&&v>=0)&&[null,'justice','together','solo'].includes(x.ending)&&Array.isArray(x.visited)&&x.visited.every(r=>Number.isInteger(r)&&!!ROOMS[r])&&Number.isInteger(x.actions)&&x.actions>=0&&(x.pending===undefined||[0,1,2].includes(x.pending));
function load(){try{const raw=localStorage.getItem(SAVE);const x=JSON.parse(raw===null?localStorage.getItem('palace:escape:v2'):raw);if(!validSave(x))return null;x.v=3;x.pending=x.pending||0;if(!FACING_LABELS[x.facing])x.facing='down';x.flags.truth=!!(x.flags.verified===true&&x.flags.sawGhost2&&x.flags.altarRead&&x.flags.dresserRead&&x.got.includes('blood')&&x.got.includes('order'));if(x.ending==='justice'&&!x.flags.truth)x.ending=null;if(x.room===4&&!x.flags.chase1Done)x.pending=1;if(x.room===5&&x.got.includes('blood')&&!x.flags.chase2Done)x.pending=2;return x;}catch(e){return null;}}
function save(){try{localStorage.setItem(SAVE,JSON.stringify(s));$('#saveStatus').textContent='◆ 已自动保存';}catch(e){storageOK=false;$('#saveStatus').textContent='◇ 当前浏览器无法保存';}}
function toast(t){$('#toast').textContent=t;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),2600);}
function button(text,fn,cls=''){const b=document.createElement('button');b.type='button';b.textContent=text;b.className=cls;b.onclick=fn;return b;}
function paragraph(text,parent=$('#panelBody')){const p=document.createElement('p');p.textContent=text;parent.append(p);return p;}
function stop(){path=[];afterWalk=null;keys.clear();$('#player').classList.remove('walking');$('#destination').hidden=true;}
function panel(title,text,tag='调查'){stop();$('#panelTitle').textContent=title;$('#panelTag').textContent=tag;$('#panelBody').replaceChildren();$('#panelActions').replaceChildren();$('#panel').dataset.kind=tag;if(text)paragraph(text);if(!$('#panel').open)$('#panel').showModal();}
function close(){if(s.ending){s.ending=null;save();render();}if($('#panel').open)$('#panel').close();$('#map').focus({preventScroll:true});if(pendingPrompt){const kind=pendingPrompt;pendingPrompt=0;startChase(kind);}}
function action(text,fn,cls=''){const b=button(text,fn,cls);$('#panelActions').append(b);return b;}
function status(text){$('#status').textContent=text;}
function addNote(id){if(!s.notes.includes(id)){s.notes.push(id);toast('新线索已记入线索簿');}}
function give(id){if(s.got.includes(id))return false;s.got.push(id);s.inv.push(id);toast('获得 · '+ITEMS[id].name);return true;}
function consume(id){s.inv=s.inv.filter(i=>i!==id);if(selected===id)selected=null;}
function commit(){s.actions++;save();render();}
function isDone(id){return ({lamp:s.flags.lit,cabinet:s.flags.cabinet,lanterns:s.flags.seasons,mirror:s.flags.clean,box:s.flags.box,slot:s.flags.gate,sideDoor:s.flags.scroll,altar:s.flags.altarRead,dresser:s.flags.dresserRead,niche:s.got.includes('blood'),shrine:s.got.includes('order')})[id];}
function render(){
 const r=ROOMS[s.room];$('#roomName').textContent=r.name;$('#roomSub').textContent=r.sub;$('#roomNumber').textContent=r.mark;
 const image=BASE+'map'+s.room+'.webp';if($('#mapImage').src!==image)$('#mapImage').src=image;$('#mapImage').alt=r.name+'像素地图';
 $('#hotspots').replaceChildren();
 for(const o of r.objects){const b=button('',()=>walkTo(o.stand,()=>inspect(o.id),o.waypoints),'hotspot'+(o.exit!==undefined?' exit':'')+(isDone(o.id)?' done':'')+(HIDE_SPOTS[o.id]?' hide-spot':'')+(chase.active&&HIDE_SPOTS[o.id]?' danger-ready':''));b.dataset.hot=o.id;b.setAttribute('aria-label',o.name);b.style.left=o.x+'%';b.style.top=o.y+'%';
 if(o.exit!==undefined)b.textContent=(o.id==='west'?'← ':'→ ')+o.name.replace('通往','').replace('返回','');else{const d=document.createElement('span');d.className='diamond';const n=document.createElement('span');n.className='hotname';n.textContent=(HIDE_SPOTS[o.id]?'【藏身】':'')+o.name;b.append(d,n);}b.disabled=!active||!!s.ending;$('#hotspots').append(b);}
 $('#player').hidden=!active||!!chase.hide;renderPosition();renderGhost();renderInv();renderSide();
}
const HIDE_SPOTS={wardrobe:1,screen:1,shelter:1};
function renderInv(){
 $('#items').replaceChildren();$('#itemCount').textContent=s.inv.length+' 件';
 if(!s.inv.length){const span=document.createElement('span');span.className='empty';span.textContent='背包空空。先调查身边的物件。';$('#items').append(span);}
 for(const id of s.inv){const b=button('',()=>selectItem(id),'item'+(selected===id?' selected':''));b.dataset.item=id;b.setAttribute('aria-label',ITEMS[id].name);b.setAttribute('aria-pressed',String(selected===id));const icon=document.createElement('span');icon.className='icon';icon.textContent=ITEMS[id].icon;const text=document.createElement('span');text.textContent=ITEMS[id].name;b.append(icon,text);$('#items').append(b);}
 $('#combineBtn').classList.toggle('active',combining);$('#combineBtn').setAttribute('aria-pressed',String(combining));$('#combineBtn').textContent=combining?'取消组合':'◇ 组合物品';
 $('#itemDesc').textContent=combining?(selected?'已选 '+ITEMS[selected].name+'，再点另一件物品尝试组合。':'组合模式：依次选择两件物品。'):(selected?ITEMS[selected].name+' · '+ITEMS[selected].desc:'点击物品选中，再调查场景中的物件来使用。');
}
function renderSide(){
 const stages=[['寝殿开锁',!!s.flags.door],['四时灯序',!!s.flags.seasons],['查明身份',!!(s.flags.altarRead&&s.flags.dresserRead)],['证据复核',!!s.flags.truth],['方位玉匣',!!s.flags.box],['离宫准备',!!(s.flags.gate&&s.flags.bell)]];$('#progress').replaceChildren();let done=0;const next=stages.findIndex(x=>!x[1]);
 stages.forEach(([name,ok],i)=>{const d=document.createElement('div');d.className='step'+(ok?' done':i===next?' current':'');const n=document.createElement('i');n.textContent=ok?'✓':String(i+1);d.append(n,document.createTextNode(name));$('#progress').append(d);if(ok)done++;});$('#progressCount').textContent=done+' / 6';
 const chase2Goal=['路线：下 → 右 → 上',chase.hide?'已经进入石架后，安静等待安全提示。':'关闭说明后，直接点击地图右下方绿色虚线的【石架后空隙】，小人会自动绕行过去。'];
 const goals=s.flags.truth?['带着复核说明出宫',departureDetail()]:chase.active?(chase.kind===2?chase2Goal:['先找藏身之处',chase.hide?'留在遮蔽物后等待安全提示；如需休息，点击暂停。':'点击发光的藏身点会自动走近，抵达后自动藏好。']):!s.flags.lit?['先让宫灯亮起来','调查旧榻与妆台，收集工具。选中火折子再调查宫灯。']:!s.flags.cabinet?['读懂灯下的数字','按纸罩上三行小字的顺序解开三位数匣。']:!s.flags.door?['打开寝殿侧门','选中铜钥匙，再调查右侧门。']:!s.flags.seasons?['让四时依次轮转','旧碑给出了灯盘的顺序，井中还留有一枚半玉。']:!s.got.includes('jadeA')?['取出井沿的半玉','将弯针与丝线组合成取物工具。']:!s.flags.scroll?['寻找映霜阁入口','藏书阁的书架暗格收有旧宫图。']:!s.flags.chase1Done?['进入映霜阁','从灯廊偏门进入；衣柜或屏风都可以藏身。']:!(s.flags.altarRead&&s.flags.dresserRead)?['找回她的名字','调查旧木牌与妆台家书，再从屏风后的通道进入密室。']:!evidenceReady()?['两份记录，缺一不可','墙中暗格存放值灯原册，石架夹层存放调灯凭单。灵影靠近时藏到石架后。']:!s.flags.truth?['在灯下复核旧案','调查密室长明灯，对照原册与凭单，完成三项推理。']:!s.flags.clean?['擦亮铜镜','带素绢回灯廊蘸水，再选中湿绢调查藏书阁铜镜。']:!s.flags.box?['解开四方字轮','按北、东、南、西对照镜上的诗句。']:!s.flags.gate?['让玉佩重新合璧','组合两半玉，选中合璧玉佩调查宫门机关槽。']:!s.flags.bell?['告诉门外的人','离宫前摇响旧铜铃，让师父接应证据。']:['带着证据离宫','调查离宫门，完成这一次归途。'];
 $('#objective').textContent=goals[0];$('#objectiveDetail').textContent=goals[1];$('#noteCount').textContent=s.notes.length;$('#latestClue').textContent=NOTES[s.notes[s.notes.length-1]][1];
}
function selectItem(id){if(!active||s.ending||chase.active)return;if(combining&&selected&&selected!==id){const recipe=RECIPES.find(r=>r.parts.includes(id)&&r.parts.includes(selected));if(recipe){recipe.parts.forEach(consume);give(recipe.out);selected=recipe.out;combining=false;status('组合成功：'+ITEMS[recipe.out].name);commit();}else{toast('这两件物品暂时无法组合。它们都还在背包里。');selected=null;renderInv();}return;}selected=selected===id?null:id;renderInv();}
function position(){return [s.x,s.y];}
function walkable(x,y){return x>=2&&x<=21&&y>=7&&y<=15;}
function findPath(from,to){if(!walkable(...to))return [];const queue=[from],seen=new Set([from.join(',')]),previous=new Map();let index=0;while(index<queue.length){const p=queue[index++];if(p[0]===to[0]&&p[1]===to[1]){const result=[];let k=p.join(',');while(previous.has(k)){result.unshift(k.split(',').map(Number));k=previous.get(k);}return result;}for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]){const n=[p[0]+dx,p[1]+dy],k=n.join(',');if(walkable(...n)&&!seen.has(k)){seen.add(k);previous.set(k,p.join(','));queue.push(n);}}}return [];}
function walkTo(target,callback=null,waypoints=null){if(!active||s.ending||$('#panel').open||chase.hide)return;stop();if(chase.active&&chase.kind===2&&waypoints){let from=position();path=[];for(const point of waypoints){path.push(...findPath(from,point));from=point;}}else path=findPath(position(),target);afterWalk=callback;if(!path.length){if(s.x===target[0]&&s.y===target[1]){const fn=afterWalk;afterWalk=null;if(fn)fn();}return;}$('#destination').hidden=false;$('#destination').style.left=(target[0]/24*100)+'%';$('#destination').style.top=(target[1]/18*100)+'%';status(callback?'正在走近调查……':'正在行走……');}
function renderPosition(){renderFacing();$('#player').style.left=(s.x/24*100)+'%';$('#player').style.top=(s.y/18*100)+'%';const near=nearest();$('#near').hidden=!active||!near||!!s.ending;$('#near').textContent=near?(chase.active&&HIDE_SPOTS[near.id]?'点击此处躲藏！':'E / 点击调查 · '+near.name):'';document.querySelectorAll('.hotspot').forEach(b=>b.classList.toggle('nearby',near?.id===b.dataset.hot));}
function renderRoute(){const route=$('#chaseRoute');route.toggleAttribute('hidden',!(chase.active&&chase.kind===2&&!chase.hide));}
function renderGhost(){const g=$('#ghost');$('#leaveHide').hidden=!chase.hide;renderRoute();if(!chase.active){g.hidden=true;$('#map').classList.remove('chase');$('#chaseBar').hidden=true;return;}g.hidden=false;$('#map').classList.add('chase');$('#chaseBar').hidden=false;$('#chaseBar').textContent=chase.kind===2?(chase.hide?'✦ 已进入石架后 · 等安全提示出现':'✦ 沿绿色虚线：先向下，再向右，最后向上；也可直接点【石架后空隙】'):(chase.hide?(chase.mode==='leave'?'✦ 灵影正在离开，请再等一会儿':'✦ 已藏好 · 静静等待，直到安全提示出现'):'✦ 灵影靠近 · 点击发光的藏身处，抵达即藏好');g.style.left=(chase.gx/24*100)+'%';g.style.top=(chase.gy/18*100)+'%';}
function nearest(){let best=null,distance=3;for(const o of ROOMS[s.room].objects){const d=Math.abs(s.x-o.stand[0])+Math.abs(s.y-o.stand[1]);if(d<distance){distance=d;best=o;}}return best;}
function step(dx,dy){if(!active||$('#panel').open||s.ending||chase.hide||document.hidden)return false;if(dx||dy)face(dx<0?'left':dx>0?'right':dy<0?'up':'down');const nx=s.x+dx,ny=s.y+dy;if(!walkable(nx,ny)){status('墙壁或家具挡住了去路。');return false;}s.x=nx;s.y=ny;renderPosition();return true;}
// ── 灵影追逐 ──
function clearChase(){stop();pendingPrompt=0;chase={active:false,kind:1,gx:0,gy:0,mode:'hunt',hide:null,ghostTimer:0,waitSince:0};PalaceAudio.setTense(false);}
function prepareEncounter(kind,retry=false){clearChase();s.pending=kind;s.room=kind===1?4:5;[s.x,s.y]=kind===1?[21,11]:[12,7];commit();panel(retry?'回到安全起点':ROOMS[s.room].name,retry?(kind===1?TEXT.caught1:TEXT.caught2):(kind===1?TEXT.chase1Intro:TEXT.chase2Intro),'相遇 · '+kind);pendingPrompt=kind;action(kind===2?'开始 · 点击绿色藏身点':'准备好了',()=>startChase(kind),'primary');}
function startChase(kind){pendingPrompt=0;stop();PalaceAudio.setTense(true);chase={active:true,kind,gx:kind===1?5:2,gy:8,mode:'hunt',hide:null,ghostTimer:performance.now()+600,waitSince:0};s.pending=kind;s.room=kind===1?4:5;[s.x,s.y]=kind===1?[21,11]:[12,7];s.facing=kind===1?'up':'right';close();commit();status('点击发光藏身点；抵达即藏好。也可以用方向键移动后按 E。');}
function hideHere(id){const o=ROOMS[s.room].objects.find(o=>o.id===id);if(!o||Math.abs(s.x-o.stand[0])+Math.abs(s.y-o.stand[1])>2)return;stop();[s.x,s.y]=o.stand;chase.hide=id;chase.mode='wait';chase.waitSince=0;commit();status('已藏好，等待安全提示。');}
function leaveHiding(){if(!chase.hide)return;stop();chase.hide=null;chase.mode='hunt';chase.waitSince=0;chase.ghostTimer=performance.now()+650;commit();status('你提前离开了藏身处，灵影仍在。');}
function caught(){prepareEncounter(chase.kind,true);}
function endChase1(){clearChase();s.pending=0;addNote('wail1');s.flags.chase1Done=true;commit();panel('安全了 · 可以出来了',NOTES.wail1[1],'相遇 · 上');action('继续调查',close,'primary');}
function endChase2(){clearChase();s.pending=0;addNote('truth');s.flags.chase2Done=true;s.flags.sawGhost2=true;commit();panel('安全了 · 灯影的请求',NOTES.truth[1],'相遇 · 下');action('继续调查',close,'primary');}
function ghostTick(now){
 if(!active||!chase.active||$('#panel').open||document.hidden||s.ending)return;
 const interval=330;if(now-chase.ghostTimer<interval)return;chase.ghostTimer=now;
 const distance=()=>Math.abs(chase.gx-s.x)+Math.abs(chase.gy-s.y);
 if(chase.mode==='wait'&&distance()<=2){chase.waitSince+=interval;if(chase.waitSince>=2310){chase.kind===1?endChase1():endChase2();}renderGhost();return;}
 const target=chase.mode==='leave'?(chase.kind===1?[5,7]:[2,8]):[s.x,s.y];
 const route=findPath([chase.gx,chase.gy],target);if(route.length)[chase.gx,chase.gy]=route[0];renderGhost();
 if(chase.mode==='hunt'&&distance()<=1){caught();return;}
 if(chase.mode==='leave'&&Math.abs(chase.gx-target[0])+Math.abs(chase.gy-target[1])<=1){if(chase.kind===1)endChase1();else endChase2();}
}
function tick(now){if(active&&!s.ending&&!chase.hide&&!document.hidden&&!$('#panel').open&&now-lastStep>105){lastStep=now;const dirs={ArrowUp:[0,-1],w:[0,-1],ArrowDown:[0,1],s:[0,1],ArrowLeft:[-1,0],a:[-1,0],ArrowRight:[1,0],d:[1,0]};const key=[...keys].find(k=>dirs[k]);if(key){path=[];afterWalk=null;$('#destination').hidden=true;if(step(...dirs[key])){$('#player').classList.add('walking');save();}}else if(path.length){const next=path.shift();if(step(next[0]-s.x,next[1]-s.y)){$('#player').classList.add('walking');if(!path.length){$('#player').classList.remove('walking');$('#destination').hidden=true;save();const fn=afterWalk;afterWalk=null;status('已到达 · '+ROOMS[s.room].name);if(fn)fn();}}}else $('#player').classList.remove('walking');}ghostTick(now);requestAnimationFrame(tick);}
function enter(room,to=[3,12,'right']){clearChase();s.pending=0;s.room=room;[s.x,s.y,s.facing]=to;if(!s.visited.includes(room))s.visited.push(room);selected=null;combining=false;close();commit();status('来到 '+ROOMS[room].name);
 if(room===4&&!s.flags.chase1Done)prepareEncounter(1);
 if(room===5&&!s.flags.chase2Done&&s.got.includes('blood'))prepareEncounter(2);
}
let lastRoom=0;
function use(required,fn){if(selected!==required){paragraph(selected?'手中的'+ITEMS[selected].name+'似乎不适合这里。':'先在背包中选中合适的物品，再调查这里。');return false;}fn();return true;}
function feedback(t){let p=$('#puzzleFeedback');if(!p){p=paragraph('');p.id='puzzleFeedback';p.className='puzzle-feedback';}p.textContent=t;}
function success(flag,text,note){s.flags[flag]=true;if(note)addNote(note);commit();panel('机关解开',text,'解谜成功');action('继续探索',close,'primary');}
function inspect(id){if(!active||s.ending||chase.hide)return;const o=ROOMS[s.room].objects.find(o=>o.id===id);if(!o)return;
 // 追逐中：只允许躲藏或（第一场）逃出
 if(chase.active){
  if(chase.kind===1&&(id==='wardrobe'||id==='screen')){hideHere(id);return;}
  if(chase.kind===2&&id==='shelter'){hideHere(id);return;}
  if(o.exit!==undefined){if(chase.kind===1){enter(o.exit,o.to);status('你退回灯廊，灵影没有跟来。');toast('暂时安全，映霜阁的调查尚未完成。');}else toast('先到右侧石架后藏身，等灵影平静下来。');return;}
  toast('先找发光的藏身处，平静之后再调查。');return;
 }
 stop();lastRoom=s.room;const dx=o.x*24/100-s.x,dy=o.y*18/100-s.y;face(Math.abs(dx)>Math.abs(dy)?(dx<0?'left':'right'):(dy<0?'up':'down'));save();
 if(o.exit!==undefined){
  if(s.room===0&&!s.flags.door){panel('寝殿侧门','门锁上刻着月牙纹。');use('key',()=>{s.flags.door=true;commit();paragraph('铜钥匙转动，门开了。');action('走入灯廊',()=>enter(1,o.to),'primary');});return;}
  if(s.room===1&&o.exit===2&&!s.flags.seasons){panel('尚未开启的暗门','门闩与廊上的四时灯盘相连。先解开灯盘的机关。');return;}
  if(id==='sideDoor'){if(!s.flags.scroll){panel('西侧偏门',TEXT.sideDoorLocked);return;}panel('西侧偏门',TEXT.sideDoorOpen);action('推开偏门',()=>enter(4,o.to),'primary');return;}
  enter(o.exit,o.to);return;}
 const descriptions={altar:NOTES.tablet[1],dresser:NOTES.family[1],lamp:s.flags.lit?NOTES.light[1]:TEXT.lamp,bell:s.flags.bell?NOTES.bell[1]:'旧铜铃通向门外，摇响它可以通知师父接应。',slot:s.flags.gate?'合璧玉佩已嵌好，宫门的门闩已经升起。':TEXT.slot,shelfNook:s.flags.scroll?'暗格已经空了，旧宫图已收好。':'书架后有一处暗格，里面藏着一卷旧宫图。',eternalLamp:s.flags.truth?'复核说明已经写好。'+departureDetail():TEXT.eternalLamp,niche:s.got.includes('blood')?'原册已被你收好，暗格已经空了。':TEXT.niche,shrine:s.got.includes('order')?'凭单已被你收好，石架夹层已经空了。':TEXT.shrine,mirror:s.flags.clean?NOTES.mirror[1]:TEXT.mirror,box:s.flags.box?'玉匣已经打开，另一半玉佩已取走。':TEXT.box,desk:s.got.includes('silk')?'素绢已取走，书案上还留着未寄出的信。':TEXT.desk};
 panel(o.name,descriptions[id]??TEXT[id]??'');
 if(id==='bed'){if(!s.got.includes('thread'))action('拾取丝线',()=>{give('thread');commit();inspect(id);});else paragraph('丝线已经收进背包。');}
 if(id==='table'){for(const item of ['needle','flint']){if(!s.got.includes(item))action('拿取'+ITEMS[item].name,()=>{give(item);commit();inspect(id);});}if(s.got.includes('needle')&&s.got.includes('flint'))paragraph('抽屉里的工具已经取走。');}
 if(id==='lamp'){if(s.flags.lit)return;else use('flint',()=>success('lit','火折子点亮纸灯，暖光照出藏在纸罩里的小字。\n'+NOTES.light[1],'light'));}
 if(id==='cabinet'){if(s.flags.cabinet)paragraph('木匣已经打开，铜钥匙已取走。');else{const input=document.createElement('input');input.className='answer-input';input.inputMode='numeric';input.maxLength=3;input.placeholder='···';input.setAttribute('aria-label','三位数密码');$('#panelBody').append(input);const submit=()=>{if(input.value.trim()==='624'){give('key');success('cabinet','字轮咔嗒合拢，木匣弹开。你拿到了铜钥匙。');}else{feedback('字轮没有咬合。再检查灯罩上的文字，按从上到下的顺序。');input.value='';}};input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submit();}});action('尝试开匣',submit,'primary');}}
 if(id==='stele'){addNote('season');paragraph(NOTES.season[1]);commit();}
 if(id==='lanterns'){if(s.flags.seasons){paragraph('四时灯盘已经点亮，通往藏书阁的暗门已开启。');return;}let seq=[];const row=document.createElement('div');row.className='puzzle-row';const display=document.createElement('p');display.className='sequence';display.textContent='○ ○ ○ ○';for(const season of ['春','夏','秋','冬'])row.append(button(season,()=>{seq.push(season);display.textContent=seq.join(' · ');if(seq.length===4){if(seq.join('')==='秋冬春夏')success('seasons','四时轮转，灯廊尽头的门闩缓缓升起。');else{feedback('顺序不对，灯光恢复原状。物品不会丢失，可以重新尝试。');seq=[];display.textContent='○ ○ ○ ○';}}},'season-key'));$('#panelBody').append(row,display);action('重置灯序',()=>{seq=[];display.textContent='○ ○ ○ ○';feedback('灯盘已重置。');});}
 if(id==='well'){if(selected==='silk'){consume('silk');give('wet');commit();paragraph('你把素绢浸入井沿的清水里，获得湿绢。');return;}if(!s.got.includes('jadeA')){if(selected==='hook'){give('jadeA');commit();paragraph('系线弯针稳稳钩住半玉，轻轻一提便到了手里。');}else paragraph('井沿有供物品蘸水的清水；深处的小物需要细线和弯钩才能取到。');}else paragraph('半玉已经取走，井沿仍有可用的清水。');}
 if(id==='shelfNook'){if(!s.flags.scroll){action('查看暗格',()=>{give('scroll');s.flags.scroll=true;addNote('scroll');commit();panel('书架暗格','你在最旧的那排架子后，摸到一卷被藏起来的旧宫图。','线索');action('翻阅旧宫图',()=>{panel('旧宫图',NOTES.scroll[1],'线索');action('继续探索',close,'primary');});});}}
 if(id==='desk'){if(!s.got.includes('silk'))action('拿取素绢',()=>{give('silk');commit();inspect(id);});action('阅读未寄出的信',()=>{addNote('letter');commit();panel('未寄出的信',NOTES.letter[1],'剧情线索');});}
 if(id==='mirror'){if(s.flags.clean)return;else use('wet',()=>success('clean','镜面被擦亮，四句诗倒映在月光里。\n'+NOTES.mirror[1],'mirror'));}
 if(id==='box'){if(s.flags.box)return;const symbols=['月','山','灯','水'],values=[0,0,0,0],row=document.createElement('div');row.className='puzzle-row';['北','东','南','西'].forEach((dir,i)=>{const w=document.createElement('div');w.className='wheel-wrap';const label=document.createElement('small');label.textContent=dir;const b=button(symbols[0],()=>{values[i]=(values[i]+1)%4;b.textContent=symbols[values[i]];},'wheel');b.setAttribute('aria-label',dir+'方字轮');w.append(label,b);row.append(w);});$('#panelBody').append(row);action('推开玉匣',()=>{if(values.map(v=>symbols[v]).join('')==='山灯水月'){give('jadeB');success('box','四方归位，玉匣打开。里面静静躺着另一半玉佩。');}else feedback('字轮尚未对齐。请按北、东、南、西对应的景物重新排列。');},'primary');}
 if(id==='altar'){if(!s.flags.altarRead){s.flags.altarRead=true;addNote('tablet');commit();}return;}
 if(id==='dresser'){if(!s.flags.dresserRead){s.flags.dresserRead=true;addNote('family');commit();}return;}
 if(id==='screen'){if(!s.flags.altarRead||!s.flags.dresserRead){panel('四折屏风','屏风后隐约有风。先弄清旧木牌上的名字，再进入暗门。');return;}panel('四折屏风',TEXT.screen);action('穿过暗门',()=>enter(5,[2,8,'right']),'primary');}
 if(id==='eternalLamp'){if(s.flags.truth){action('查看已完成的复核记录',()=>panel('复核记录',NOTES.verdict[1],'线索'));}else if(!evidenceReady()){paragraph('原册、凭单与灵影的请求都齐备后，才能在这里完成复核。');}else openDeduction();}
 if(id==='shrine'){if(!s.got.includes('order'))action('查看石架夹层',()=>{give('order');addNote('order');commit();panel('调灯凭单',NOTES.order[1],'铁证');action('继续调查',close,'primary');});}
 if(id==='niche'){if(!s.got.includes('blood')){action('取出墙中之物',()=>{give('blood');addNote('blood');s.flags.blood=true;commit();prepareEncounter(2);});}}
 if(id==='slot'){if(s.flags.gate)return;else use('jade',()=>{consume('jade');success('gate','合璧玉佩严丝合缝地嵌进机关槽。远处传来门闩升起的声音。');});}
 if(id==='bell'){if(!s.flags.bell)action('轻摇铜铃',()=>{s.flags.bell=true;addNote('bell');commit();panel('旧铜铃',NOTES.bell[1],'线索');});}
 if(id==='gate'&&s.flags.gate){if(s.flags.truth&&!s.flags.bell){paragraph('证据已复核。离宫前先摇响铜铃，让门外的师父接应。');return;}paragraph('门闩已开。要就此离宫吗？离开后仍可返回继续补全调查。');action('推门离宫',finish,'primary');action('再看看周围',close);}
}
function notes(){panel('随身线索簿','已经找到的线索会永久保留，不必背诵。','线索');for(const id of s.notes){const d=document.createElement('div');d.className='note-entry';const title=document.createElement('strong');title.textContent=NOTES[id][0];d.append(title);paragraph(NOTES[id][1],d);$('#panelBody').append(d);}}
function departureDetail(){const route=({5:'从屏风暗门返回映霜阁，再经灯廊、藏书阁前往承露宫门。',4:'返回灯廊，经藏书阁前往承露宫门。',1:'穿过藏书阁，前往承露宫门。',2:'从藏书阁右侧通道前往承露宫门。',3:''})[s.room]??'经灯廊、藏书阁前往承露宫门。';if(s.flags.gate)return !s.flags.bell?route+'摇响旧铜铃后，调查离宫门。':route+'调查离宫门，将复核说明与原件交给师父。';if(s.got.includes('jade'))return route+'选中合璧玉佩调查机关槽，再摇铃出宫。';if(!s.got.includes('jadeA'))return route+'离宫前还需用系线弯针取出灯廊井中的半玉，再与玉匣中的另一半组合开门。';if(s.got.includes('jadeB'))return route+'组合两半玉佩，嵌入机关槽，再摇铃出宫。';return route+(!s.flags.clean?'途中用湿绢擦亮藏书阁铜镜，按方位诗解开玉匣取得另一半玉佩。':'途中解开藏书阁方位玉匣，取得另一半玉佩。')+'合玉开门，再摇铃出宫。';}
function hintStage(){if(s.flags.truth)return 'departure';if(!s.flags.lit)return 'light';if(!s.flags.cabinet)return 'light';if(!s.flags.door)return 'key';if(!s.flags.seasons)return 'seasons';if(!s.got.includes('jadeA'))return 'jade';if(!s.flags.scroll)return 'scroll';if(!s.flags.chase1Done)return 'ghost1';if(!(s.flags.altarRead&&s.flags.dresserRead))return 'enter5';if(!s.flags.sawGhost2||!evidenceReady())return 'ghost2';if(!s.flags.truth)return 'deduction';if(!s.flags.clean)return 'mirror';if(!s.flags.box)return 'box';return 'gate';}
function hint(){if(!active){toast('进入宫夜后可以查看提示。');return;}const key=hintStage(),h=key==='departure'?['复核已经完成，下一步是带着说明与证据出宫。',departureDetail()]:HINTS[key];s.hints[key]=Math.min((s.hints[key]||0)+1,h.length);save();panel('一点提示',h.slice(0,s.hints[key]).map((t,i)=>(i+1)+'. '+t).join('\n'),'提示 '+s.hints[key]+' / '+h.length);if(s.hints[key]<h.length)action('再明确一点',hint);action('回去试试',close,'primary');}
function evidenceReady(){return s.flags.sawGhost2===true&&s.got.includes('blood')&&s.got.includes('order')&&s.flags.altarRead===true&&s.flags.dresserRead===true;}
function openDeduction(){if(!evidenceReady())return;const answers=[];panel('灯下复核','请对照原册、凭单和家书，确认三件事。','推理');DEDUCTION.forEach((item,i)=>{const label=document.createElement('label');label.className='deduction-label';label.textContent=item.q;const select=document.createElement('select');select.className='evidence-select';select.setAttribute('aria-label',item.q);select.append(new Option('请选择',''));item.options.forEach(v=>select.append(new Option(v,v)));select.onchange=()=>answers[i]=select.value;label.append(select);$('#panelBody').append(label);});action('提交复核',()=>{if(DEDUCTION.every((item,i)=>answers[i]===item.answer)){s.flags.verified=true;s.flags.truth=true;addNote('verdict');commit();panel('复核完成 · 下一步出宫',NOTES.verdict[1],'推理');paragraph(departureDetail());action('带着复核说明出宫',close,'primary');}else feedback('结论与记录还不能互相印证。请对照时间、编号与签名后再试。');},'primary');}
function finish(){if(!s.flags.gate)return;s.ending=(s.flags.truth&&s.flags.verified&&evidenceReady()&&s.flags.bell)?'justice':(s.notes.includes('letter')&&s.flags.bell?'together':'solo');commit();renderEnding();}
function renderEnding(){const map={justice:['沉冤昭雪',TEXT.finalJustice],together:['携信归来',TEXT.finalGood],solo:['月下出宫',TEXT.finalSolo]}[s.ending];panel(map[0],map[1],s.ending==='justice'?'真 · 结局':'结局');paragraph('完成归途 · 找到 '+s.notes.length+' / '+Object.keys(NOTES).length+' 条线索'+(s.ending==='justice'?' · 真相已大白':''));action('返回宫门继续探索',()=>{s.ending=null;close();commit();});action('重新开始',()=>{close();start();},'primary');}
function start(){clearChase();s=fresh();selected=null;combining=false;active=true;$('#cover').hidden=true;PalaceAudio.start();commit();panel('楔子 · 三年旧案',TEXT.intro,'序');action('踏入子时宫夜',close,'primary');}
function reset(){panel('重新开始？','这会覆盖当前探索进度。选择「保留进度」可以继续当前游戏。','确认');action('保留进度',close,'primary');action('确认重开',()=>{close();start();});}
$('#startBtn').onclick=()=>{PalaceAudio.start();if(load())reset();else start();};$('#continueBtn').onclick=()=>{const saved=load();if(!saved){toast('未找到有效存档，将从头开始。');start();return;}s=saved;active=true;$('#cover').hidden=true;PalaceAudio.start();save();render();if(s.ending)renderEnding();else if(s.pending)prepareEncounter(s.pending);};
$('#resetBtn').onclick=reset;$('#helpBtn').onclick=()=>panel('如何探索',TEXT.help,'操作');$('#notesBtn').onclick=notes;$('#allNotes').onclick=notes;$('#hintBtn').onclick=hint;$('#closePanel').onclick=close;$('#pauseBtn').onclick=()=>{if(!active||s.ending)return;PalaceAudio.setPaused(true);panel('暂停',chase.active?'灵影与计时都会停在这里。':'行动已暂停。','暂停');action('继续',()=>{PalaceAudio.setPaused(false);close();},'primary');};$('#leaveHide').onclick=leaveHiding;
$('#panel').addEventListener('cancel',e=>{keys.clear();if(pendingPrompt)e.preventDefault();});$('#panel').addEventListener('close',()=>{if($('#panel').dataset.kind==='暂停')PalaceAudio.setPaused(false);$('#map').focus({preventScroll:true});});
$('#combineBtn').onclick=()=>{if(!active||chase.active||s.ending)return;combining=!combining;selected=null;renderInv();};
function interact(){if(!active||s.ending||$('#panel').open||chase.hide)return;const o=nearest();if(o)inspect(o.id);else toast('附近没有可调查物件，试着走近金色标记。');}
$('#interactBtn').onclick=interact;
function updateTouchLabel(){$('#interactBtn').textContent=innerWidth<=760?'调查':'调查 E';}addEventListener('resize',updateTouchLabel,{passive:true});updateTouchLabel();
$('#map').addEventListener('click',e=>{if(e.target.closest('button')||!active||s.ending)return;const rect=$('#map').getBoundingClientRect(),x=Math.round((e.clientX-rect.left)/rect.width*24),y=Math.round((e.clientY-rect.top)/rect.height*18);if(!walkable(x,y)){toast('那里是墙壁或家具，点击空地行走。');return;}walkTo([x,y]);});
const accepted=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'];
document.addEventListener('keydown',e=>{if($('#panel').open||e.target.closest('input,textarea,select'))return;const key=e.key.length===1?e.key.toLowerCase():e.key;if(accepted.includes(key)&&active){e.preventDefault();keys.add(key);}else if((key==='e'||key===' ')&&active){if(e.target.closest('button')&&key===' ')return;e.preventDefault();if(!e.repeat)interact();}});
document.addEventListener('keyup',e=>keys.delete(e.key.length===1?e.key.toLowerCase():e.key));window.addEventListener('blur',stop);document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();if(active)save();}});
for(const b of document.querySelectorAll('[data-move]')){const [dx,dy]=b.dataset.move.split(',').map(Number),key=dx<0?'ArrowLeft':dx>0?'ArrowRight':dy<0?'ArrowUp':'ArrowDown';b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(key);};b.onpointerup=()=>keys.delete(key);b.onpointercancel=()=>keys.delete(key);b.onlostpointercapture=()=>keys.delete(key);}
$('.brand').onclick=e=>{e.preventDefault();if(active)panel('宫墙夜未央','你正在探索'+ROOMS[s.room].name+'。进度已自动保存在当前浏览器。','游戏');};
$('#mapImage').addEventListener('error',()=>{status('地图加载暂时失败，请刷新重试；已保存的进度不会丢失。');});
$('#ghost img').addEventListener('error',()=>{status('灵影素材加载失败，请刷新。');});
const saved=load();if(saved){s=saved;$('#continueBtn').hidden=false;}render();requestAnimationFrame(tick);
