# Rompe el bloque — resumen del proyecto y decisiones de diseño

Documento de traspaso para continuar el desarrollo en el computador. Contiene qué es el juego, las reglas actuales con sus valores exactos, las decisiones tomadas (y por qué), lo que está pendiente, y al final el **código fuente completo** de la versión actual.

- Idioma del juego y del usuario: **español**.
- Plataforma objetivo: **celular (táctil)**, jugado dentro de un artefacto de Claude (página HTML autocontenida).
- Estado: prototipo jugable, **no probado en un celular real por Claude** (solo se revisó el código). El usuario sí lo ha jugado y fue iterando.
- Versión publicada: artefacto "Rompe el bloque" (versión 6 de 6). El usuario es el dueño y es privado; el código fuente está al final de este archivo.

---

## 1. En qué consiste el juego

Aparecen bloques cuadrados pequeños en distintas partes de la pantalla, cada uno con un número. Hay que **tocar cada bloque tantas veces como indica su número** para destruirlo (un 6 = 6 toques). Aparecen varios a la vez y cada uno desaparece solo después de unos segundos si no se completó.

Es un juego de **supervivencia contra el reloj**: el tiempo baja constantemente, destruir bloques lo recupera, dejar escapar bloques lo castiga fuerte, y hay vidas que se pierden tocando donde no hay bloque. Hay además **bloques trampa** camuflados que penalizan si se tocan.

El objetivo es **destruir la mayor cantidad de bloques posible** (el récord es la cantidad de bloques destruidos).

---

## 2. Reglas actuales (valores exactos)

Todas las constantes están al inicio del script (`START_TIME`, `MAX_LIVES`, `LIFE_MIN`, `LIFE_MAX`, `BOMB_PENALTY`, `BOMB_CHANCE`, `MISS_MULT`).

| Regla | Valor actual |
|---|---|
| Tiempo inicial | **10 s** |
| Vidas | **5** (corazones arriba a la derecha) |
| Tiempo de vida de cada bloque en pantalla | **3 a 5 s, aleatorio uniforme**, independiente del número |
| Completar un bloque | **suma** a su número en segundos (un 6 → +6 s) |
| Bloque que desaparece sin completarse | **resta su número × 5** (`MISS_MULT = 5`). Un 3 → −15 s, un 5 → −25 s |
| Tocar fuera de un bloque | **−1 vida** (también si se toca donde había un bloque que ya desapareció) |
| Tocar un bloque trampa (una sola vez basta) | **−30 s** inmediatos (`BOMB_PENALTY = 30`) |
| Bloque trampa que desaparece solo | sin castigo |
| Fin de partida | tiempo ≤ 0, **o** vidas = 0 |
| Récord | mayor cantidad de bloques destruidos (se guarda en `localStorage`, clave `rb_best3`) |

Detalles importantes:

- El castigo por bloque escapado usa el **número original** del bloque (`b.total`), aunque el jugador ya le haya hecho algunos toques. Pedido explícito del usuario: "si era de 6 y le hice dos clics y desapareció, que me reste los 6 [×5]".
- El tiempo **puede superar** el inicial (no hay tope), porque cada bloque suma segundos.
- Un bloque escapado **no** quita vidas; solo quita tiempo. Las vidas se pierden **únicamente** por toques fuera de bloque. (El mensaje del usuario sobre esto quedó cortado a la mitad; se interpretó así y el usuario no lo corrigió.)

### Bloque trampa (camuflado)

- Se ve **igual que un bloque normal**: mismos colores, sin marco, con número. **La única diferencia es que su número es rojo** (`#ff2a2a`, con una sombra de texto sutil) en vez de blanco.
- Los colores de bloque normales dependen del número (paleta de 9 colores indexada por `n-1`). Si el número de la trampa es 1, 2 o 7 (colores rojo, naranjo y rosado, donde un número rojo no se vería), la trampa usa un color aleatorio de una paleta "segura" (`SAFE`: amarillo, verde, azul, morado, turquesa, violeta).
- Aparece solo después de **8 s de juego**, con **16 %** de probabilidad por cada bloque que se genera (`BOMB_CHANCE`), y **máximo 2 trampas a la vez**.
- Tiene número y barra de tiempo como los demás, pero el número es decorativo: **cualquier toque** la activa.

### Generación de bloques

