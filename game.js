/* ============================================================
   Chess Puzzle – game engine (vanilla JS, mobile-first)
   v5: multi-goal (AND & SEQ order-free), polished UI
   ============================================================ */

(() => {
  'use strict';

  // ── Pieces ──
  const GLYPH = { N:'♘', Q:'♕', R:'♖', B:'♗', P:'♙', n:'♞', q:'♛', r:'♜', b:'♝', p:'♟' };
  const NAME = { N:'Caballo', Q:'Reina', R:'Torre', B:'Alfil', P:'Peón' };
  const isUpper = ch => ch>='A'&&ch<='Z';
  const isPiece = ch => isUpper(ch)||(ch>='a'&&ch<='z');
  const pieceType = ch => (ch||'').toUpperCase();
  const colorName = ch => isUpper(ch)?'blanco':'negro';
  const colorArticle = ch => isUpper(ch)?'el':'la';

  // ── Parser ──
  // Goal syntax:
  //   f = n          → single: piece "n" must reach marker "f"
  //   f,g = n        → AND:   piece(s) "n" must occupy ALL markers f,g simultaneously
  //   f > g = n      → SEQ:   piece "n" must visit all markers in ANY order (checklist)
  //   f > g > h = n  → longer checklist (order-free)

  function parseGoalLine(line) {
    // AND:  f,g,h = n
    let m = line.match(/^\s*([a-z](?:\s*,\s*[a-z])+)\s*=\s*([NQRBPnqrbp])\s*$/);
    if (m) {
      const markers = m[1].split(',').map(s=>s.trim()).filter(s=>s);
      const piece = m[2];
      if (!/^[a-z]$/.test(markers[0])) return null; // must be lowercase markers
      return { type:'and', markers, piece };
    }
    // SEQ:  f > g > h = n
    m = line.match(/^\s*([a-z](?:\s*>\s*[a-z])+)\s*=\s*([NQRBPnqrbp])\s*$/);
    if (m) {
      const markers = m[1].split('>').map(s=>s.trim()).filter(s=>s);
      const piece = m[2];
      return { type:'seq', markers, piece };
    }
    // Single:  f = n
    m = line.match(/^\s*([a-z])\s*=\s*([NQRBPnqrbp])\s*$/);
    if (m) return { type:'single', markers:[m[1]], piece:m[2] };
    return null;
  }

  function parseLevels(text) {
    const lines = text.split(/\r?\n/);
    const levels = [];
    let cur = null;

    const finish = () => {
      if (!cur) return;
      if (cur.rows.length && cur.goals.length) {
        try { levels.push(buildLevel(cur)); }
        catch(e) { console.warn('Nivel inválido:', cur.name, e.message); }
      }
      cur = null;
    };

    for (const rawLine of lines) {
      const line = rawLine.replace(/\s+$/, '');
      const hdr = line.match(/^\s*={2,}\s*(.+?)\s*={2,}\s*$/);
      if (hdr) {
        finish();
        cur = { name:hdr[1], desc:'', rows:[], goals:[], viewBlack:false, markerDecls:{} };
        continue;
      }
      if (!cur) continue;
      if (/^\s*#\s*view:\s*black\s*$/i.test(line)) { cur.viewBlack = true; continue; }
      // Marker position override: # @f=2,3
      const md = line.match(/^\s*#\s*@([a-z])\s*=\s*(\d+)\s*,\s*(\d+)\s*$/);
      if (md) {
        if (!cur.markerDecls) cur.markerDecls = {};
        cur.markerDecls[md[1]] = { row: Number(md[2]), col: Number(md[3]) };
        continue;
      }
      if (/^\s*#/.test(line)) {
        cur.desc = cur.desc ? cur.desc+' '+line.replace(/^\s*#\s?/,'') : line.replace(/^\s*#\s?/,'');
        continue;
      }
      const g = parseGoalLine(line);
      if (g) { cur.goals.push(g); continue; }
      if (!line.trim()) { if (cur.rows.length && cur.goals.length) finish(); continue; }
      cur.rows.push(line);
    }
    finish();
    return levels;
  }

  function buildLevel({ name, desc, rows, goals, viewBlack, markerDecls }) {
    while (rows.length && !rows[0].trim()) rows.shift();
    while (rows.length && !rows[rows.length-1].trim()) rows.pop();
    if (!rows.length) throw new Error('Sin filas');
    const W = rows[0].length;
    for (const r of rows) if (r.length!==W) throw new Error('Filas desiguales');
    const grid = rows.map(r => r.split(''));

    // Validate all markers exist on the grid or have a declared position
    const allMarkers = new Set();
    for (const g of goals) for (const m of g.markers) allMarkers.add(m);
    const decl = markerDecls || {};
    for (const mc of Object.keys(decl)) {
      if (decl[mc].row < 0 || decl[mc].row >= grid.length || decl[mc].col < 0 || decl[mc].col >= W)
        throw new Error(`Marcador '${mc}' fuera del tablero en @${mc}=${decl[mc].row},${decl[mc].col}`);
    }
    for (const m of allMarkers) {
      // Declared markers may be hidden under pieces — skip grid count check
      if (decl[m]) continue;
      let cnt = 0;
      for (let r=0; r<grid.length; r++) for (let c=0; c<W; c++)
        if (grid[r][c]===m) cnt++;
      if (cnt!==1) throw new Error(`Marcador '${m}' debe aparecer 1 vez (${cnt}). Usa # @${m}=fila,col si está bajo una pieza.`);
    }
    // Validate characters
    for (let r=0; r<grid.length; r++) for (let c=0; c<W; c++) {
      const ch = grid[r][c];
      if (ch==='.'||ch==='x'||allMarkers.has(ch)) continue;
      if (isPiece(ch)&&GLYPH[ch]) continue;
      throw new Error(`Carácter no válido '${ch}' en (${r},${c})`);
    }
    // Validate goal pieces exist (or can coronate)
    for (const g of goals) {
      let cnt = 0;
      for (const row of grid) for (const ch of row) if (ch===g.piece) cnt++;
      if (cnt===0) {
        const alt = g.piece.toUpperCase()===g.piece?'P':'p';
        let ac = 0;
        for (const row of grid) for (const ch of row) if (ch===alt) ac++;
        if (!(ac>0&&(g.piece==='Q'||g.piece==='q')))
          throw new Error(`No hay pieza '${g.piece}' en el tablero`);
      }
    }

    // Build marker lookup — use declared positions where provided
    const markerPos = {};
    for (const m of allMarkers) {
      if (decl[m]) {
        markerPos[m] = decl[m];
      } else {
        for (let r=0; r<grid.length; r++) for (let c=0; c<W; c++)
          if (grid[r][c]===m) markerPos[m] = { row:r, col:c };
      }
    }

    return {
      name, description:desc, grid, W, H:grid.length,
      goals, allMarkers, markerPos,
      viewBlack: !!viewBlack,
    };
  }

  // ── Movement (NO captures) ──
  function cellFree(ch, markers) {
    return ch==='.' || markers.has(ch);
  }

  function legalMoves(board, r, c, markers, viewBlack) {
    const H=board.length, W=board[0].length;
    const ch=board[r][c];
    if (!isPiece(ch)||!GLYPH[ch]) return [];
    const t=pieceType(ch);
    const inb=(rr,cc)=>rr>=0&&rr<H&&cc>=0&&cc<W;
    const out=[];

    const slide = dirs => {
      for (const [dr,dc] of dirs) {
        let rr=r+dr, cc=c+dc;
        while (inb(rr,cc)) {
          const cell=board[rr][cc];
          if (cell==='x') break;
          if (cellFree(cell, markers)) { out.push([rr,cc]); rr+=dr; cc+=dc; continue; }
          break; // any piece blocks
        }
      }
    };
    const step = dirs => {
      for (const [dr,dc] of dirs) {
        const rr=r+dr, cc=c+dc;
        if (!inb(rr,cc)) continue;
        if (cellFree(board[rr][cc], markers)) out.push([rr,cc]);
      }
    };

    const ROOK=[[-1,0],[1,0],[0,-1],[0,1]], BISHOP=[[-1,-1],[-1,1],[1,-1],[1,1]];
    const QUEEN=[...ROOK,...BISHOP], KNIGHT=[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];

    if (t==='R') slide(ROOK);
    else if (t==='B') slide(BISHOP);
    else if (t==='Q') slide(QUEEN);
    else if (t==='N') step(KNIGHT);
    else if (t==='P') {
      const dir = isUpper(ch)?-1:(viewBlack?-1:1);
      const fr=r+dir;
      if (inb(fr,c) && cellFree(board[fr][c], markers)) out.push([fr,c]);
    }
    return out;
  }

  function shouldCoronate(board, r, c, viewBlack) {
    const ch=board[r][c];
    if (ch!=='P'&&ch!=='p') return false;
    return isUpper(ch)?(r===0):(viewBlack?r===0:r===board.length-1);
  }

  // ── Win check ──
  function checkWin(board, goals, markerPos) {
    for (const g of goals) {
      if (g.type === 'single' || g.type === 'and') {
        // All markers must have a piece of the goal type
        for (const m of g.markers) {
          const pos = markerPos[m];
          const ch = board[pos.row][pos.col];
          if (ch !== g.piece) return false;
        }
      } else if (g.type === 'seq') {
        // SEQ = checklist: must visit ALL markers in any order, tracking via visited set.
        // Win is checked in doMove via seqVisited — here we just verify the piece is on a marker.
        for (const m of g.markers) {
          const pos = markerPos[m];
          const ch = board[pos.row][pos.col];
          if (ch === g.piece) return true; // piece is on some goal — let doMove handle win
        }
        return false;
      }
    }
    return true;
  }

  // ── State ──
  const state = {
    levels:[], levelIndex:0,
    board:null, markers:null, allMarkers:null, goals:null, markerPos:null,
    original:null, selected:null, legalDest:[], history:[],
    moves:0, won:false, viewBlack:false,
    // SEQ tracking: for each seq goal, Set of marker keys already visited (order-free)
    seqVisited:null,
    // Progress: Set of completed level indices
    completed:new Set(),
  };
  const cloneGrid = g => g.map(r=>r.slice());

  // ── Progress persistence ──
  const STORAGE_KEY = 'chess-puzzle-progress';
  const MAX_HISTORY = 50;
  function saveProgress() {
    try {
      const seqRaw = {};
      if (state.seqVisited) {
        for (const [k,v] of Object.entries(state.seqVisited)) seqRaw[k] = [...v];
      }
      const hist = state.history.slice(-MAX_HISTORY).map(h => ({
        board: h.board,
        moves: h.moves,
        seqVisited: h.seqVisited ? Object.fromEntries(
          Object.entries(h.seqVisited).map(([k,v]) => [k, [...v]])
        ) : null,
      }));
      // Read existing data, update only this level's slot
      const existing = (()=>{
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
        catch(_) { return {}; }
      })();
      if (!existing.positions) existing.positions = {};
      existing.positions[state.levelIndex] = {
        board: state.board, original: state.original,
        moves: state.moves, history: hist,
        seqVisited: seqRaw, won: state.won,
        viewBlack: state.viewBlack,
      };
      existing.completed = [...state.completed];
      existing.lastLevel = state.levelIndex;
      existing.updated = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    } catch(e) { /* localStorage not available */ }
  }
  function loadProgress(maxLevels) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { completed: new Set(), lastLevel: 0 };
      const data = JSON.parse(raw);
      const completed = new Set((data.completed||[]).filter(i => i>=0 && i<maxLevels));
      const lastLevel = Math.min(data.lastLevel||0, maxLevels-1);
      return { completed, lastLevel };
    } catch(e) { return { completed: new Set(), lastLevel: 0 }; }
  }
  // Read saved position for a specific level directly from localStorage
  function getSavedPosition(idx) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      const pos = (data.positions && data.positions[idx]) ? data.positions[idx] : null;
      if (!pos || !pos.board || pos.won) return null;
      // Reconstruct seqVisited Sets from arrays
      let sv = {};
      if (pos.seqVisited) {
        for (const [k,v] of Object.entries(pos.seqVisited)) sv[k] = new Set(v);
      }
      // Reconstruct history with Sets
      let hist = [];
      if (pos.history) {
        hist = pos.history.map(h => {
          const hsv = {};
          if (h.seqVisited) {
            for (const [k,v] of Object.entries(h.seqVisited)) hsv[k] = new Set(v);
          }
          return { board: h.board, moves: h.moves, seqVisited: hsv };
        });
      }
      return {
        board: pos.board, original: pos.original,
        moves: pos.moves || 0, history: hist,
        seqVisited: sv, won: pos.won || false,
        viewBlack: pos.viewBlack || false,
      };
    } catch(e) { return null; }
  }

  // ── DOM ──
  const $ = id => document.getElementById(id);
  const boardEl=$('board'), boardWrap=$('board-wrap');
  const levelNameEl=$('level-name'), levelDescEl=$('level-desc'), goalLineEl=$('goal-line');
  const statMoves=$('stat-moves'), statSize=$('stat-size');
  const btnPrev=$('btn-prev'), btnNext=$('btn-next'), btnUndo=$('btn-undo'), btnReset=$('btn-reset');
  const btnNextWin=$('btn-next-win'), winBanner=$('win-banner'), winSub=$('win-sub');
  const levelIndicator=$('level-indicator'), subtitle=$('levels-subtitle'), levelsGrid=$('levels-grid');
  const swipeHint=$('swipe-hint');

  // ── Tabs ──
  function switchTab(target) {
    document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===target));
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active',p.id==='tab-'+target));
    if (target==='levels') renderLevelsGrid();
  }
  document.addEventListener('click',e=>{
    const tab=e.target.closest('.tab'); if(!tab?.dataset.tab) return;
    e.preventDefault(); switchTab(tab.dataset.tab);
  });

  // ── Load ──
  async function loadLevels() {
    try {
      const res=await fetch('levels.txt',{cache:'no-cache'});
      if (!res.ok) throw new Error('HTTP '+res.status);
      const lvls=parseLevels(await res.text());
      if (!lvls.length) throw new Error('Sin niveles');
      state.levels=lvls;
      // Restore progress from localStorage
      const { completed, lastLevel } = loadProgress(lvls.length);
      state.completed = completed;
      subtitle.textContent=lvls.length+(lvls.length===1?' nivel':' niveles')+
        (completed.size?' · '+completed.size+' ✓':'')+
        (completed.size===lvls.length?' 🏆':'');
      // Start from last played level (or first uncompleted, or 0)
      let startIdx = lastLevel;
      if (completed.has(startIdx) && startIdx < lvls.length-1) {
        for (let i=startIdx+1; i<lvls.length; i++) {
          if (!completed.has(i)) { startIdx = i; break; }
        }
      }
      loadLevel(startIdx);
    } catch(e) {
      subtitle.textContent='Error: '+e.message;
      boardEl.innerHTML='<div style="padding:40px;color:var(--coral);font-size:13px;text-align:center">No se pudo cargar <code>levels.txt</code>.<br><br>Ejecuta con un servidor<br>(<code>python -m http.server</code>)<br>o súbelo a GitHub Pages.</div>';
    }
  }

  function loadLevel(idx) {
    if (idx<0||idx>=state.levels.length) return;
    const lvl=state.levels[idx];
    const markers = new Set(lvl.allMarkers);
    const seqVisited = {};
    for (const g of lvl.goals) {
      if (g.type==='seq') seqVisited[g.markers.join('>')] = new Set();
    }
    // Look up saved position for this level (fresh from localStorage)
    const saved = getSavedPosition(idx);
    const useSaved = saved && saved.board && saved.board.length === lvl.H && saved.board[0].length === lvl.W;
    Object.assign(state,{
      levelIndex:idx, viewBlack: useSaved ? saved.viewBlack : !!lvl.viewBlack,
      markers, allMarkers:lvl.allMarkers,
      goals:lvl.goals, markerPos:lvl.markerPos,
      board: useSaved ? cloneGrid(saved.board) : cloneGrid(lvl.grid),
      original: useSaved ? cloneGrid(saved.original) : cloneGrid(lvl.grid),
      selected:null, legalDest:[],
      history: useSaved ? saved.history.map(h=>({board:cloneGrid(h.board), moves:h.moves, seqVisited:h.seqVisited})) : [],
      moves: useSaved ? saved.moves : 0,
      won: useSaved ? saved.won : false,
      seqVisited: useSaved ? saved.seqVisited : seqVisited,
    });
    saveProgress();
    render();
  }

  // ── Interaction ──
  function onCellClick(r,c) {
    if (!state.board||state.won) return;
    const [lr,lc]=state.viewBlack?[state.board.length-1-r,state.board[0].length-1-c]:[r,c];
    const ch=state.board[lr][lc];
    if (!state.selected) {
      if (isPiece(ch)&&GLYPH[ch]) selectPiece(lr,lc);
      return;
    }
    const [sr,sc]=state.selected;
    if (sr===lr&&sc===lc){ deselect(); return; }
    if (state.legalDest.some(([a,b])=>a===lr&&b===lc)){ doMove(sr,sc,lr,lc); return; }
    if (isPiece(ch)&&GLYPH[ch]) selectPiece(lr,lc);
    else deselect();
  }
  function selectPiece(r,c){
    state.selected=[r,c];
    state.legalDest=legalMoves(state.board,r,c,state.markers,state.viewBlack);
    if(!state.legalDest.length) showToast('Sin movimientos — '+colorArticle(state.board[r][c])+' '+colorName(state.board[r][c])+' bloquead'+((state.board[r][c]||'').toUpperCase()===state.board[r][c]?'o':'a'));
    render();
  }
  function deselect(){ state.selected=null; state.legalDest=[]; render(); }

  function doMove(sr,sc,dr,dc){
    state.history.push({
      board:cloneGrid(state.board), moves:state.moves,
      seqVisited: state.seqVisited ? JSON.parse(JSON.stringify(
        Object.fromEntries(Object.entries(state.seqVisited).map(([k,v])=>[k,[...v]]))
      )) : null,
    });
    const piece=state.board[sr][sc];
    // Restore marker if leaving a marker cell
    for (const m of state.allMarkers) {
      const mp=state.markerPos[m];
      if (sr===mp.row&&sc===mp.col && state.board[sr][sc]===piece) {
        state.board[sr][sc]=m;
        break;
      }
    }
    // If source wasn't restored as marker, clear it
    if (state.board[sr][sc]===piece) state.board[sr][sc]='.';

    state.board[dr][dc]=piece;
    state.moves++;
    if (shouldCoronate(state.board,dr,dc,state.viewBlack))
      state.board[dr][dc]=isUpper(piece)?'Q':'q';

    // Update SEQ visited (order-free — mark any unvisited marker)
    if (state.seqVisited) {
      for (const g of state.goals) {
        if (g.type!=='seq') continue;
        const key=g.markers.join('>');
        for (const m of g.markers) {
          const mp=state.markerPos[m];
          if (dr===mp.row&&dc===mp.col && state.board[dr][dc]===g.piece) {
            state.seqVisited[key].add(m);
          }
        }
      }
    }

    state.selected=null; state.legalDest=[];
    // SEQ win: all markers visited?
    let allSeqDone = true;
    if (state.seqVisited) {
      for (const g of state.goals) {
        if (g.type!=='seq') continue;
        const key=g.markers.join('>');
        if (state.seqVisited[key].size < g.markers.length) { allSeqDone = false; break; }
      }
    }
    state.won=checkWin(state.board, state.goals, state.markerPos) && allSeqDone;
    // Save progress on win
    if (state.won) {
      state.completed.add(state.levelIndex);
      // Update subtitle
      subtitle.textContent=state.levels.length+' niveles · '+
        state.completed.size+' ✓'+
        (state.completed.size===state.levels.length?' 🏆':'');
    }
    // Always save full state for resume
    saveProgress();
    render();
  }

  function undo(){
    if (!state.history.length) return;
    const p=state.history.pop();
    state.board=p.board; state.moves=p.moves;
    if (p.seqVisited) {
      state.seqVisited = {};
      for (const [k,v] of Object.entries(p.seqVisited)) {
        state.seqVisited[k] = new Set(v);
      }
    }
    state.selected=null; state.legalDest=[]; state.won=false;
    saveProgress();
    render();
  }

  function reset(){
    state.board=cloneGrid(state.original); state.moves=0; state.history=[];
    state.selected=null; state.legalDest=[]; state.won=false;
    for (const g of state.goals) {
      if (g.type==='seq') state.seqVisited[g.markers.join('>')]=new Set();
    }
    saveProgress();
    render();
  }

  btnPrev.onclick=()=>{if(state.levelIndex>0)loadLevel(state.levelIndex-1);};
  btnNext.onclick=()=>{if(state.levelIndex<state.levels.length-1)loadLevel(state.levelIndex+1);};
  btnNextWin.onclick=()=>{if(state.levelIndex<state.levels.length-1)loadLevel(state.levelIndex+1);};
  btnUndo.onclick=undo;
  btnReset.onclick=reset;

  // ── Toast ──
  let toastTmr;
  function showToast(msg){
    swipeHint.textContent=msg; swipeHint.classList.add('show');
    clearTimeout(toastTmr); toastTmr=setTimeout(()=>swipeHint.classList.remove('show'),1800);
  }
  // ── Swipe ──
  let tx=0,ty=0,handled=false;
  boardWrap.addEventListener('touchstart',e=>{
    if(e.touches.length===1){tx=e.touches[0].clientX;ty=e.touches[0].clientY;handled=false;}
  },{passive:true});
  boardWrap.addEventListener('touchmove',e=>{
    if(handled||!tx)return;
    const dx=e.touches[0].clientX-tx, dy=e.touches[0].clientY-ty;
    if(Math.abs(dx)>Math.abs(dy)*2&&Math.abs(dx)>30){
      handled=true;
      const n=state.levelIndex+(dx<0?1:-1);
      if(n>=0&&n<state.levels.length){loadLevel(n);swHint(dx<0?1:-1);}
    }
  },{passive:true});
  boardWrap.addEventListener('touchend',()=>tx=0);
  let swTmr; function swHint(d){
    swipeHint.textContent=(d<0?'← ':'')+state.levels[state.levelIndex]?.name+(d>0?' →':'');
    swipeHint.classList.add('show');
    clearTimeout(swTmr); swTmr=setTimeout(()=>swipeHint.classList.remove('show'),700);
  }

  // ── Keyboard ──
  document.addEventListener('keydown',e=>{
    if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')return;
    if(e.key==='ArrowLeft'){e.preventDefault();if(state.levelIndex>0)loadLevel(state.levelIndex-1);}
    if(e.key==='ArrowRight'){e.preventDefault();if(state.levelIndex<state.levels.length-1)loadLevel(state.levelIndex+1);}
    if(e.key==='z'&&(e.ctrlKey||e.metaKey)){e.preventDefault();undo();}
    if(e.key==='r'){e.preventDefault();reset();}
    if(e.key==='Escape')deselect();
  });

  // ── Rendering ──
  function computeCellSize(){
    if(!state.board)return 44;
    const H=state.board.length,W=state.board[0].length,vw=window.innerWidth;
    if(vw>=768){const t=460/Math.max(W,H);return Math.max(42,Math.min(68,Math.floor(t)));}
    const t=Math.min((vw-28)/W,440/H);
    return Math.max(40,Math.min(72,Math.floor(t)));
  }
  function render(){if(state.board){renderBoard();renderPanel();renderCtrls();}}

  function renderBoard(){
    const sz=computeCellSize(),H=state.board.length,W=state.board[0].length;
    const fs=Math.floor(sz*0.66);
    boardEl.innerHTML='';
    for(let vr=0;vr<H;vr++){
      const row=document.createElement('div');row.className='row';
      for(let vc=0;vc<W;vc++){
        const r=state.viewBlack?H-1-vr:vr, c=state.viewBlack?W-1-vc:vc;
        const ch=state.board[r][c], dark=(r+c)%2===1;
        // ¿Meta? — marcador vacío o pieza sobre posición meta
        let goalCell = false;
        if (!isPiece(ch) || !GLYPH[ch]) {
          goalCell = state.markers.has(ch);
        }
        // Also check if a piece is sitting on a marker position
        if (isPiece(ch) && GLYPH[ch] && state.markerPos) {
          for (const [m,mp] of Object.entries(state.markerPos)) {
            if (mp.row===r&&mp.col===c) { goalCell=true; break; }
          }
        }
        const wall=ch==='x';
        const sel=state.selected&&state.selected[0]===r&&state.selected[1]===c;
        const leg=state.legalDest.some(([a,b])=>a===r&&b===c);

        const el=document.createElement('div');
        el.className='cell '+(dark?'dark':'light');
        if(wall){el.classList.add('wall');if(goalCell)el.classList.add('wall-goal-ring');}
        if(goalCell&&!wall)el.classList.add('goal','goal-ring');
        if(sel)el.classList.add('selected');
        el.style.width=sz+'px';el.style.height=sz+'px';

        if(leg&&!wall&&cellFree(ch,state.markers)){
          const d=document.createElement('div');d.className='move-dot';el.appendChild(d);
        }
        if(isPiece(ch)&&GLYPH[ch]){
          const sp=document.createElement('span');
          sp.className='piece '+(isUpper(ch)?'white':'black');
          sp.style.fontSize=fs+'px';
          sp.textContent=GLYPH[ch];
          el.appendChild(sp);
        }
        // Show marker label on empty goal cells
        if (goalCell && !isPiece(ch) && state.markers.has(ch)) {
          const ml=document.createElement('span');
          ml.className='marker-label';
          ml.textContent=ch;
          ml.style.cssText=`position:absolute;top:2px;left:3px;font-size:${Math.max(8,Math.floor(sz*0.22))}px;color:var(--text3);font-family:monospace;pointer-events:none;z-index:2;font-weight:600`;
          el.appendChild(ml);
        }
        el.addEventListener('click',()=>onCellClick(vr,vc));
        row.appendChild(el);
      }
      boardEl.appendChild(row);
    }
  }

  function renderPanel(){
    const lvl=state.levels[state.levelIndex];if(!lvl)return;
    levelNameEl.textContent=lvl.name+(state.viewBlack?' [vista negras]':'');
    levelDescEl.textContent=lvl.description||'';
    levelDescEl.style.display=lvl.description?'block':'none';

    // Render goal line(s)
    goalLineEl.innerHTML='';
    for (const g of lvl.goals) {
      const row=document.createElement('div');row.className='goal-row';
      const gs=document.createElement('span');gs.className='goal-glyph';
      gs.textContent=GLYPH[g.piece]||g.piece;

      const ts=document.createElement('span');ts.className='goal-text';
      if (g.type==='and') {
        ts.textContent='Coloca '+colorArticle(g.piece)+' '+colorName(g.piece)+' '+(NAME[pieceType(g.piece)]||'').toLowerCase()+' en TODAS:';
      } else if (g.type==='seq') {
        ts.textContent='Visita con '+colorArticle(g.piece)+' '+colorName(g.piece)+' '+(NAME[pieceType(g.piece)]||'').toLowerCase()+' todas:';
        // Show progress
        const key=g.markers.join('>');
        const cur=state.seqVisited?.(key)?.size??0;
        if (cur>0 && cur<g.markers.length) {
          const pg=document.createElement('span');pg.className='seq-progress';
          pg.textContent=' ('+cur+'/'+(g.markers.length)+')';
          ts.appendChild(pg);
        }
      } else {
        ts.textContent='Lleva '+colorArticle(g.piece)+' '+colorName(g.piece)+' '+(NAME[pieceType(g.piece)]||'').toLowerCase()+' a';
      }

      const chips=document.createElement('span');chips.className='goal-chips';
      for (let i=0;i<g.markers.length;i++) {
        const m=g.markers[i];
        const mp=lvl.markerPos[m];
        // Check if completed (for seq — order-free visited)
        let done=false;
        if (g.type==='seq') {
          const key=g.markers.join('>');
          done = state.seqVisited?.[key]?.has(m) ?? false;
        }
        const chip=document.createElement('span');
        chip.className='goal-chip'+(done?' done':'');
        chip.textContent=m;
        if (g.type==='seq' && i<g.markers.length-1) {
          const arr=document.createElement('span');arr.className='seq-arrow';arr.textContent=' · ';
          chips.appendChild(chip);
          chips.appendChild(arr);
        } else {
          chips.appendChild(chip);
        }
      }
      row.append(gs, ts, chips);
      goalLineEl.appendChild(row);
    }

    statMoves.textContent=state.moves;
    statSize.textContent=lvl.H+'×'+lvl.W;
    if(state.won){
      winBanner.classList.remove('hidden');
      winSub.textContent=state.moves+(state.moves===1?' movimiento':' movimientos');
      btnNextWin.style.display=state.levelIndex<state.levels.length-1?'':'none';
      winBanner.scrollIntoView({behavior:'smooth',block:'nearest'});
    }else winBanner.classList.add('hidden');
  }

  function renderCtrls(){
    btnPrev.disabled=state.levelIndex<=0;
    btnNext.disabled=state.levelIndex>=state.levels.length-1;
    btnUndo.disabled=!state.history.length;
    levelIndicator.textContent=(state.levelIndex+1)+'/'+state.levels.length;
  }

  // ── Levels grid ──
  function renderLevelsGrid(){
    levelsGrid.innerHTML='';
    state.levels.forEach((lvl,i)=>{
      const card=document.createElement('div');
      card.className='level-card'+(i===state.levelIndex?' current':'')+(state.completed.has(i)?' completed':'');
      card.onclick=()=>{loadLevel(i);switchTab('play');};
      const thumb=document.createElement('div');thumb.className='thumb';
      const H=lvl.grid.length,W=lvl.grid[0].length;
      for(let vr=0;vr<H;vr++){
        const tr=document.createElement('div');tr.className='thumb-row';
        for(let vc=0;vc<W;vc++){
          const r=lvl.viewBlack?H-1-vr:vr,c=lvl.viewBlack?W-1-vc:vc;
          const ch=lvl.grid[r][c],bg=((r+c)%2===0)?'#E8E0D5':'#C8C0B5';
          const tc=document.createElement('div');tc.className='thumb-cell';
          if(ch==='x'){tc.style.background='#2A2420';}
          else if(lvl.allMarkers.has(ch)){tc.style.background='#DFF3E7';tc.style.border='1px dashed #4ADE80';tc.style.boxSizing='border-box';}
          else if(isPiece(ch)&&GLYPH[ch]){tc.style.background=bg;tc.textContent=GLYPH[ch];tc.style.color=isUpper(ch)?'#fff':'#1A1A1A';tc.style.textShadow=isUpper(ch)?'0 0 1px #1a1a1a':'none';}
          else{tc.style.background=bg;}
          tr.appendChild(tc);
        }
        thumb.appendChild(tr);
      }
      const title=document.createElement('h4');title.textContent=lvl.name+(lvl.viewBlack?' [vista negras]':'');
      const desc=document.createElement('p');desc.textContent=lvl.description||'\u00a0';
      const meta=document.createElement('div');meta.className='meta';
      let goalStr='';
      for (const g of lvl.goals) {
        if (goalStr) goalStr+=' · ';
        goalStr += (GLYPH[g.piece]||g.piece)+' · '+g.markers.join(g.type==='seq'?'>':',');
      }
      const gi=document.createElement('span');gi.textContent=goalStr;
      const ix=document.createElement('span');ix.className='idx';ix.textContent=(state.completed.has(i)?'✓ ':'')+'#'+(i+1);
      meta.append(gi,ix);
      card.append(thumb,title,desc,meta);
      levelsGrid.appendChild(card);
    });
  }

  // ── Resize ──
  let db;
  window.addEventListener('resize',()=>{clearTimeout(db);db=setTimeout(()=>{if(state.board)renderBoard();},150);});
  window.addEventListener('orientationchange',()=>{setTimeout(()=>{if(state.board)renderBoard();},200);});
  boardWrap.addEventListener('dblclick',e=>e.preventDefault());

  loadLevels();
})();
