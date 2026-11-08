(function(){
  var START_TIME=10, MAX_LIVES=5, LIFE_MIN=3, LIFE_MAX=5, BOMB_PENALTY=30, BOMB_CHANCE=0.16, MISS_MULT=5;
  var field=document.getElementById('field');
  var elKilled=document.getElementById('killed'), elLives=document.getElementById('lives'), elTime=document.getElementById('time');
  var bar=document.getElementById('barfill'), flash=document.getElementById('flash');
  var over=document.getElementById('over'), ot=document.getElementById('ot'), os=document.getElementById('os'), ob=document.getElementById('ob'), startBtn=document.getElementById('start');

  var SAFE=['#e5a50a','#30a46c','#0091ff','#6e56cf','#12a594','#8e4ec6'];
  var colors=['#e5484d','#f76b15','#e5a50a','#30a46c','#0091ff','#6e56cf','#d6409f','#12a594','#8e4ec6'];
  var blocks=[], killed=0, missed=0, lives=MAX_LIVES, timeLeft=START_TIME, played=0, barMax=START_TIME, playing=false, spawnCd=0, last=0, best=0;

  try{ best=parseInt(localStorage.getItem('tb_best1')||'0',10)||0; }catch(e){}
  if(best>0) ob.textContent='Récord: '+best+' bloques';

  var ac=null;
  function beep(f,d,type,v){
    try{
      if(!ac) ac=new (window.AudioContext||window.webkitAudioContext)();
      if(ac.state==='suspended') ac.resume();
      var o=ac.createOscillator(), g=ac.createGain();
      o.type=type||'square'; o.frequency.value=f; g.gain.value=v||0.05;
      g.gain.exponentialRampToValueAtTime(0.0001,ac.currentTime+d);
      o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime+d);
    }catch(e){}
  }
  function buzz(ms){ try{ navigator.vibrate&&navigator.vibrate(ms); }catch(e){} }

  function drawLives(){
    var h='';
    for(var i=0;i<MAX_LIVES;i++) h+=(i<lives?'<span>♥</span>':'<span class="off">♥</span>');
    elLives.innerHTML=h;
  }

  function timeFx(cls){
    elTime.classList.remove('gain','hurt'); void elTime.offsetWidth; elTime.classList.add(cls);
  }

  function blockSize(){ return Math.max(66,Math.min(92,Math.min(field.clientWidth,field.clientHeight)/4.2)); }

  function findSpot(size){
    var W=field.clientWidth, H=field.clientHeight, pad=6;
    for(var t=0;t<40;t++){
      var x=pad+Math.random()*(W-size-pad*2), y=pad+Math.random()*(H-size-pad*2);
      var ok=true;
      for(var i=0;i<blocks.length;i++){
        var b=blocks[i];
        if(Math.abs(b.x-x)<size+8 && Math.abs(b.y-y)<size+8){ ok=false; break; }
      }
      if(ok) return {x:x,y:y};
    }
    return null;
  }

  function spawn(){
    var maxNum=Math.min(3+Math.floor(played/20),9);
    var bombCount=0;
    for(var k=0;k<blocks.length;k++) if(blocks[k].bomb) bombCount++;
    // de vez en cuando aparece un bloque trampa (máx. 2 a la vez, no al comienzo)
    var isBomb=played>8 && bombCount<2 && Math.random()<BOMB_CHANCE;
    var n=1+Math.floor(Math.random()*maxNum);
    var size=blockSize();
    var spot=findSpot(size);
    if(!spot) return false;
    // vida del bloque: aleatoria entre 3 y 5 segundos, sin importar el número
    var life=LIFE_MIN+Math.random()*(LIFE_MAX-LIFE_MIN);
    var el=document.createElement('div');
    el.className='blk';
    el.style.width=el.style.height=size+'px';
    el.style.left=spot.x+'px'; el.style.top=spot.y+'px';
    var col=colors[(n-1)%colors.length];
    if(isBomb){
      el.classList.add('bomb');
      // mismos colores que un bloque normal; si el suyo es rojizo (el número rojo no se vería), usa otro
      if(n===1||n===2||n===7) col=SAFE[Math.floor(Math.random()*SAFE.length)];
    }
    el.style.setProperty('--c',col);
    el.style.fontSize=(size*0.5)+'px';
    var sp=document.createElement('span'); sp.textContent=n;
    var tb=document.createElement('div'); tb.className='t';
    el.appendChild(sp); el.appendChild(tb);
    var b={el:el,sp:sp,tb:tb,n:n,left:n,total:n,bomb:isBomb,life:life,max:life,x:spot.x,y:spot.y,size:size,dead:false};
    el.addEventListener('pointerdown',function(e){ e.preventDefault(); e.stopPropagation(); hit(b); });
    field.appendChild(el);
    blocks.push(b);
    return true;
  }

  function removeBlock(b){
    b.dead=true;
    var i=blocks.indexOf(b); if(i>-1) blocks.splice(i,1);
  }

  function burst(b,color,count){
    var cx=b.x+b.size/2, cy=b.y+b.size/2, c=color||getComputedStyle(b.el).getPropertyValue('--c');
    for(var i=0;i<(count||14);i++){
      var p=document.createElement('div'); p.className='p'; p.style.background=c;
      p.style.left=cx-5+'px'; p.style.top=cy-5+'px'; field.appendChild(p);
      var a=Math.random()*Math.PI*2, d=40+Math.random()*80;
      var anim=p.animate([
        {transform:'translate(0,0) scale(1)',opacity:1},
        {transform:'translate('+Math.cos(a)*d+'px,'+(Math.sin(a)*d+30)+'px) rotate('+(Math.random()*400)+'deg) scale(.2)',opacity:0}
      ],{duration:450+Math.random()*250,easing:'ease-out'});
      anim.onfinish=(function(el){return function(){el.remove();};})(p);
    }
  }

  function floatText(b,text,neg){
    var t=document.createElement('div'); t.className='pts'+(neg?' neg':''); t.textContent=text;
    t.style.left=Math.max(4,b.x+b.size/2-20)+'px'; t.style.top=(b.y+b.size/2-30)+'px';
    field.appendChild(t);
    setTimeout(function(){t.remove();},850);
  }

  function hurtFx(){
    flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on');
    field.classList.remove('shake'); void field.offsetWidth; field.classList.add('shake');
  }

  function hit(b){
    if(!playing||b.dead) return;
    if(b.bomb){ explodeBomb(b); return; }
    b.left--;
    b.sp.textContent=b.left>0?b.left:'';
    b.el.classList.remove('hit'); void b.el.offsetWidth; b.el.classList.add('hit');
    beep(300+(b.total-b.left)*70,0.07);
    buzz(10);
    if(b.left<=0){
      killed++; elKilled.textContent=killed;
      timeLeft+=b.total; // suma tantos segundos como el número del bloque
      timeFx('gain');
      beep(880,0.15,'triangle',0.09); buzz(30);
      burst(b);
      floatText(b,'+'+b.total+'s',false);
      b.el.remove();
      removeBlock(b);
    }
  }

  // tocar un bloque trampa: -30 segundos de inmediato
  function explodeBomb(b){
    timeLeft-=BOMB_PENALTY;
    timeFx('hurt');
    burst(b,'#ff6369',24);
    floatText(b,'-'+BOMB_PENALTY+'s',true);
    hurtFx();
    beep(90,0.4,'sawtooth',0.12); buzz(250);
    b.el.remove();
    removeBlock(b);
    if(timeLeft<=0){ timeLeft=0; end('tiempo'); }
  }

  function expire(b){
    removeBlock(b);
    if(b.bomb){
      // la trampa se esfuma sin consecuencias
      b.sp.textContent='';
      b.el.classList.add('gone');
      setTimeout(function(){b.el.remove();},320);
      return;
    }
    // bloque no completado: resta su valor original multiplicado por 5
    missed++;
    var pen=b.total*MISS_MULT;
    timeLeft-=pen;
    timeFx('hurt');
    floatText(b,'-'+pen+'s',true);
    beep(150,0.15,'sawtooth',0.05);
    b.sp.textContent='✕';
    b.el.classList.add('gone');
    setTimeout(function(){b.el.remove();},320);
  }

  // tocar fuera de un bloque (incluido donde había uno que ya desapareció) = pierdes una vida
  function missTap(e){
    if(!playing) return;
    if(e.target.closest && e.target.closest('.blk') && !e.target.closest('.blk.gone')) return;
    e.preventDefault();
    var r=field.getBoundingClientRect();
    var m=document.createElement('div'); m.className='miss'; m.textContent='✕';
    m.style.left=(e.clientX-r.left-12)+'px'; m.style.top=(e.clientY-r.top-24)+'px';
    field.appendChild(m); setTimeout(function(){m.remove();},650);
    hurtFx();
    beep(120,0.25,'sawtooth',0.08); buzz(80);
    lives--; drawLives();
    if(lives<=0) end('vidas');
  }

  function fmt(s){ s=Math.max(0,Math.ceil(s)); return Math.floor(s/60)+':'+('0'+(s%60)).slice(-2); }

  function loop(ts){
    var dt=Math.min((ts-last)/1000,0.1); last=ts;
    if(playing){
      timeLeft-=dt; played+=dt;

      var maxConc=Math.min(3+Math.floor(played/30),6);
      spawnCd-=dt;
      if(spawnCd<=0 && blocks.length<maxConc){
        if(spawn()) spawnCd=0.5+Math.random()*0.6-Math.min(played/120,1)*0.25;
        else spawnCd=0.2;
      }
      for(var i=blocks.length-1;i>=0;i--){
        var b=blocks[i];
        b.life-=dt;
        b.tb.style.width=Math.max(0,b.life/b.max*100)+'%';
        if(b.life<=0) expire(b);
      }

      elTime.textContent=fmt(timeLeft);
      elTime.classList.toggle('low',timeLeft<=5);
      if(timeLeft>barMax) barMax=timeLeft;
      bar.style.width=Math.min(100,Math.max(0,timeLeft/barMax*100))+'%';
      bar.style.background=timeLeft<=5?'#e5484d':'#7cf';
      if(timeLeft<=0) end('tiempo');
    }
    requestAnimationFrame(loop);
  }

  function end(reason){
    if(!playing) return;
    playing=false;
    for(var i=blocks.length-1;i>=0;i--){ blocks[i].el.remove(); }
    blocks=[];
    if(reason==='tiempo'){ elTime.textContent='0:00'; bar.style.width='0%'; }
    beep(200,0.5,'sawtooth',0.08); buzz(150);
    var rec=killed>best;
    if(rec){ best=killed; try{localStorage.setItem('tb_best1',String(best));}catch(e){} }
    ot.textContent=rec?'¡Nuevo récord!':(reason==='vidas'?'¡Sin vidas!':'¡Se acabó el tiempo!');
    os.innerHTML='Destruiste <b style="font-size:40px;color:#7cf">'+killed+'</b> bloques<br>Bloques que se escaparon: '+missed;
    ob.textContent='Récord: '+best+' bloques';
    startBtn.textContent='Jugar de nuevo';
    over.classList.add('on');
  }

  function start(){
    killed=0; missed=0; lives=MAX_LIVES; timeLeft=START_TIME; barMax=START_TIME; played=0; spawnCd=0;
    elKilled.textContent=0; elTime.textContent=fmt(START_TIME); elTime.className='';
    drawLives();
    bar.style.width='100%'; bar.style.background='#7cf';
    for(var i=0;i<blocks.length;i++) blocks[i].el.remove();
    blocks=[];
    over.classList.remove('on');
    playing=true;
    beep(520,0.1,'triangle',0.08);
  }

  field.addEventListener('pointerdown',missTap);
  startBtn.addEventListener('click',start);
  document.addEventListener('dblclick',function(e){e.preventDefault();});
  drawLives();
  requestAnimationFrame(function(ts){ last=ts; requestAnimationFrame(loop); });
})();