- Número de cada bloque: aleatorio entre 1 y `maxNum`, con `maxNum = min(3 + floor(tiempoJugado/20), 9)` (parte en máx. 3 y sube hasta 9).
- Cantidad máxima simultánea: `min(3 + floor(tiempoJugado/30), 6)`.
- Pausa entre generaciones: `0.5 + rand*0.6 − min(tiempoJugado/120, 1)*0.25` segundos.
- Tamaño del bloque: entre 66 y 92 px, proporcional al área de juego (`min(ancho, alto)/4.2`).
- Posición: aleatoria dentro del área de juego, sin solaparse con otros (hasta 40 intentos; si no cabe, no genera).
- Cada bloque muestra una **barra blanca inferior** que se acorta con su tiempo restante.

### Interfaz

- Cabecera: **Destruidos** (izquierda) · **Tiempo** (centro, grande, formato m:ss) · **Vidas** (derecha, corazones).
- Barra de tiempo bajo la cabecera: ancho relativo al máximo de tiempo alcanzado en la partida (`barMax`). Se pone roja con ≤ 5 s (el reloj también).
- Pantalla de inicio / fin (overlay): reglas, récord, botón "Jugar" / "Jugar de nuevo". Al terminar muestra bloques destruidos y bloques escapados.
- Feedback: sonidos con WebAudio, vibración con `navigator.vibrate`, partículas al destruir, texto flotante (+Ns / −Ns), sacudida y destello rojo al perder vida o activar trampa, "✕" donde se tocó mal. Todo con `try/catch` porque puede no funcionar en el visor.

---

## 3. Decisiones de diseño (historial cronológico)

1. **HTML + CSS + JS en un solo archivo**, sin librerías, para publicarlo como artefacto y jugarlo desde el celular. Pedido original del usuario: bloque con número, tocar N veces para destruirlo, aparece otro.
2. **Bug de la v1**: la pantalla de inicio nunca se mostraba (faltaba la clase `on` en el overlay), así que el juego no arrancaba y solo se veía un "?". Corregido: el overlay arranca visible.
3. **v2 — rediseño pedido por el usuario**: bloques pequeños en distintas partes de la pantalla, varios a la vez, que aparecen y desaparecen, con límite de tiempo por bloque y un temporizador global (inicialmente 2 minutos).
4. **v3 — vidas y tiempo dinámico**:
   - 5 vidas; se pierde una al tocar fuera de un bloque.
   - Tiempo inicial 30 s (en vez de 2 min), y cada bloque completado suma su número en segundos.
   - Vida de bloques 4–7 s (porque el usuario sintió que desaparecían demasiado rápido).
5. **v4**:
   - Vida de bloques **3–5 s** (el usuario lo ajustó).
   - Bloque escapado resta su valor en segundos.
   - Aparecen **bloques trampa**: primero con bomba 💣 que quita 30 s.
6. **v5**:
   - Tiempo inicial **10 s**.
   - La bomba era "demasiado evidente" → pasó a ser un bloque negro con marco rojo y número rojizo claro.
7. **v6 (actual)**:
   - Aun así era muy evidente → la trampa ahora usa **los mismos colores que los normales, sin marco**, y solo cambia el color del número a rojo.
   - Castigo por bloque escapado **multiplicado ×5**.

Criterios que el usuario ha mostrado: quiere un juego **difícil y tenso**, que castigue el descuido; las trampas deben ser **sutiles**; prefiere ir ajustando números a mano a medida que juega.

---

## 4. Estructura técnica

- Un único archivo `index.html` (HTML + `<style>` + `<script>` IIFE), JavaScript clásico (`var`, sin módulos).
- Bucle de juego con `requestAnimationFrame`; `dt` limitado a 0.1 s para que cambiar de pestaña no "salte" el tiempo.
- Entrada con `pointerdown` (más rápido y multitáctil que `click`). Los bloques llaman a `stopPropagation()`; un listener en el campo detecta toques fuera de bloque (`missTap`). Un bloque en estado `.gone` tiene `pointer-events:none`, por eso tocar donde estaba cuenta como fallo.
- Estado principal: `blocks[]` (cada bloque: `el, sp, tb, n, left, total, bomb, life, max, x, y, size, dead`), `killed`, `missed`, `lives`, `timeLeft`, `played`, `barMax`, `playing`.
- Funciones clave: `spawn`, `hit`, `explodeBomb`, `expire`, `missTap`, `loop`, `end`, `start`, `burst`, `floatText`.
- Nota de nomenclatura: internamente la trampa se llama `bomb` / `explodeBomb` (herencia de cuando era una bomba 💣), pero ya no es una bomba visualmente.

