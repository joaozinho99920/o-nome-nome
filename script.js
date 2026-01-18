// Roguelike Hybrid Prototype (index.html -> script.js)
// Arquivo: script.js
// IMPORTANTE: ajuste frame sizes no bloco CONFIG abaixo se precisar.

(() => {
  // ----------------- CONFIG -----------------
  const CONFIG = {
    canvasWidth: 960,
    canvasHeight: 640,
    tileSize: 32,
    mapCols: 40,
    mapRows: 30,
    playerSpeed: 120, // pixels/seg
    debug: false,
    // Spritesheets / imagens (URLs que você passou)
    assets: {
      hero: "https://opengameart.org/sites/default/files/rpg_sprite_walk.png",
      warrior: "https://opengameart.org/sites/default/files/dw_warrior.png",
      mage: "https://opengameart.org/sites/default/files/mago_0.png",
      slime: "https://opengameart.org/sites/default/files/slime_0.png",
      skeleton: "https://opengameart.org/sites/default/files/skeleton_walk_0.png",
      bat: "https://opengameart.org/sites/default/files/bat_0.png",
      dragon: "https://opengameart.org/sites/default/files/dragon_2.png",
      grass: "https://opengameart.org/sites/default/files/grass_15.png",
      dungeon: "https://opengameart.org/sites/default/files/pipo-map001_5.png",
      water: "https://opengameart.org/sites/default/files/water_1.png",
      interior: "https://opengameart.org/sites/default/files/interior_1.png",
      potion: "https://opengameart.org/sites/default/files/red_potion_0.png",
      sword: "https://opengameart.org/sites/default/files/iron_sword.png",
      shield: "https://opengameart.org/sites/default/files/shield_1.png",
      coin: "https://opengameart.org/sites/default/files/gold_coin_0.png",
      explosion: "https://opengameart.org/sites/default/files/explosion_0.png",
      slash: "https://opengameart.org/sites/default/files/slash_effect.png",
      ice: "https://opengameart.org/sites/default/files/ice_spell.png"
    },
    // If sprite sheets: set frame width & height for animation.
    // If these are wrong, the code will fallback to draw full image centered.
    spriteFrames: {
      hero: { fw: 32, fh: 48, cols: 3, rows: 4 }, // ajustar se necessário
      slime: { fw: 32, fh: 24, cols: 4, rows: 1 },
      skeleton: { fw: 32, fh: 32, cols: 4, rows: 4 },
      bat: { fw: 32, fh: 24, cols: 4, rows: 1 },
      dragon: { fw: 64, fh: 64, cols: 6, rows: 4 }
    },
    // Combat
    combatMode: "hybrid" // "real_time" | "turn_based" | "hybrid"
  };
  // -------------------------------------------

  // Canvas setup
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = CONFIG.canvasWidth;
  canvas.height = CONFIG.canvasHeight;

  // DOM hooks
  const hpSpan = document.getElementById("hp");
  const coinsSpan = document.getElementById("coins");
  const btnAttack = document.getElementById("btn-attack");
  const btnInventory = document.getElementById("btn-inventory");
  const invModal = document.getElementById("inventory-modal");
  const invItems = document.getElementById("inv-items");
  const closeInv = document.getElementById("close-inv");
  const combatOverlay = document.getElementById("combat-overlay");
  const combatLog = document.getElementById("combat-log");
  const combatTitle = document.getElementById("combat-title");
  const combatEndBtn = document.getElementById("combat-end");

  // Joystick
  const joystickEl = document.getElementById("joystick");
  const knobEl = document.getElementById("knob");
  const joystick = { x:0, y:0, active:false, radius: 56 };

  // Asset loader
  const assets = {};
  function loadImage(url) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => res(img);
      img.onerror = (e) => rej(e);
      img.src = url;
    });
  }

  // Preload all assets
  async function preloadAll() {
    const keys = Object.keys(CONFIG.assets);
    for (let k of keys) {
      try {
        assets[k] = await loadImage(CONFIG.assets[k]);
      } catch (e) {
        console.warn("Falha ao carregar asset:", k, CONFIG.assets[k], e);
        assets[k] = null;
      }
    }
  }

  // Utility: draw sprite with optional spritesheet frames config
  function drawSprite(img, fx, fy, scale=1, frameIdx=0, sheetCfg=null) {
    if (!img) return;
    if (sheetCfg && sheetCfg.fw && sheetCfg.fh) {
      const fw = sheetCfg.fw, fh = sheetCfg.fh;
      const cols = sheetCfg.cols || Math.floor(img.width / fw);
      const sx = (frameIdx % cols) * fw;
      const sy = Math.floor(frameIdx / cols) * fh;
      ctx.drawImage(img, sx, sy, fw, fh, fx - fw*scale/2, fy - fh*scale/2, fw*scale, fh*scale);
    } else {
      // fallback: draw centered scaled
      const w = img.width, h = img.height;
      ctx.drawImage(img, fx - (w*scale)/2, fy - (h*scale)/2, w*scale, h*scale);
    }
  }

  // ----------------- Map generation (simple rooms + corridors) -----------------
  class Map {
    constructor(cols, rows, tileSize){
      this.cols = cols; this.rows = rows; this.tileSize = tileSize;
      this.cells = new Array(rows).fill(0).map(()=> new Array(cols).fill(1)); // 1 wall, 0 floor
      this.rooms = [];
      this.generate();
    }
    generate(){
      // simple random rooms
      const maxRooms = 10;
      const rng = Math.random;
      for (let i=0;i<maxRooms;i++){
        const w = 3 + Math.floor(rng()*6);
        const h = 3 + Math.floor(rng()*6);
        const x = 1 + Math.floor(rng()*(this.cols-w-2));
        const y = 1 + Math.floor(rng()*(this.rows-h-2));
        const room = {x,y,w,h};
        let ok = true;
        for (let r of this.rooms){
          if (!(x + w < r.x || r.x + r.w < x || y + h < r.y || r.y + r.h < y)){
            ok=false; break;
          }
        }
        if (!ok) continue;
        this.rooms.push(room);
        for (let rx=x; rx<x+w; rx++){
          for (let ry=y; ry<y+h; ry++){
            this.cells[ry][rx]=0;
          }
        }
        // connect with previous
        if (this.rooms.length>1){
          const a = this.rooms[this.rooms.length-2];
          const b = room;
          const ax = Math.floor(a.x + a.w/2), ay = Math.floor(a.y + a.h/2);
          const bx = Math.floor(b.x + b.w/2), by = Math.floor(b.y + b.h/2);
          if (Math.random()>0.5){
            this.carveH(ax, bx, ay);
            this.carveV(ay, by, bx);
          } else {
            this.carveV(ay, by, ax);
            this.carveH(ax, bx, by);
          }
        }
      }
      // add water pockets randomly
      if (assets.water){
        for (let i=0;i<10;i++){
          const rx = 1 + Math.floor(Math.random()*(this.cols-2));
          const ry = 1 + Math.floor(Math.random()*(this.rows-2));
          this.cells[ry][rx]=2; // water
        }
      }
    }
    carveH(x1,x2,y){
      for (let x=Math.min(x1,x2); x<=Math.max(x1,x2); x++){
        this.cells[y][x]=0;
      }
    }
    carveV(y1,y2,x){
      for (let y=Math.min(y1,y2); y<=Math.max(y1,y2); y++){
        this.cells[y][x]=0;
      }
    }
    isWalkable(cx, cy){
      if (cx<0 || cy<0 || cx>=this.cols || cy>=this.rows) return false;
      return this.cells[cy][cx] === 0;
    }
    toPixels(cx, cy){
      return {x: cx*this.tileSize + this.tileSize/2, y: cy*this.tileSize + this.tileSize/2};
    }
    draw(viewX, viewY, viewW, viewH){
      // draw floor/walls using patterns or tile images
      const t = this.tileSize;
      // create patterns
      if (assets.grass) {
        ctx.fillStyle = ctx.createPattern(assets.grass, "repeat");
      } else {
        ctx.fillStyle = "#2b7a2b";
      }
      ctx.fillRect(0,0, canvas.width, canvas.height);
      // draw map cells
      for (let y=0;y<this.rows;y++){
        for (let x=0;x<this.cols;x++){
          const type = this.cells[y][x];
          const px = x*t - viewX;
          const py = y*t - viewY;
          if (px + t < 0 || py + t < 0 || px > viewW || py > viewH) continue;
          if (type === 0){
            // floor (already filled)
          } else if (type === 1){
            // wall
            if (assets.dungeon){
              // draw small tile from dungeon texture — attempt to tile it
              ctx.drawImage(assets.dungeon, 0,0, 32,32, px, py, t, t);
            } else {
              ctx.fillStyle = "#444";
              ctx.fillRect(px,py,t,t);
            }
          } else if (type === 2){
            // water
            if (assets.water){
              ctx.drawImage(assets.water, 0,0, 32,32, px, py, t, t);
            } else {
              ctx.fillStyle = "#0a4";
              ctx.fillRect(px,py,t,t);
            }
          }
        }
      }
    }
  }

  // ----------------- Entities -----------------
  class Entity {
    constructor(x,y, imgKey, sheetCfg=null){
      this.x = x; this.y = y;
      this.imgKey = imgKey;
      this.sheetCfg = sheetCfg;
      this.frame = 0;
      this.frameTimer = 0;
      this.facing = {x:0,y:1};
      this.scale = 1.4;
      this.hp = 100;
      this.maxHp = 100;
      this.id = Math.random().toString(36).slice(2,9);
    }
    update(dt){}
    draw(viewX, viewY){
      const img = assets[this.imgKey];
      const px = Math.round(this.x - viewX);
      const py = Math.round(this.y - viewY);
      if (this.sheetCfg && img){
        const f = Math.floor(this.frame);
        drawSprite(img, px, py, this.scale, f, this.sheetCfg);
      } else if (img){
        drawSprite(img, px, py, this.scale);
      } else {
        // fallback: circle
        ctx.fillStyle = "#f0f";
        ctx.beginPath();
        ctx.arc(px,py,12,0,Math.PI*2);
        ctx.fill();
      }
      // HP bar
      const w = 28, h = 4;
      const hx = px - w/2, hy = py - 30;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(hx-1,hy-1,w+2,h+2);
      ctx.fillStyle = "#ff4444";
      ctx.fillRect(hx, hy, w*(Math.max(0,this.hp)/this.maxHp), h);
    }
  }

  class Player extends Entity {
    constructor(x,y){
      super(x,y, "hero", CONFIG.spriteFrames.hero);
      this.speed = CONFIG.playerSpeed;
      this.maxHp = 100;
      this.hp = this.maxHp;
      this.attackRange = 36;
      this.attackDamage = 12;
      this.inventory = [
        {key:"potion", name:"Poção de Vida", qty:2},
        {key:"coin", name:"Moedas", qty:0},
        {key:"sword", name:"Espada de Ferro", qty:1},
      ];
      this.isTurn = false;
    }
    update(dt){
      // animation
      this.frameTimer += dt;
      if (this.frameTimer > 0.14){
        this.frameTimer = 0;
        this.frame = (this.frame + 1) % 4;
      }
      // movement handled externally by control
    }
    moveBy(vx, vy, dt, map){
      const nx = this.x + vx*dt;
      const ny = this.y + vy*dt;
      // simple collision with map
      const cx = Math.floor(nx / map.tileSize);
      const cy = Math.floor(ny / map.tileSize);
      if (map.isWalkable(cx, cy)){
        this.x = nx; this.y = ny;
      } else {
        // try axis separately
        const cxX = Math.floor((this.x + vx*dt) / map.tileSize);
        const cyX = Math.floor(this.y / map.tileSize);
        if (map.isWalkable(cxX, cyX)) this.x += vx*dt;
        const cxY = Math.floor(this.x / map.tileSize);
        const cyY = Math.floor((this.y + vy*dt) / map.tileSize);
        if (map.isWalkable(cxY, cyY)) this.y += vy*dt;
      }
    }
    attack(target){
      if (!target) return;
      target.hp -= this.attackDamage;
      appendCombatLog(`Você causou ${this.attackDamage} de dano no inimigo.`);
    }
    heal(amount){
      this.hp = Math.min(this.maxHp, this.hp + amount);
    }
  }

  class Enemy extends Entity {
    constructor(x,y,type){
      const cfgMap = {
        slime: CONFIG.spriteFrames.slime,
        skeleton: CONFIG.spriteFrames.skeleton,
        bat: CONFIG.spriteFrames.bat,
        dragon: CONFIG.spriteFrames.dragon
      };
      super(x,y, type, cfgMap[type] || null);
      this.type = type;
      this.speed = (type==="slime"?40: (type==="bat"?80:60));
      this.maxHp = (type==="slime"?20: (type==="skeleton"?30: (type==="dragon"?250:15)));
      this.hp = this.maxHp;
      this.attackDamage = (type==="slime"?6: (type==="skeleton"?8: (type==="dragon"?40:4)));
      this.detectRange = 160;
      this.attackRange = 36;
      this.isBoss = (type==="dragon");
      this.aggressive = false;
    }
    update(dt, player, map){
      // animation cycle
      this.frameTimer += dt;
      if (this.frameTimer > 0.16){
        this.frameTimer=0;
        this.frame = (this.frame+1)%4;
      }
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.hypot(dx,dy);
      if (dist < this.detectRange){
        // hybrid: request combat if close enough
        if (CONFIG.combatMode==="hybrid" && dist < 48){
          Combat.requestCombatWith([this], player);
          return;
        }
        // move toward player in real-time mode
        if (!Combat.inCombat || Combat.mode==="real_time"){
          const nx = dx/dist, ny = dy/dist;
          this.x += nx*this.speed*dt;
          this.y += ny*this.speed*dt;
        }
      } else {
        // roam a bit (idle)
        if (Math.random()<0.002) {
          this.x += (Math.random()-0.5)*16;
          this.y += (Math.random()-0.5)*16;
        }
      }
      if (this.hp<=0) this.onDie();
    }
    onDie(){
      // drop coin
      player.inventory.find(i=>i.key==="coin").qty += Math.floor(Math.random()*4)+1;
      coinsSpan.textContent = player.inventory.find(i=>i.key==="coin").qty;
      // remove from enemies list
      enemies = enemies.filter(e=>e!==this);
      appendCombatLog("Inimigo derrotado.");
    }
  }

  // ----------------- Combat manager (singleton-like) -----------------
  const Combat = {
    mode: CONFIG.combatMode,
    inCombat: false,
    queue: [],
    idx: 0,
    start(entities){
      if (this.mode === "real_time") return;
      this.inCombat = true;
      this.queue = entities.slice();
      this.idx = 0;
      combatOverlay.classList.remove("hidden");
      combatTitle.textContent = "Combate iniciado!";
      appendCombatLog("Combate iniciado.");
      this.nextTurn();
    },
    end(){
      this.inCombat = false;
      this.queue = [];
      this.idx = 0;
      combatOverlay.classList.add("hidden");
      appendCombatLog("Combate terminado.");
    },
    nextTurn(){
      if (!this.inCombat || this.queue.length===0){
        this.end(); return;
      }
      // clean dead
      this.queue = this.queue.filter(e=> e && e.hp>0);
      if (this.queue.length===0){ this.end(); return; }
      this.idx = this.idx % this.queue.length;
      const entity = this.queue[this.idx];
      if (!entity) { this.finishTurn(entity); return; }
      if (entity === player){
        appendCombatLog("Turno do jogador.");
        // enable attack button (player acts)
        btnAttack.disabled = false;
        player.isTurn = true;
      } else {
        appendCombatLog("Turno do inimigo.");
        // enemy acts automatically after short delay
        setTimeout(()=>{
          if (entity && entity.hp>0){
            entityAttack(entity, player);
          }
          this.finishTurn(entity);
        }, 700);
      }
    },
    finishTurn(entity){
      btnAttack.disabled = true;
      player.isTurn = false;
      this.idx = (this.idx+1) % Math.max(1,this.queue.length);
      setTimeout(()=> this.nextTurn(), 150);
    },
    requestCombatWith(enemiesArr, playerRef){
      if (this.mode === "real_time") return;
      if (this.inCombat) return;
      // queue: player first, then enemies present
      const entities = [playerRef].concat(enemiesArr);
      this.start(entities);
    }
  };

  // enemy attacks player
  function entityAttack(enemy, target){
    if (!enemy || !target) return;
    const did = enemy.attackDamage;
    target.hp = Math.max(0, target.hp - did);
    appendCombatLog(`Inimigo ${enemy.type} causou ${did} de dano.`);
    hpSpan.textContent = target.hp;
    if (target.hp<=0){
      appendCombatLog("Você morreu. Recarregue a página para reiniciar.");
    }
  }

  // ----------------- Input handling -----------------
  const keys = {};
  window.addEventListener("keydown", (e)=>{
    keys[e.key.toLowerCase()] = true;
  });
  window.addEventListener("keyup", (e)=>{
    keys[e.key.toLowerCase()] = false;
  });

  // Joystick touch handling
  function setupJoystick(){
    let startX=0, startY=0, active=false;
    joystickEl.addEventListener("touchstart", (ev)=>{
      ev.preventDefault();
      active = true;
      const t = ev.touches[0];
      const rect = joystickEl.getBoundingClientRect();
      startX = rect.left + rect.width/2;
      startY = rect.top + rect.height/2;
      updateKnob(t.clientX, t.clientY);
    });
    window.addEventListener("touchmove", (ev)=>{
      if (!active) return;
      ev.preventDefault();
      const t = ev.touches[0];
      updateKnob(t.clientX, t.clientY);
    }, {passive:false});
    window.addEventListener("touchend", (ev)=>{
      active=false;
      joystick.x=0; joystick.y=0;
      knobEl.style.transform = `translate(0px,0px)`;
    });
    function updateKnob(cx, cy){
      const rect = joystickEl.getBoundingClientRect();
      const cx_local = cx - (rect.left + rect.width/2);
      const cy_local = cy - (rect.top + rect.height/2);
      const r = joystick.radius;
      let nx = cx_local, ny = cy_local;
      const d = Math.hypot(nx,ny);
      if (d>r){ nx = nx/d*r; ny = ny/d*r; }
      knobEl.style.transform = `translate(${nx}px, ${ny}px)`;
      joystick.x = nx / r;
      joystick.y = ny / r;
    }
  }

  // ----------------- Game state -----------------
  let map, player, enemies = [];

  function spawnEnemiesFromRooms(){
    enemies = [];
    for (let i=0; i<8; i++){
      // pick random floor cell from map rooms
      const room = map.rooms[Math.floor(Math.random()*map.rooms.length)];
      const cx = room.x + 1 + Math.floor(Math.random()*(Math.max(1,room.w-2)));
      const cy = room.y + 1 + Math.floor(Math.random()*(Math.max(1,room.h-2)));
      const pos = map.toPixels(cx,cy);
      const types = ["slime","skeleton","bat"];
      const t = types[Math.floor(Math.random()*types.length)];
      enemies.push(new Enemy(pos.x, pos.y, t));
    }
    // add a boss in last room
    const last = map.rooms[map.rooms.length-1];
    if (last){
      const pos = map.toPixels(Math.floor(last.x+last.w/2), Math.floor(last.y+last.h/2));
      enemies.push(new Enemy(pos.x, pos.y, "dragon"));
    }
  }

  // ----------------- Rendering & camera -----------------
  let lastTime = 0;
  const camera = {x:0,y:0, w:CONFIG.canvasWidth, h:CONFIG.canvasHeight};

  function updateCamera(){
    camera.x = player.x - canvas.width/2;
    camera.y = player.y - canvas.height/2;
    // clamp to map bounds
    const mapW = map.cols*map.tileSize, mapH = map.rows*map.tileSize;
    camera.x = Math.max(0, Math.min(camera.x, mapW - canvas.width));
    camera.y = Math.max(0, Math.min(camera.y, mapH - canvas.height));
  }

  function appendCombatLog(text){
    const p = document.createElement("div");
    p.textContent = text;
    combatLog.appendChild(p);
    combatLog.scrollTop = combatLog.scrollHeight;
  }

  // ----------------- Main loop -----------------
  function gameLoop(ts){
    const dt = Math.min(0.05, (ts - lastTime)/1000);
    lastTime = ts;

    // process input & movement if not in turn-based lock
    let mvx=0,mvy=0;
    if (!Combat.inCombat || Combat.mode === "real_time"){
      // keyboard
      if (keys["arrowup"] || keys["w"]) mvy -= 1;
      if (keys["arrowdown"] || keys["s"]) mvy += 1;
      if (keys["arrowleft"] || keys["a"]) mvx -= 1;
      if (keys["arrowright"] || keys["d"]) mvx += 1;
      // joystick
      if (Math.abs(joystick.x) > 0.05 || Math.abs(joystick.y) > 0.05){
        mvx = joystick.x;
        mvy = joystick.y;
      }
      const mag = Math.hypot(mvx,mvy) || 0;
      if (mag>0.01){
        mvx /= mag; mvy /= mag;
        player.moveBy(mvx*player.speed, mvy*player.speed, dt, map);
        player.facing = {x:mvx,y:mvy};
      }
    }

    // Update entities
    player.update(dt);
    enemies.forEach(e => e.update(dt, player, map));

    updateCamera();

    // Draw
    ctx.clearRect(0,0, canvas.width, canvas.height);
    map.draw(camera.x, camera.y, canvas.width, canvas.height);
    // draw enemies
    for (let e of enemies) e.draw(camera.x, camera.y);
    // draw player on top
    player.draw(camera.x, camera.y);

    // UI updates
    hpSpan.textContent = player.hp;
    coinsSpan.textContent = player.inventory.find(i=>i.key==="coin").qty || 0;

    // Debug
    if (CONFIG.debug){
      ctx.fillStyle = "white";
      ctx.fillText(`Entities: ${enemies.length}`, 10, 20);
    }

    requestAnimationFrame(gameLoop);
  }

  // Attack button logic (works for both real time and turn-based)
  btnAttack.addEventListener("click", ()=>{
    // real-time: damage nearest enemy in range
    if (!Combat.inCombat || Combat.mode==="real_time"){
      let nearest = null, nd=9999;
      for (let e of enemies){
        const d = Math.hypot(player.x - e.x, player.y - e.y);
        if (d < player.attackRange && d < nd){
          nd = d; nearest = e;
        }
      }
      if (nearest){
        player.attack(nearest);
      } else {
        appendCombatLog("Nenhum inimigo perto para atacar.");
      }
    } else {
      // turn-based: only allowed if it's player's turn
      if (player.isTurn){
        // attack first enemy in queue that's not player
        const enemy = Combat.queue.find(ent => ent !== player);
        if (enemy){
          player.attack(enemy);
          // check enemy death
          if (enemy.hp <= 0) enemy.onDie();
        }
        Combat.finishTurn(player);
      } else {
        appendCombatLog("Não é seu turno.");
      }
    }
  });

  // Inventory
  btnInventory.addEventListener("click", ()=>{
    invModal.classList.remove("hidden");
    renderInventory();
  });
  closeInv.addEventListener("click", ()=> invModal.classList.add("hidden"));

  function renderInventory(){
    invItems.innerHTML = "";
    for (let it of player.inventory){
      const div = document.createElement("div");
      div.className = "inv-slot";
      const img = document.createElement("img");
      img.src = CONFIG.assets[it.key] || CONFIG.assets.potion;
      img.style.width = "40px";
      img.style.height = "40px";
      const label = document.createElement("div");
      label.textContent = `${it.name||it.key} x${it.qty}`;
      div.appendChild(img);
      div.appendChild(label);
      invItems.appendChild(div);
    }
  }

  combatEndBtn.addEventListener("click", ()=>{
    Combat.end();
  });

  // ----------------- Boot sequence -----------------
  async function startGame(){
    await preloadAll();
    map = new Map(CONFIG.mapCols, CONFIG.mapRows, CONFIG.tileSize);
    // place player at center of first room
    const startRoom = map.rooms[0] || {x:2,y:2,w:4,h:4};
    const startPos = map.toPixels(Math.floor(startRoom.x+startRoom.w/2), Math.floor(startRoom.y+startRoom.h/2));
    player = new Player(startPos.x, startPos.y);
    spawnEnemiesFromRooms();
    setupJoystick();
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
    // Add some initial UI state
    hpSpan.textContent = player.hp;
    coinsSpan.textContent = player.inventory.find(i=>i.key==="coin").qty;
    appendCombatLog("Bem-vindo à masmorra!");
  }

  // start
  startGame().catch(e=>{
    console.error("Erro no carregamento:", e);
    alert("Erro ao carregar assets. Rode via servidor (python -m http.server) se necessário.");
  });

  // Expose debug for console
  window.__GAME = { player, enemies, map, Combat };
})();
