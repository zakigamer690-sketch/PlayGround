(() => {
  const canvas = document.querySelector('#scene');
  const ctx = canvas.getContext('2d');
  const $ = (s) => document.querySelector(s);
  const scoreEl = $('#score'), clockEl = $('#clock'), toastEl = $('#toast');
  const missionTitle = $('#missionTitle'), missionText = $('#missionText');
  const card = $('#complete');
  const W = 1500, H = 1050;
  const bounds = { x: 54, y: 54, w: 1392, h: 942 };
  let vw = 0, vh = 0, dpr = 1, zoom = 1, cam = { x: 750, y: 525 };
  let last = performance.now(), elapsed = 0, toastTimer = 0, finished = false;
  const keys = new Set(), joy = { x: 0, y: 0, active: false, id: null };
  const player = { x: 735, y: 570, r: 17, speed: 208, dir: 0, walk: 0 };
  const obstacles = [
    {x:115,y:140,w:310,h:205,name:'DORMITORY',color:'#b8a98b'},
    {x:1075,y:140,w:310,h:205,name:'MESS HALL',color:'#bba985'},
    {x:115,y:735,w:310,h:190,name:'RECREATION',color:'#afa98d'},
    {x:1075,y:735,w:310,h:190,name:'INFIRMARY',color:'#b8aa91'},
    {x:665,y:118,w:170,h:102,name:'',color:'#aca68a'}
  ];
  const stamps = [
    {x:500,y:465, got:false, label:'MORNING ROLL'},
    {x:1005,y:470, got:false, label:'YARD DUTY'},
    {x:760,y:680, got:false, label:'CHOW LINE'}
  ];
  const kiosk = {x:750,y:362};
  const npcs = [
    {x:530,y:350,shirt:'#d88a54',pants:'#354552',name:'Milo',route:[[520,350],[630,350],[630,410],[520,410]],t:0,speed:30},
    {x:970,y:620,shirt:'#739c87',pants:'#38494c',name:'June',route:[[970,620],[1060,620],[1060,690],[970,690]],t:1.6,speed:24},
    {x:510,y:640,shirt:'#ccaa70',pants:'#464352',name:'Rook',route:[[510,640],[600,640],[600,700],[510,700]],t:2.4,speed:20},
    {x:1010,y:360,shirt:'#475d76',pants:'#282f3a',cap:true,name:'Officer',route:[[1010,360],[910,360],[910,420],[1010,420]],t:.4,speed:26,guard:true}
  ];
  const decor = [];
  // Deterministic little flecks bring the concrete and lawn to life without image assets.
  let seed = 1931;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for(let i=0;i<220;i++) decor.push({x:80+rand()*1340,y:80+rand()*890,r:1+rand()*2.2,a:.035+rand()*.07,green:rand()>.72});
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function resize(){
    dpr=Math.min(window.devicePixelRatio||1,2); vw=window.innerWidth; vh=window.innerHeight;
    canvas.width=Math.round(vw*dpr); canvas.height=Math.round(vh*dpr);
    canvas.style.width=vw+'px'; canvas.style.height=vh+'px';
    zoom=clamp(Math.min(vw/1000,vh/760),.48,.95);
  }
  window.addEventListener('resize',resize,{passive:true}); resize();
  function roundRect(x,y,w,h,r,fill,stroke,lw=1){
    ctx.beginPath();ctx.roundRect(x,y,w,h,r); if(fill){ctx.fillStyle=fill;ctx.fill()} if(stroke){ctx.lineWidth=lw;ctx.strokeStyle=stroke;ctx.stroke()}
  }
  function text(str,x,y,size,color,weight='700',align='center',spacing='0px'){
    ctx.save();ctx.font=`${weight} ${size}px ui-sans-serif,system-ui,sans-serif`;ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';ctx.letterSpacing=spacing;ctx.fillText(str,x,y);ctx.restore();
  }
  function line(x1,y1,x2,y2,color,width=1){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke()}
  function shadow(x,y,rx,ry,alpha=.16){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=`rgba(12,21,17,${alpha})`;ctx.fill()}
  function drawGround(){
    ctx.fillStyle='#84947b';ctx.fillRect(0,0,W,H);
    // Outdoor grass, worn paths, and courtyard paving.
    ctx.fillStyle='#839477';ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#aba58e';ctx.fillRect(bounds.x,bounds.y,bounds.w,bounds.h);
    ctx.fillStyle='#8c9a7a';ctx.fillRect(80,355,1340,380);
    ctx.fillStyle='#b8b19a';ctx.fillRect(440,350,620,390);
    ctx.fillStyle='#c1baa4';ctx.fillRect(452,362,596,366);
    ctx.fillStyle='#b0a994';ctx.fillRect(440,520,620,24);
    ctx.fillStyle='#b0a994';ctx.fillRect(740,350,24,390);
    // Shaded exercise court.
    ctx.fillStyle='#738a72';ctx.fillRect(515,572,470,143);
    ctx.strokeStyle='#d5d0b6';ctx.lineWidth=2;ctx.strokeRect(530,584,440,120);
    line(750,584,750,704,'#d5d0b6',2);ctx.beginPath();ctx.arc(750,644,34,0,Math.PI*2);ctx.stroke();
    // Garden beds around the yard.
    for(const bed of [[465,390,80,40],[955,390,80,40],[465,686,80,28],[955,686,80,28]]){
      roundRect(...bed,8,'#60795e','#d1c9aa',2);
      for(let j=0;j<5;j++){ctx.beginPath();ctx.arc(bed[0]+12+j*13,bed[1]+bed[3]/2,4,0,7);ctx.fillStyle=j%2?'#a2b17a':'#748d68';ctx.fill()}
    }
    for(const d of decor){ctx.beginPath();ctx.arc(d.x,d.y,d.r,0,7);ctx.fillStyle=d.green?`rgba(51,78,52,${d.a})`:`rgba(49,43,33,${d.a})`;ctx.fill()}
    // subtle court markings
    for(let i=0;i<8;i++){line(470+i*80,355,470+i*80,364,'#908a78',1);line(470+i*80,726,470+i*80,735,'#908a78',1)}
  }
  function drawBuilding(b){
    shadow(b.x+b.w/2,b.y+b.h-1,b.w*.51,14,.2);
    roundRect(b.x-6,b.y-5,b.w+12,b.h+12,12,'#8b806d');
    roundRect(b.x,b.y,b.w,b.h,9,b.color,'#6c685c',2);
    // roof seams, parapet and central entry alcove
    ctx.save();ctx.beginPath();ctx.roundRect(b.x+7,b.y+7,b.w-14,b.h-14,6);ctx.clip();
    ctx.fillStyle='#c7b99b';ctx.fillRect(b.x+8,b.y+8,b.w-16,24);
    for(let xx=b.x+20;xx<b.x+b.w;xx+=42) line(xx,b.y+34,xx,b.y+b.h-7,'#8b826f',1);
    ctx.restore();
    roundRect(b.x+b.w/2-34,b.y+b.h-12,68,25,4,'#655f52','#ded2b2',2);
    roundRect(b.x+b.w/2-25,b.y+b.h-8,50,16,3,'#33443b');
    // grouped windows
    for(let i=0;i<4;i++){
      const wx=b.x+26+i*68;
      roundRect(wx,b.y+55,39,34,4,'#455a56','#e0d4b8',3);
      line(wx+19,b.y+56,wx+19,b.y+88,'#d3c8ad',2);line(wx+2,b.y+72,wx+37,b.y+72,'#d3c8ad',2);
      roundRect(wx+3,b.y+99,33,13,3,'#8f7657');
    }
    text(b.name,b.x+b.w/2,b.y+158,12,'#f1e8d0','850','center','1.4px');
  }
  function drawPerimeter(){
    // thick, closed outer wall with capped corners and a single controlled gate
    ctx.fillStyle='#6b7164';ctx.fillRect(35,35,1430,19);ctx.fillRect(35,996,1430,19);
    ctx.fillRect(35,35,19,980);ctx.fillRect(1446,35,19,980);
    ctx.fillStyle='#969381';ctx.fillRect(45,54,9,942);ctx.fillRect(54,45,1392,9);
    ctx.fillRect(1446,54,9,942);ctx.fillRect(54,996,1392,9);
    for(let x=65;x<1440;x+=38){line(x,39,x+16,50,'#c7c2a8',2);line(x,1000,x+16,1011,'#c7c2a8',2)}
    for(let y=70;y<990;y+=38){line(39,y,50,y+16,'#c7c2a8',2);line(1450,y,1461,y+16,'#c7c2a8',2)}
    // secure gate at center north, fully closed
    roundRect(695,39,110,24,3,'#4a554d','#d2c8a9',2);
    for(let x=703;x<800;x+=12)line(x,40,x,62,'#c5c2ad',3);
    text('NORTHGATE · SECURE YARD',750,80,9,'#f3ecd7','850','center','1.7px');
    // corner lights
    for(const [x,y] of [[65,65],[1435,65],[65,985],[1435,985]]){
      ctx.beginPath();ctx.arc(x,y,9,0,7);ctx.fillStyle='#d5eaa1';ctx.fill();ctx.beginPath();ctx.arc(x,y,17,0,7);ctx.strokeStyle='#d5eaa133';ctx.lineWidth=2;ctx.stroke();
    }
  }
  function drawBench(x,y,rot=0){
    ctx.save();ctx.translate(x,y);ctx.rotate(rot);shadow(0,8,35,8,.2);
    roundRect(-32,-12,64,10,3,'#84674c','#554a3b',2);roundRect(-32,2,64,10,3,'#a28461','#554a3b',2);
    line(-25,11,-25,19,'#4b4c42',4);line(25,11,25,19,'#4b4c42',4);ctx.restore();
  }
  function drawProps(){
    // tables, benches, water fountain, basketball hoop and the check-in kiosk
    drawBench(350,480);drawBench(1150,480);drawBench(350,650);drawBench(1150,650);
    drawBench(650,300,Math.PI/2);drawBench(850,300,Math.PI/2);
    shadow(750,390,39,12,.18);roundRect(716,372,68,39,8,'#6d8b72','#33473b',2);
    roundRect(722,378,56,17,4,'#d7e89a');text('CHECK IN',750,386,8,'#314333','900','center','.7px');
    roundRect(739,397,22,10,2,'#31483d');
    // water fountain
    shadow(435,550,19,8,.2);roundRect(421,530,28,30,7,'#d1cbb7','#65675b',2);ctx.beginPath();ctx.arc(435,535,7,Math.PI,0);ctx.strokeStyle='#717b6d';ctx.lineWidth=2;ctx.stroke();
    // hoop and yard markings
    ctx.beginPath();ctx.arc(750,592,13,0,Math.PI*2);ctx.strokeStyle='#e2d9bd';ctx.lineWidth=3;ctx.stroke();line(742,578,758,578,'#d9d3ba',3);line(742,578,742,587,'#d9d3ba',2);line(758,578,758,587,'#d9d3ba',2);
    // wall-mounted lamps on building approaches
    for(const [x,y] of [[450,318],[1050,318],[450,760],[1050,760]]){
      shadow(x,y+6,10,5,.2);ctx.beginPath();ctx.arc(x,y,6,0,7);ctx.fillStyle='#eee1b4';ctx.fill();
    }
    // stamped routine cards, bob and softly pulse until picked up
    stamps.forEach((s,i)=>{if(s.got)return;const bob=Math.sin(elapsed*3+i*1.6)*3;const pulse=.5+.5*Math.sin(elapsed*4+i);
      ctx.save();ctx.translate(s.x,s.y+bob);ctx.globalAlpha=.22+.12*pulse;ctx.beginPath();ctx.arc(0,0,31+pulse*3,0,7);ctx.fillStyle='#d8f278';ctx.fill();ctx.globalAlpha=1;
      shadow(0,11,15,5,.22);ctx.rotate(-.08);roundRect(-13,-17,26,34,5,'#e5e9c2','#62754d',2);roundRect(-8,-11,16,9,2,'#829c64');line(-8,3,8,3,'#9b9b76',2);line(-8,8,4,8,'#9b9b76',2);ctx.restore();
      text(s.label,s.x,s.y+31,8,'#fff6d8','850','center','1px');
    });
  }
  function drawPerson(p,isPlayer=false){
    const bob=isPlayer&&Math.hypot(inputX(),inputY())>.08?Math.sin(player.walk*11)*2:Math.sin(elapsed*2+p.x*.03)*.7;
    shadow(p.x,p.y+11,16,7,.25);
    ctx.save();ctx.translate(p.x,p.y+bob);ctx.rotate(isPlayer?player.dir:0);
    // legs and shoes
    roundRect(-10,1,8,15,4,p.pants||'#35444a');roundRect(2,1,8,15,4,p.pants||'#35444a');
    roundRect(-11,12,10,5,2,'#343c39');roundRect(2,12,10,5,2,'#343c39');
    // uniform torso, shoulders and arms
    roundRect(-13,-12,26,23,8,p.shirt||'#577d68','#29382f',1.4);
    roundRect(-17,-9,7,15,4,p.shirt||'#577d68');roundRect(10,-9,7,15,4,p.shirt||'#577d68');
    // face and hair
    ctx.beginPath();ctx.ellipse(0,-17,10,10,0,0,Math.PI*2);ctx.fillStyle='#d8a980';ctx.fill();
    ctx.beginPath();ctx.arc(0,-20,10,Math.PI,Math.PI*2);ctx.fillStyle=p.guard?'#39404a':'#55483b';ctx.fill();
    ctx.fillStyle='#29352f';ctx.beginPath();ctx.arc(4,-17,1.3,0,7);ctx.fill();
    if(p.cap){ctx.fillStyle='#344456';ctx.beginPath();ctx.ellipse(0,-23,12,5,0,Math.PI,Math.PI*2);ctx.fill();roundRect(-11,-24,22,3,2,'#344456')}
    if(isPlayer){roundRect(-3,-8,6,7,2,'#d8f278');ctx.beginPath();ctx.arc(0,-32,3,0,7);ctx.fillStyle='#d8f278';ctx.fill()}
    ctx.restore();
    if(!isPlayer&&dist(player,p)<95)text(p.name,p.x,p.y-43,9,p.guard?'#dce4ec':'#eee8d8','800');
  }
  // input helpers used by animation and collision
  function inputX(){return (keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0)+joy.x}
  function inputY(){return (keys.has('ArrowDown')||keys.has('s')?1:0)-(keys.has('ArrowUp')||keys.has('w')?1:0)+joy.y}
  function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
  function blocked(x,y){
    const r=player.r;
    if(x-r<bounds.x+5||x+r>bounds.x+bounds.w-5||y-r<bounds.y+5||y+r>bounds.y+bounds.h-5)return true;
    for(const o of obstacles){if(x+r>o.x&&x-r<o.x+o.w&&y+r>o.y&&y-r<o.y+o.h)return true}
    // solid furniture and kiosk
    for(const [ox,oy,rr] of [[750,390,30],[435,545,20],[650,300,22],[850,300,22]])if(Math.hypot(x-ox,y-oy)<r+rr)return true;
    return false;
  }
  function movePerson(p,dt){
    if(p.guard){p.t+=dt*p.speed/105;const a=p.route[Math.floor(p.t)%p.route.length],b=p.route[(Math.floor(p.t)+1)%p.route.length],f=p.t%1;p.x=a[0]+(b[0]-a[0])*f;p.y=a[1]+(b[1]-a[1])*f;return}
    p.t+=dt*p.speed/100;const a=p.route[Math.floor(p.t)%p.route.length],b=p.route[(Math.floor(p.t)+1)%p.route.length],f=p.t%1;p.x=a[0]+(b[0]-a[0])*f;p.y=a[1]+(b[1]-a[1])*f;
  }
  function toast(message){toastEl.textContent=message;toastEl.classList.add('show');toastTimer=2.2}
  function collected(){return stamps.filter(s=>s.got).length}
  function updateUI(){
    const count=collected();scoreEl.textContent=`${count} / 3`;
    document.querySelectorAll('.dot').forEach((el,i)=>el.classList.toggle('filled',i<count));
    if(count===3){missionTitle.textContent='Back to the kiosk.';missionText.textContent='All 3 routine stamps collected. Head to the green check-in kiosk and tap interact.'}
    if(dist(player,kiosk)<75){$('#hint').innerHTML=count===3?'<b>INTERACT</b> to check in':'<b>CHECK-IN KIOSK</b> · stamps '+count+' / 3'}
    else if(count===3)$('#hint').innerHTML='<b>CHECK IN</b> at the green kiosk';
    else $('#hint').innerHTML='<b>MOVE</b> with the stick · roam the yard';
  }
  function interact(){
    if(dist(player,kiosk)<72){if(collected()===3){finished=true;card.classList.add('show');missionTitle.textContent='Morning, handled.';missionText.textContent='You checked in right on time. Take a look around.';toast('Check-in complete — nice work!')}else toast(`Need ${3-collected()} more routine stamp${3-collected()===1?'':'s'}`);return}
    const near=npcs.find(n=>dist(player,n)<63);if(near)toast(near.guard?'Officer: Keep to the marked yard.':`${near.name}: Morning. Good day for a lap.`);
  }
  $('#action').addEventListener('pointerdown',e=>{e.preventDefault();interact()});
  $('#continue').addEventListener('click',()=>{card.classList.remove('show');finished=false});
  window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();keys.add(k);if(k===' '&&!e.repeat)interact()});
  window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  function joystick(e){const rect=$('#stick').getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2,dx=e.clientX-cx,dy=e.clientY-cy,max=rect.width*.31,len=Math.hypot(dx,dy),mag=Math.min(1,len/max);joy.x=dx/(len||1)*mag;joy.y=dy/(len||1)*mag;const knob=$('#knob');knob.style.transform=`translate(${joy.x*max}px,${joy.y*max}px)`}
  const stickEl=$('#stick');
  stickEl.addEventListener('pointerdown',e=>{e.preventDefault();joy.active=true;joy.id=e.pointerId;stickEl.setPointerCapture(e.pointerId);joystick(e)});
  stickEl.addEventListener('pointermove',e=>{if(joy.active&&e.pointerId===joy.id)joystick(e)});
  function releaseStick(e){if(e.pointerId!==joy.id)return;joy.active=false;joy.id=null;joy.x=joy.y=0;$('#knob').style.transform='translate(0,0)'}
  stickEl.addEventListener('pointerup',releaseStick);stickEl.addEventListener('pointercancel',releaseStick);
  function update(dt){
    elapsed+=dt;
    const ix=clamp(inputX(),-1,1),iy=clamp(inputY(),-1,1),len=Math.hypot(ix,iy);
    if(len>.08){const nx=ix/Math.max(1,len),ny=iy/Math.max(1,len);player.dir=Math.atan2(ny,nx)+Math.PI/2;player.walk+=dt;
      const speed=player.speed*(keys.has('shift')?1.38:1),dx=nx*speed*dt,dy=ny*speed*dt;
      if(!blocked(player.x+dx,player.y))player.x+=dx;if(!blocked(player.x,player.y+dy))player.y+=dy;
    }
    for(const n of npcs)movePerson(n,dt);
    stamps.forEach(s=>{if(!s.got&&dist(player,s)<32){s.got=true;toast(`${s.label} stamp collected`);updateUI()}});
    const targetX=clamp(player.x,340,1160),targetY=clamp(player.y,270,780);
    cam.x+=(targetX-cam.x)*Math.min(1,dt*4);cam.y+=(targetY-cam.y)*Math.min(1,dt*4);
    if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)toastEl.classList.remove('show')}
    const minutes=Math.floor(elapsed*2),hh=6+Math.floor((30+minutes)/60),mm=(30+minutes)%60;
    clockEl.textContent=`${String(hh>12?hh-12:hh).padStart(2,'0')}:${String(mm).padStart(2,'0')} ${hh>=12?'PM':'AM'}`;
  }
  function render(){
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,vw,vh);ctx.fillStyle='#18251f';ctx.fillRect(0,0,vw,vh);
    ctx.save();ctx.translate(vw/2-cam.x*zoom,vh/2-cam.y*zoom);ctx.scale(zoom,zoom);
    drawGround();drawPerimeter();
    obstacles.forEach(drawBuilding);drawProps();
    // far characters, then player, then near characters for a convincing top-down overlap
    npcs.filter(n=>n.y<player.y).forEach(n=>drawPerson(n));drawPerson({...player,shirt:'#638d72',pants:'#35434a'},true);npcs.filter(n=>n.y>=player.y).forEach(n=>drawPerson(n));
    // map-edge whiteboard plan graphic
    ctx.restore();
    const vignette=ctx.createRadialGradient(vw/2,vh/2,Math.min(vw,vh)*.3,vw/2,vh/2,Math.max(vw,vh)*.76);vignette.addColorStop(0,'rgba(9,17,13,0)');vignette.addColorStop(1,'rgba(9,17,13,.24)');ctx.fillStyle=vignette;ctx.fillRect(0,0,vw,vh);
  }
  function frame(now){const dt=Math.min(.04,(now-last)/1000);last=now;update(dt);render();requestAnimationFrame(frame)}
  updateUI();requestAnimationFrame(frame);
})();