### Restricciones del entorno de artefactos (si se vuelve a publicar ahí)

- Debe ser un solo documento HTML que empiece con `<!DOCTYPE html>`.
- Sin `alert/confirm/prompt`, sin descargas, sin `fetch` a otros hosts; imágenes solo `data:` o SVG inline.
- `localStorage` puede no existir o lanzar error: ya está envuelto en `try/catch`.
- Audio y vibración solo desde gestos del usuario y pueden ser ignorados: ya están envueltos en `try/catch`.

---

## 5. Pendientes, riesgos e ideas (sugerencias, no decisiones)

**Riesgos conocidos**

- **Dificultad muy alta, sin balancear.** Con 10 s iniciales, ×5 de castigo, 3–5 s de vida y números de hasta 9 toques, dejar escapar un solo bloque de 2 o más puede terminar la partida. Ya se le ofreció al usuario bajar el multiplicador o subir el tiempo inicial; no lo ha pedido.
- Bloques con números altos (7–9) en 3–5 s son casi imposibles en celular; podría convenir que la vida del bloque dependa un poco del número (el usuario pidió explícitamente que **no** dependa, así que consultarlo antes).
- No se ha probado en un celular real desde el lado de Claude (rendimiento de animaciones, tamaños de bloque, audio, vibración).
- La clave de récord cambió entre versiones (`rb_best`, `rb_best2`, `rb_best3`) porque las reglas cambiaban; los récords antiguos no se arrastran.

**Ideas posibles**

- Pausa, y botón para silenciar sonido/vibración.
- Modos de dificultad (el usuario ajusta mucho las constantes: exponerlas en un objeto `CONFIG` o en una pantalla de ajustes).
- Pruebas automáticas (por ejemplo Playwright con emulación táctil) para reglas de tiempo/vidas/trampas.
- Separar en `index.html` / `style.css` / `game.js` para trabajar en el computador y empaquetar como PWA instalable.
- Más tipos de bloque (por ejemplo bloque de tiempo extra, congelar, escudo), y marcador de racha/combo.
- Renombrar internamente `bomb` → `trap`.

---

## 6. Código fuente completo (versión actual, v6)

Guardar como `index.html` y abrir en el navegador para jugar.

