(() => {
  const canvas = document.querySelector('#world'), ctx = canvas.getContext('2d');
  const mapCanvas = document.querySelector('#mapCanvas'), mctx = mapCanvas.getContext('2d');
  const TW = 68, TH = 36, SIZE = 44;
  const player = {x:22,y:22,hp:84,maxHp:100,faceX:1,faceY:0,walk:0,attack:0};
  let herbs=0, slimes=0, inventory={tonic:2,herb:0,rune:1}, camera={x:0,y:0}, target=null, moveVec={x:0,y:0}, joystickOn=false, lastTime=0, toastTimer, encounterTimer=0, soundOn=true, worldTime=0;
  const tiles = [], things=[];
  const rand=(x,y)=>{const n=Math.sin(x*127.1+y*311.7+12.9898)*43758.5453;return n-Math.floor(n)};
  for(let y=0;y<SIZE;y++){tiles[y]=[];for(let x=0;x<SIZE;x++){
    const water=(x<4 || y<3 || (x>30&&y<8) || (x>8&&x<14&&y>29));
    const path=(Math.abs(y-(21+Math.sin(x*.21)*2))<1.15 || Math.abs(x-22)<1&&y>9&&y<24 || (x>16&&x<25&&y>17&&y<25));
    const mud=!water&&!path&&rand(x,y)>.82;
    tiles[y][x]=water?'water':path?'path':mud?'moss':'grass';
  }}
  // Little island and meandering trail; fixed landmarks make the world feel lived-in.
  const add=(type,x,y,extra={})=>things.push({type,x,y,...extra});
  add('house',26,19,{name:'Hearthward Inn'}); add('house',18,17,{name:'Old Rowan’s Cottage',variant:1}); add('tower',31,13,{name:'Silent Watch'});
  add('dock',6,16); add('boat',4.4,15.1); add('well',22.4,18.3); add('sign',24,18); add('keeper',24,17,{name:'Mira'});
  [[13,11],[16,8],[28,9],[29,23],[11,22],[7,10],[32,19],[15,26],[28,27],[9,17],[34,14],[18,29],[25,8],[6,24],[34,25],[12,7],[20,12],[30,30]].forEach(([x,y],i)=>add('tree',x,y,{variant:i%4}));
  [[20,9],[17,24],[27,26],[12,19],[30,17],[8,13],[25,12]].forEach(([x,y],i)=>add('herb',x,y,{available:true,name:'Moon herb',variant:i%3}));
  [[15,19],[28,24],[10,14],[32,21]].forEach(([x,y],i)=>add('slime',x,y,{hp:2,alive:true,name:'Marsh slime',id:i,phase:rand(x,y)*6}));
  [[19,15],[23,21],[14,20],[30,12],[8,20],[27,11],[18,27],[33,17]].forEach(([x,y],i)=>add('rock',x,y,{variant:i%3}));
  try{const saved=JSON.parse(localStorage.getItem('everfall-save')||'null');if(saved){player.x=saved.x??player.x;player.y=saved.y??player.y;player.hp=saved.hp??player.hp;herbs=saved.herbs??herbs;slimes=saved.slimes??slimes;inventory={...inventory,...saved.inventory};things.forEach(o=>{if(o.type==='herb'&&saved.herbTiles)o.available=saved.herbTiles.includes(`${o.x},${o.y}`);if(o.type==='slime'&&saved.slimeTiles)o.alive=saved.slimeTiles.includes(`${o.x},${o.y}`);});}}catch{}
  function saveGame(){try{localStorage.setItem('everfall-save',JSON.stringify({x:player.x,y:player.y,hp:player.hp,herbs,slimes,inventory,herbTiles:things.filter(o=>o.type==='herb'&&o.available).map(o=>`${o.x},${o.y}`),slimeTiles:things.filter(o=>o.type==='slime'&&o.alive).map(o=>`${o.x},${o.y}`)}));}catch{}}
  function resize(){const dpr=Math.min(devicePixelRatio||1,2),w=innerWidth,h=innerHeight;canvas.width=Math.floor(w*dpr);canvas.height=Math.floor(h*dpr);canvas.style.width=w+'px';canvas.style.height=h+'px';ctx.setTransform(dpr,0,0,dpr,0,0);}
  addEventListener('resize',resize);resize();
  function iso(x,y){return {x:(x-y)*TW/2,y:(x+y)*TH/2};}
  function screen(x,y,z=0){const p=iso(x,y);return {x:p.x-camera.x+innerWidth/2,y:p.y-camera.y+innerHeight*.49-z};}
  function poly(points,fill,stroke=null){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
  function ellipse(x,y,rx,ry,color){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
  function drawTile(x,y,type){const p=screen(x,y),pts=[{x:p.x,y:p.y},{x:p.x+TW/2,y:p.y+TH/2},{x:p.x,y:p.y+TH},{x:p.x-TW/2,y:p.y+TH/2}];
    let c=type==='water'?'#345b59':type==='path'?'#9b8967':type==='moss'?'#53734f':'#567b55';
    poly(pts,c);
    if(type==='water'){const w=Math.sin(worldTime*1.1+x*.7+y)*.12;ctx.strokeStyle=`rgba(172,208,184,${.16+w})`;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p.x-10,p.y+TH/2+3);ctx.lineTo(p.x+5,p.y+TH/2+3);ctx.stroke();}
    else if(type==='path'&&rand(x,y)>.7){ellipse(p.x+rand(y,x)*22-11,p.y+TH/2+rand(x+1,y)*9,1.3,1,'#c2ae83');}
    else if(rand(x,y)>.76){ellipse(p.x+rand(x+7,y)*25-12,p.y+TH/2+rand(x,y+3)*11,1.3,1,'#c0cb7b66');}
    ctx.strokeStyle='rgba(20,43,38,.11)';ctx.lineWidth=.6;ctx.stroke();
  }
  function drawTree(o){const p=screen(o.x,o.y);ellipse(p.x,p.y+3,17,7,'#162a2788');
    // trunk
    poly([{x:p.x-4,y:p.y-13},{x:p.x+5,y:p.y-13},{x:p.x+4,y:p.y+3},{x:p.x-3,y:p.y+5}],'#725440');
    const palette=[['#315844','#46774f','#5b8955'],['#355847','#527f58','#6b9160'],['#445c47','#657b4f','#82945a'],['#30534b','#41715e','#56876a']][o.variant];
    ellipse(p.x-5,p.y-33,14,16,palette[0]);ellipse(p.x+7,p.y-38,15,17,palette[1]);ellipse(p.x,p.y-49,13,15,palette[2]);
    if(o.variant===2){ellipse(p.x-8,p.y-41,3,3,'#d7c68b');ellipse(p.x+8,p.y-30,2,2,'#d7c68b');}
  }
  function drawHouse(o){const p=screen(o.x,o.y),w=TW*1.65,h=TH*1.15;
    ellipse(p.x,p.y+4,58,18,'#14231c70');
    poly([{x:p.x-w/2,y:p.y-h/2},{x:p.x,y:p.y},{x:p.x,y:p.y+45},{x:p.x-w/2,y:p.y+18}],'#9c7956');
    poly([{x:p.x,y:p.y},{x:p.x+w/2,y:p.y-h/2},{x:p.x+w/2,y:p.y+18},{x:p.x,y:p.y+45}],'#b18c62');
    poly([{x:p.x-w/2-5,y:p.y-h/2+1},{x:p.x,y:p.y-h/2-43},{x:p.x+9,y:p.y-h/2-36},{x:p.x-w/2+13,y:p.y-h/2+13}],'#633f3b');
    poly([{x:p.x,y:p.y-h/2-43},{x:p.x+w/2+6,y:p.y-h/2+1},{x:p.x+w/2-12,y:p.y-h/2+13},{x:p.x+9,y:p.y-h/2-29}],'#855148');
    poly([{x:p.x-w/2+5,y:p.y+5},{x:p.x-21,y:p.y+13},{x:p.x-21,y:p.y-9},{x:p.x-w/2+5,y:p.y-20}],'#38514b');
    poly([{x:p.x+6,y:p.y+14},{x:p.x+w/2-6,y:p.y+4},{x:p.x+w/2-6,y:p.y-20},{x:p.x+6,y:p.y-9}],'#405a4f');
    poly([{x:p.x-6,y:p.y+42},{x:p.x+10,y:p.y+38},{x:p.x+10,y:p.y+10},{x:p.x-6,y:p.y+17}],'#503c30');
    if(o.variant===1){ellipse(p.x,p.y-h/2-42,6,9,'#806452');}
  }
  function drawTower(o){const p=screen(o.x,o.y);ellipse(p.x,p.y,31,9,'#16251f88');
    poly([{x:p.x-23,y:p.y-8},{x:p.x+3,y:p.y-2},{x:p.x+3,y:p.y+4},{x:p.x-23,y:p.y-2}],'#7a7564');poly([{x:p.x+3,y:p.y-2},{x:p.x+27,y:p.y-9},{x:p.x+27,y:p.y-3},{x:p.x+3,y:p.y+4}],'#5b5c53');
    poly([{x:p.x-19,y:p.y-6},{x:p.x-14,y:p.y-69},{x:p.x+3,y:p.y-75},{x:p.x+3,y:p.y-2}],'#8b8873');poly([{x:p.x+3,y:p.y-2},{x:p.x+3,y:p.y-75},{x:p.x+20,y:p.y-66},{x:p.x+23,y:p.y-7}],'#666a60');
    poly([{x:p.x-23,y:p.y-68},{x:p.x+2,y:p.y-84},{x:p.x+27,y:p.y-68},{x:p.x+4,y:p.y-58}],'#674846');
    ellipse(p.x+2,p.y-39,4,8,'#dfb76e');ellipse(p.x+3,p.y-39,2,5,'#fff0b7');
  }
  function drawHerb(o){if(!o.available)return;const p=screen(o.x,o.y);ellipse(p.x,p.y+2,12,4,'#1d35268c');
    ctx.strokeStyle='#89b978';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x,p.y+1);ctx.quadraticCurveTo(p.x-3,p.y-10,p.x-7,p.y-13);ctx.moveTo(p.x,p.y+1);ctx.quadraticCurveTo(p.x+4,p.y-9,p.x+7,p.y-14);ctx.moveTo(p.x,p.y);ctx.lineTo(p.x,p.y-12);ctx.stroke();
    ellipse(p.x-7,p.y-13,4,2.4,'#b4d98c');ellipse(p.x+7,p.y-14,4,2.4,'#c9e8a4');ellipse(p.x,p.y-13,3,3,'#e1d99a');
    if(o.pulse){ctx.globalAlpha=.35+Math.sin(worldTime*3)*.18;ellipse(p.x,p.y-12,14,11,'#d8f78a');ctx.globalAlpha=1;}
  }
  function drawSlime(o){if(!o.alive)return;const p=screen(o.x,o.y),bob=Math.sin(worldTime*3+o.phase)*2;ellipse(p.x,p.y+2,14,5,'#18241e88');ellipse(p.x,p.y-8+bob,12,10,'#4e9a6b');ellipse(p.x-3,p.y-12+bob,4,4,'#7cbd83');ellipse(p.x-4,p.y-8+bob,1.5,2,'#122923');ellipse(p.x+4,p.y-8+bob,1.5,2,'#122923');
    if(o.hp<2){ctx.fillStyle='#f0d7b4';ctx.fillRect(p.x-10,p.y-24,20,2);ctx.fillStyle='#e07b61';ctx.fillRect(p.x-10,p.y-24,10,2);}}
  function drawRock(o){const p=screen(o.x,o.y);ellipse(p.x,p.y+3,12,4,'#1a2a2577');poly([{x:p.x-9,y:p.y},{x:p.x-7,y:p.y-7},{x:p.x-1,y:p.y-11},{x:p.x+7,y:p.y-8},{x:p.x+10,y:p.y},{x:p.x+5,y:p.y+2}],'#777b6b');poly([{x:p.x-7,y:p.y-7},{x:p.x-1,y:p.y-11},{x:p.x+3,y:p.y-8},{x:p.x-2,y:p.y-5}],'#a2a28a');}
  function drawMisc(o){const p=screen(o.x,o.y);if(o.type==='well'){ellipse(p.x,p.y,16,6,'#25352e');poly([{x:p.x-12,y:p.y-7},{x:p.x+12,y:p.y-7},{x:p.x+10,y:p.y+2},{x:p.x-10,y:p.y+2}],'#8d8066');ellipse(p.x,p.y-7,12,4,'#4d7975');}
    if(o.type==='sign'){poly([{x:p.x-2,y:p.y},{x:p.x+2,y:p.y},{x:p.x+2,y:p.y-20},{x:p.x-2,y:p.y-20}],'#79543a');poly([{x:p.x-10,y:p.y-21},{x:p.x+12,y:p.y-21},{x:p.x+10,y:p.y-14},{x:p.x-9,y:p.y-14}],'#b9935c');}
    if(o.type==='dock'){for(let i=0;i<5;i++){poly([{x:p.x-34+i*3,y:p.y-8+i*5},{x:p.x+25+i*3,y:p.y-8+i*5},{x:p.x+25+i*3,y:p.y-3+i*5},{x:p.x-34+i*3,y:p.y-3+i*5}],'#886b4c');}}
    if(o.type==='boat'){poly([{x:p.x-14,y:p.y-4},{x:p.x+18,y:p.y-4},{x:p.x+9,y:p.y+7},{x:p.x-7,y:p.y+7}],'#704c39');poly([{x:p.x,y:p.y-5},{x:p.x,y:p.y-25},{x:p.x+11,y:p.y-8}],'#dbcda9');}
    if(o.type==='keeper'){ellipse(p.x,p.y+2,10,4,'#17241e88');ellipse(p.x,p.y-10,6,7,'#d0a478');poly([{x:p.x-8,y:p.y-8},{x:p.x+8,y:p.y-8},{x:p.x+10,y:p.y+1},{x:p.x-10,y:p.y+1}],'#b56851');poly([{x:p.x-7,y:p.y-17},{x:p.x+7,y:p.y-17},{x:p.x+4,y:p.y-21},{x:p.x-4,y:p.y-21}],'#55453a');}
  }
  function drawPlayer(){const p=screen(player.x,player.y);ellipse(p.x,p.y+3,13,5,'#18272099');const bob=player.walk?Math.sin(player.walk*12)*1.5:0;
    if(player.attack>0){ctx.strokeStyle=`rgba(255,230,161,${player.attack*2})`;ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y-14,24,-.9,.8);ctx.stroke();}
    poly([{x:p.x-6,y:p.y-14+bob},{x:p.x+5,y:p.y-14+bob},{x:p.x+8,y:p.y-1},{x:p.x-7,y:p.y-1}],'#315c58');poly([{x:p.x-5,y:p.y-15+bob},{x:p.x+5,y:p.y-15+bob},{x:p.x+4,y:p.y-5},{x:p.x-4,y:p.y-5}],'#d2ad79');ellipse(p.x,p.y-22+bob,6,6,'#d6a77e');poly([{x:p.x-7,y:p.y-25+bob},{x:p.x+7,y:p.y-25+bob},{x:p.x+5,y:p.y-29+bob},{x:p.x-4,y:p.y-29+bob}],'#715640');
    ctx.strokeStyle='#d9d4c3';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x+7,p.y-9+bob);ctx.lineTo(p.x+13,p.y-22+bob);ctx.stroke();ellipse(p.x+13,p.y-22+bob,2,2,'#e9d39b');
  }
  function draw(){const w=innerWidth,h=innerHeight;ctx.clearRect(0,0,w,h);camera.x=iso(player.x,player.y).x;camera.y=iso(player.x,player.y).y;
    for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){const p=screen(x,y);if(p.x>-TW&&p.x<w+TW&&p.y>-TH&&p.y<h+TH)drawTile(x,y,tiles[y][x]);}
    const ordered=things.filter(o=>o.type!=='slime'||o.alive).slice().sort((a,b)=>(a.x+a.y)-(b.x+b.y));for(const o of ordered){if(o.type==='tree')drawTree(o);else if(o.type==='house')drawHouse(o);else if(o.type==='tower')drawTower(o);else if(o.type==='herb')drawHerb(o);else if(o.type==='slime')drawSlime(o);else if(o.type==='rock')drawRock(o);else drawMisc(o);}
    drawPlayer();drawMap();
  }
  function drawMap(){const w=mapCanvas.width,h=mapCanvas.height;mctx.clearRect(0,0,w,h);mctx.fillStyle='#28443d';mctx.fillRect(0,0,w,h);
    // Stylized terrain map.
    mctx.fillStyle='#315b5a';mctx.beginPath();mctx.moveTo(0,0);mctx.lineTo(26,0);mctx.lineTo(22,112);mctx.lineTo(0,112);mctx.fill();mctx.fillRect(113,0,43,22);
    mctx.strokeStyle='#a18b68';mctx.lineWidth=4;mctx.beginPath();mctx.moveTo(42,112);mctx.quadraticCurveTo(64,78,79,63);mctx.quadraticCurveTo(93,52,84,21);mctx.stroke();
    [[31,19],[38,27],[106,17],[118,69],[48,56],[81,90],[131,85],[61,14],[97,103],[22,76]].forEach(([x,y])=>{mctx.fillStyle='#567b55';mctx.beginPath();mctx.arc(x,y,4,0,7);mctx.fill();});
    mctx.fillStyle='#b98157';mctx.fillRect(103,48,9,7);mctx.fillStyle='#c9a76b';mctx.fillRect(78,55,5,5);
    const px=38+(player.x/ SIZE)*82,py=(player.y/SIZE)*100+3;mctx.fillStyle='#f0d182';mctx.shadowColor='#f0d182';mctx.shadowBlur=8;mctx.beginPath();mctx.arc(px,py,3.3,0,Math.PI*2);mctx.fill();mctx.shadowBlur=0;
  }
  function say(message){const el=document.querySelector('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2200);}
  function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
  function nearest(types,max=Infinity){let best=null,bd=max;for(const o of things){if(!types.includes(o.type)||(o.type==='herb'&&!o.available)||(o.type==='slime'&&!o.alive))continue;const d=distance(player,o);if(d<bd){best=o;bd=d;}}return best;}
  function moveToward(obj){if(distance(player,obj)<1.25){target=null;return true;}const dx=obj.x-player.x,dy=obj.y-player.y,len=Math.hypot(dx,dy)||1;moveVec={x:dx/len,y:dy/len};target=obj;return false;}
  function doInteract(){let herb=nearest(['herb'],3.2);if(herb){if(distance(player,herb)>1.65){moveToward(herb);say('Moving to the moon herb…');return;}herb.available=false;herbs++;inventory.herb++;say('Moon herb gathered · '+herbs+' / 3');updateUI();checkQuest();return;}
    const person=nearest(['keeper','well','house','tower','sign'],3);if(person){if(distance(player,person)>1.65){moveToward(person);say('Making your way over…');return;}if(person.type==='keeper'){if(herbs>=3&&slimes>=2){say('Mira: The watchlight will shine again. You have our thanks!');completeQuest();}else say('Mira: Moon herbs and a clear marsh… then we can relight the tower.');}else if(person.type==='tower')say('The watchtower is dark. A faint warmth lingers inside.');else if(person.type==='well')say('A cool, clear spring. You feel a little steadier.');else say(person.name||'A weathered sign reads: Whispering Reach.');return;}
    say('Nothing nearby to interact with.');
  }
  function doAttack(){const foe=nearest(['slime'],5);if(!foe){say('No marsh slimes in sight.');return;}if(distance(player,foe)>1.65){moveToward(foe);say('Closing in on the slime…');return;}target=null;player.attack=.55;foe.hp--;player.faceX=foe.x-player.x;player.faceY=foe.y-player.y;
    if(foe.hp<=0){foe.alive=false;slimes++;say('Marsh slime defeated · '+slimes+' / 2');}else say('A clean hit! The slime wobbles.');updateUI();checkQuest();
  }
  function useSlot(n){if(n===0){if(inventory.tonic<1){say('No healing tonics left.');return;}if(player.hp>=player.maxHp){say('Your vitality is already full.');return;}inventory.tonic--;player.hp=Math.min(player.maxHp,player.hp+36);say('Healing tonic used · vitality restored');updateUI();}
    else if(n===1){if(inventory.herb>0){inventory.herb--;player.hp=Math.min(player.maxHp,player.hp+8);say('Moon herb used · +8 vitality');updateUI();}else say('Gather moon herbs in the marsh.');}
    else if(n===2){say('The ember rune hums softly. (No target nearby)');}
    else openInventory();document.querySelectorAll('.slot').forEach((el,i)=>el.classList.toggle('active',i===n));}
  function updateUI(){document.querySelector('#hpText').textContent=`${player.hp} / ${player.maxHp}`;document.querySelector('#hpBar').style.width=(player.hp/player.maxHp*100)+'%';document.querySelector('#herbCount').textContent=`${herbs} / 3`;document.querySelector('#slimeCount').textContent=`${slimes} / 2`;
    document.querySelector('#herbCheck').classList.toggle('done',herbs>=3);document.querySelector('#herbCheck').textContent=herbs>=3?'✓':'◇';document.querySelector('#slimeCheck').classList.toggle('done',slimes>=2);document.querySelector('#slimeCheck').textContent=slimes>=2?'✓':'◇';saveGame();}
  function checkQuest(){if(herbs>=3&&slimes>=2){say('Quest complete! Find Mira at the inn for your reward.');document.querySelector('#questCard').classList.add('quest-ready');}}
  function completeQuest(){document.querySelector('#questCard').classList.remove('quest-ready');say('Quest complete · 120 XP · 18 coin');}
  function openInventory(){const grid=document.querySelector('#inventoryGrid');grid.innerHTML='';[['🧪','Healing tonic',inventory.tonic],['❧','Moon herb',inventory.herb],['ᚱ','Ember rune',inventory.rune],['⚔','Wayfarer blade',1]].forEach(item=>{const el=document.createElement('button');el.className='inv-item';el.innerHTML=`${item[0]}<span>${item[2]}</span>`;el.title=item[1];el.onclick=()=>say(item[1]+' · '+item[2]+' in pack');grid.appendChild(el);});document.querySelector('#inventoryBackdrop').classList.remove('hidden');}
  function update(dt){worldTime+=dt;if(Math.floor(worldTime/4)!==Math.floor((worldTime-dt)/4))saveGame();if(moveVec.x||moveVec.y){const speed=3.1;player.x=Math.max(2,Math.min(SIZE-2,player.x+moveVec.x*speed*dt));player.y=Math.max(2,Math.min(SIZE-2,player.y+moveVec.y*speed*dt));player.faceX=moveVec.x;player.faceY=moveVec.y;player.walk+=dt;}
    if(target&&distance(player,target)<1.35){moveVec={x:0,y:0};target=null;}player.attack=Math.max(0,player.attack-dt);
    encounterTimer+=dt;const foe=nearest(['slime'],1.55);if(foe&&encounterTimer>2.3){encounterTimer=0;player.hp=Math.max(0,player.hp-5);say('A marsh slime hits you · vitality -5');updateUI();if(player.hp===0){player.hp=45;player.x=22;player.y=22;moveVec={x:0,y:0};say('You awaken at the Reach, shaken but safe.');updateUI();}}
  }
  function frame(t){const dt=Math.min(.04,(t-lastTime)/1000||0);lastTime=t;update(dt);draw();requestAnimationFrame(frame);}requestAnimationFrame(frame);
  function setJoy(e){const rect=document.querySelector('.joy-ring').getBoundingClientRect(),dx=e.clientX-(rect.left+rect.width/2),dy=e.clientY-(rect.top+rect.height/2),max=rect.width*.36,len=Math.hypot(dx,dy)||1,n=Math.min(1,len/max);document.querySelector('#joyKnob').style.transform=`translate(${dx/len*n*max}px,${dy/len*n*max}px)`;moveVec={x:(dx/len*n+dy/len*n),y:(dy/len*n-dx/len*n)};target=null;}
  const joy=document.querySelector('#joystick');joy.addEventListener('pointerdown',e=>{e.preventDefault();joystickOn=true;joy.setPointerCapture(e.pointerId);setJoy(e);});joy.addEventListener('pointermove',e=>{if(joystickOn)setJoy(e);});const stopJoy=()=>{joystickOn=false;moveVec={x:0,y:0};document.querySelector('#joyKnob').style.transform='translate(0,0)';};joy.addEventListener('pointerup',stopJoy);joy.addEventListener('pointercancel',stopJoy);
  canvas.addEventListener('pointerdown',e=>{if(e.target!==canvas)return;const rect=canvas.getBoundingClientRect(),sx=e.clientX-rect.left-innerWidth/2,sy=e.clientY-rect.top-innerHeight*.49+camera.y;const wx=(sx*2/TW+sy*2/TH)/2,wy=(sy*2/TH-sx*2/TW)/2;const worldX=player.x+wx,worldY=player.y+wy;const tapped=things.filter(o=>Math.hypot(o.x-worldX,o.y-worldY)<1.5).sort((a,b)=>distance(player,a)-distance(player,b))[0];if(tapped){if(tapped.type==='slime')moveToward(tapped);else if(tapped.type==='herb')moveToward(tapped);else moveToward(tapped);}else{const dx=worldX-player.x,dy=worldY-player.y,len=Math.hypot(dx,dy)||1;moveVec={x:dx/len,y:dy/len};target={x:worldX,y:worldY};}});
  document.querySelector('#interactBtn').onclick=doInteract;document.querySelector('#attackBtn').onclick=doAttack;
  document.querySelectorAll('.slot').forEach((el,i)=>el.addEventListener('click',()=>useSlot(i)));
  document.querySelector('#questToggle').onclick=()=>{const q=document.querySelector('#questCard');q.classList.toggle('collapsed');document.querySelector('#questToggle').textContent=q.classList.contains('collapsed')?'⌄':'⌃';};
  document.querySelector('#menuBtn').onclick=()=>document.querySelector('#modalBackdrop').classList.remove('hidden');document.querySelector('#brandButton').onclick=()=>document.querySelector('#modalBackdrop').classList.remove('hidden');document.querySelector('#resumeBtn').onclick=()=>document.querySelector('#modalBackdrop').classList.add('hidden');document.querySelector('#modalClose').onclick=()=>document.querySelector('#modalBackdrop').classList.add('hidden');
  document.querySelector('#inventoryClose').onclick=()=>document.querySelector('#inventoryBackdrop').classList.add('hidden');document.querySelector('#inventoryBackdrop').addEventListener('click',e=>{if(e.target.id==='inventoryBackdrop')e.currentTarget.classList.add('hidden');});
  document.querySelector('#soundBtn').onclick=e=>{soundOn=!soundOn;e.currentTarget.textContent=soundOn?'♫':'♪';say(soundOn?'Sound enabled':'Sound muted');};
  addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(k==='w'||k==='arrowup')moveVec={x:-.8,y:-.8};if(k==='s'||k==='arrowdown')moveVec={x:.8,y:.8};if(k==='a'||k==='arrowleft')moveVec={x:-.8,y:.8};if(k==='d'||k==='arrowright')moveVec={x:.8,y:-.8};if(k==='e')doInteract();if(k===' '||k==='f')doAttack();if('1234'.includes(k))useSlot(Number(k)-1);});addEventListener('keyup',e=>{if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(e.key.toLowerCase()))moveVec={x:0,y:0};});
  updateUI();
  // Brief first-visit guidance, then leave the view unobstructed.
  setTimeout(()=>document.querySelector('#mobileTip')?.classList.add('tip-fade'),8000);
})();