```html
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>Rompe el bloque</title>
<style>
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
  html,body{margin:0;height:100%;background:#12121a;color:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;overflow:hidden;touch-action:manipulation}
  #app{position:relative;height:100%;display:flex;flex-direction:column}
  header{display:flex;justify-content:space-between;align-items:center;padding:12px 16px 8px}
  header .box{display:flex;flex-direction:column;min-width:80px;font-size:11px;opacity:.75;text-transform:uppercase;letter-spacing:.08em}
  header .box b{font-size:24px;color:#fff;letter-spacing:0;line-height:1.1}
  header .mid{align-items:center;opacity:1}
  header .mid b{font-size:38px;font-variant-numeric:tabular-nums;display:inline-block}
  header .mid b.low{color:#ff6369}
  header .mid b.gain{animation:gain .5s}
  header .mid b.hurt{animation:hurt .5s}
  @keyframes gain{0%{transform:scale(1);color:#fff}30%{transform:scale(1.25);color:#5fe08a}100%{transform:scale(1);color:#fff}}
  @keyframes hurt{0%{transform:scale(1);color:#fff}30%{transform:scale(1.25);color:#ff6369}100%{transform:scale(1)}}
  header .right{align-items:flex-end}
  #lives{font-size:20px !important;letter-spacing:1px !important;color:#ff6369 !important;white-space:nowrap}
  #lives .off{color:#3a3a4d}
  #bar{height:6px;margin:0 16px;background:#232333;border-radius:3px;overflow:hidden;flex:none}
  #bar i{display:block;height:100%;width:100%;background:#7cf}
  #field{position:relative;flex:1;margin:10px 0 0;overflow:hidden;touch-action:manipulation}
  #field.shake{animation:shake .25s}
  @keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-7px)}40%{transform:translateX(7px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}
  #flash{position:absolute;inset:0;background:#e5484d;opacity:0;pointer-events:none}
  #flash.on{animation:flash .3s}
  @keyframes flash{from{opacity:.28}to{opacity:0}}
  .blk{
    position:absolute;border-radius:16px;color:#fff;font-weight:800;
    display:flex;align-items:center;justify-content:center;overflow:hidden;
    background:var(--c);box-shadow:0 5px 0 rgba(0,0,0,.35);
    touch-action:manipulation;cursor:pointer;
    animation:spawn .25s cubic-bezier(.2,1.6,.4,1);
  }
  .blk span{pointer-events:none}
  .blk .t{position:absolute;left:0;bottom:0;height:6px;width:100%;background:rgba(255,255,255,.85);pointer-events:none}
  .blk.hit{animation:hit .12s}
  .blk.bomb{color:#ff2a2a;text-shadow:0 1px 0 rgba(0,0,0,.4)}
  .blk.gone{animation:gone .3s forwards;pointer-events:none;background:#555}
  @keyframes spawn{from{transform:scale(0) rotate(-20deg)}to{transform:scale(1)}}
  @keyframes hit{0%{transform:scale(.8)}60%{transform:scale(1.08)}100%{transform:scale(1)}}
  @keyframes gone{to{transform:scale(.2) rotate(25deg);opacity:0}}
  .p{position:absolute;width:10px;height:10px;border-radius:3px;pointer-events:none}
  .pts{position:absolute;font-weight:800;color:#5fe08a;pointer-events:none;font-size:22px;white-space:nowrap;animation:up .8s ease-out forwards}
  .pts.neg{color:#ff6369}
  .miss{position:absolute;font-weight:800;color:#ff6369;pointer-events:none;font-size:34px;animation:up .6s ease-out forwards}
  @keyframes up{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(-40px)}}
  #over{position:absolute;inset:0;background:#12121af2;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:24px;z-index:10}
  #over.on{display:flex}
  #over h1{margin:0;font-size:32px}
  #over p{margin:0;opacity:.85;line-height:1.5}
  button.main{margin-top:12px;background:#7cf;color:#12121a;border:0;font-size:22px;font-weight:800;padding:16px 40px;border-radius:16px;font-family:inherit}
  button.main:active{transform:scale(.96)}
</style>
</head>
<body>
<div id="app">
  <header>
    <div class="box">Destruidos<b id="killed">0</b></div>
    <div class="box mid">Tiempo<b id="time">0:10</b></div>
    <div class="box right">Vidas<b id="lives"></b></div>
  </header>
  <div id="bar"><i id="barfill"></i></div>
  <div id="field"><div id="flash"></div></div>

  <div id="over" class="on">
    <h1 id="ot">Rompe el bloque</h1>
    <p id="os">Toca cada bloque tantas veces como diga su número.<br>Empiezas con <b>30 segundos</b> y <b>5 vidas</b>.<br>Cada bloque que completas te <b>suma</b> su número en segundos.<br>Si un bloque desaparece sin completarlo, te <b>resta</b> su número <b>×5</b> (un 3 que se escapa = −15 s).<br>Si tocas fuera de un bloque, pierdes una vida.<br>Cuidado: hay bloques trampa. Si tocas uno, pierdes 30 segundos.</p>
    <p id="ob"></p>
    <button class="main" id="start">Jugar</button>
  </div>
</div>

<script>
(function(){
  var START_TIME=10, MAX_LIVES=5, LIFE_MIN=3, LIFE_MAX=5, BOMB_PENALTY=30, BOMB_CHANCE=0.16, MISS_MULT=5;
  var field=document.getElementById('field');
  var elKilled=document.getElementById('killed'), elLives=document.getElementById('lives'), elTime=document.getElementById('time');
  var bar=document.getElementById('barfill'), flash=document.getElementById('flash');
  var over=document.getElementById('over'), ot=document.getElementById('ot'), os=document.getElementById('os'), ob=document.getElementById('ob'), startBtn=document.getElementById('start');

  var SAFE=['#e5a50a','#30a46c','#0091ff','#6e56cf','#12a594','#8e4ec6'];
  var colors=['#e5484d','#f76b15','#e5a50a','#30a46c','#0091ff','#6e56cf','#d6409f','#12a594','#8e4ec6'];
  var blocks=[], killed=0, missed=0, lives=MAX_LIVES, timeLeft=START_TIME, played=0, barMax=START_TIME, playing=false, spawnCd=0, last=0, best=0;

  try{ best=parseInt(localStorage.getItem('rb_best3')||'0',10)||0; }catch(e){}
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
    if(rec){ best=killed; try{localStorage.setItem('rb_best3',String(best));}catch(e){} }
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
</script>
</body>
</html>

```
