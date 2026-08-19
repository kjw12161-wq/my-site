(function(){
  /* ============ Game system ============ */
  const SYMBOL_TABLE = [
    { sym:'🍒', weight:30 },
    { sym:'🍋', weight:25 },
    { sym:'🍇', weight:20 },
    { sym:'🔔', weight:12 },
    { sym:'⭐', weight:7 },
    { sym:'💎', weight:4 },
    { sym:'7️⃣', weight:2 },
  ];
  const ALL_SYMBOLS = SYMBOL_TABLE.map(s => s.sym);
  const TOTAL_WEIGHT = SYMBOL_TABLE.reduce((a,s)=>a+s.weight,0);

  const PAYOUTS = {
    '7️⃣': 50, '💎': 20, '🔔': 10, '⭐': 8, '🍇': 5, '🍋': 4, '🍒': 3,
  };
  const CHERRY_PAIR_MULT = 1;
  const BET_MIN = 10, BET_MAX = 100, BET_STEP = 10;

  let credit = 100;
  let bet = 10;
  let spinning = false;

  const els = {
    cabinet: document.getElementById('cabinet'),
    credit: document.getElementById('creditValue'),
    lastWin: document.getElementById('lastWinValue'),
    reels: [document.getElementById('reel0'), document.getElementById('reel1'), document.getElementById('reel2')],
    tracks: [document.getElementById('track0'), document.getElementById('track1'), document.getElementById('track2')],
    message: document.getElementById('message'),
    betValue: document.getElementById('betValue'),
    betMinus: document.getElementById('betMinus'),
    betPlus: document.getElementById('betPlus'),
    lever: document.getElementById('lever'),
    spinBtn: document.getElementById('spinBtn'),
    resetBtn: document.getElementById('resetBtn'),
    paytableRows: document.querySelectorAll('.paytable-row'),
    winBanner: document.getElementById('winBanner'),
    confettiLayer: document.getElementById('confettiLayer'),
  };

  const CELL_HEIGHT = 100;

  function weightedRandomSymbol(){
    let r = Math.random() * TOTAL_WEIGHT;
    for(const entry of SYMBOL_TABLE){
      if(r < entry.weight) return entry.sym;
      r -= entry.weight;
    }
    return SYMBOL_TABLE[0].sym;
  }

  /* ============ Sound (Web Audio, no external resources) ============ */
  let audioCtx = null;
  function ctx(){
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }
  function beep(freq, duration, type='square', gain=0.05, delay=0){
    try{
      const ac = ctx();
      const startAt = ac.currentTime + delay;
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, startAt);
      g.gain.setValueAtTime(gain, startAt);
      osc.connect(g); g.connect(ac.destination);
      osc.start(startAt);
      g.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
      osc.stop(startAt + duration + 0.02);
    }catch(e){ /* Ignore unsupported audio. */ }
  }
  function playSequence(notes, type='square', gain=0.05){
    notes.forEach(n => beep(n.freq, n.dur, type, gain, n.at));
  }

  /* ============ 諛곌꼍 ?뚰떚??============ */
  function initBgParticles(){
    const layer = document.getElementById('bgParticles');
    const colors = ['#ff2fb0', '#00e5ff', '#ffd23f'];
    for(let i=0;i<16;i++){
      const dot = document.createElement('div');
      dot.className = 'bg-dot';
      const size = 3 + Math.random()*6;
      dot.style.width = size+'px';
      dot.style.height = size+'px';
      dot.style.left = Math.random()*100+'vw';
      dot.style.top = Math.random()*100+'vh';
      dot.style.background = colors[i % colors.length];
      dot.style.animationDuration = (5+Math.random()*6)+'s';
      dot.style.animationDelay = (Math.random()*4)+'s';
      layer.appendChild(dot);
    }
  }

  /* ============ 留덊??꾧뎄 ============ */
  function initMarqueeBulbs(){
    const holder = document.getElementById('marqueeLights');
    const perSideTop = 11, perSideSide = 6;
    let idx = 0;
    const total = perSideTop*2 + perSideSide*2;
    function place(xPct, yPct){
      const b = document.createElement('div');
      b.className = 'bulb';
      b.style.left = xPct+'%';
      b.style.top = yPct+'%';
      b.style.animationDelay = ((idx / total) * 1.6)+'s';
      idx++;
      holder.appendChild(b);
    }
    for(let i=0;i<perSideTop;i++) place((i/(perSideTop-1))*100, 0);
    for(let i=0;i<perSideSide;i++) place(100, (i/(perSideSide-1))*100);
    for(let i=0;i<perSideTop;i++) place(100-(i/(perSideTop-1))*100, 100);
    for(let i=0;i<perSideSide;i++) place(0, 100-(i/(perSideSide-1))*100);
  }

  /* ============ 由??ㅽ듃由?鍮뚮뱶 & ?ㅽ? ============ */
  function buildTrack(trackEl, fillerCount, finalSymbol){
    trackEl.innerHTML = '';
    trackEl.style.transition = 'none';
    trackEl.style.transform = 'translateY(0px)';
    for(let i=0;i<fillerCount;i++){
      const cell = document.createElement('div');
      cell.className = 'reel-cell';
      cell.textContent = weightedRandomSymbol();
      trackEl.appendChild(cell);
    }
    const finalCell = document.createElement('div');
    finalCell.className = 'reel-cell';
    finalCell.textContent = finalSymbol;
    trackEl.appendChild(finalCell);
    return fillerCount; // index of final cell
  }

  function spinOneReel(reelEl, trackEl, fillerCount, duration, tickFreq){
    return new Promise(resolve => {
      const finalSymbol = weightedRandomSymbol();
      const finalIndex = buildTrack(trackEl, fillerCount, finalSymbol);
      reelEl.classList.add('spinning');

      // 媛뺤젣 由ы뵆濡쒖슦 ???몃옖吏???쒖옉
      void trackEl.offsetHeight;
      trackEl.style.transition = `transform ${duration}ms cubic-bezier(.18,.86,.24,1)`;
      trackEl.style.transform = `translateY(-${finalIndex * CELL_HEIGHT}px)`;

      setTimeout(() => {
        reelEl.classList.remove('spinning');
      }, duration * 0.72);

      setTimeout(() => {
        beep(tickFreq, 0.09, 'square', 0.045);
        resolve(finalSymbol);
      }, duration);
    });
  }

  /* ============ ?レ옄 濡ㅼ뾽 ?좊땲硫붿씠??============ */
  function animateNumber(el, from, to, duration){
    const startTime = performance.now();
    function step(now){
      const p = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = Math.round(from + (to - from) * eased);
      el.textContent = val;
      if(p < 1) requestAnimationFrame(step);
      else el.textContent = to;
    }
    requestAnimationFrame(step);
  }

  /* ============ 而⑦럹??============ */
  function burstConfetti(big){
    const layer = els.confettiLayer;
    const colors = ['#ff2fb0', '#00e5ff', '#ffd23f', '#f3eeff'];
    const count = big ? 46 : 24;
    for(let i=0;i<count;i++){
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = Math.random()*100+'%';
      piece.style.background = colors[Math.floor(Math.random()*colors.length)];
      piece.style.animationDuration = (900 + Math.random()*700)+'ms';
      piece.style.animationDelay = (Math.random()*250)+'ms';
      piece.style.borderRadius = Math.random() > .5 ? '50%' : '2px';
      layer.appendChild(piece);
      setTimeout(() => piece.remove(), 2200);
    }
  }

  function showWinBanner(text){
    els.winBanner.querySelector('.txt').textContent = text;
    els.winBanner.classList.add('show');
    setTimeout(() => els.winBanner.classList.remove('show'), 1300);
  }

  /* ============ UI 媛깆떊 ============ */
  function updateCreditDisplay(flash, animateFrom){
    if(typeof animateFrom === 'number'){
      animateNumber(els.credit, animateFrom, credit, 550);
    } else {
      els.credit.textContent = credit;
    }
    if(flash){
      els.credit.classList.remove('credit-flash');
      void els.credit.offsetWidth;
      els.credit.classList.add('credit-flash');
    }
  }

  function updateBetDisplay(){
    els.betValue.textContent = bet;
    els.betMinus.disabled = spinning || bet <= BET_MIN;
    els.betPlus.disabled = spinning || bet >= BET_MAX || bet + BET_STEP > credit;
  }

  function setMessage(text, cls){
    els.message.textContent = text;
    els.message.className = 'message pixel' + (cls ? ' ' + cls : '');
  }

  function clearHighlights(){
    els.paytableRows.forEach(r => r.classList.remove('highlight'));
  }
  function highlightCombo(key){
    els.paytableRows.forEach(r => { if(r.dataset.combo === key) r.classList.add('highlight'); });
  }

  els.betMinus.addEventListener('click', () => {
    if(spinning) return;
    bet = Math.max(BET_MIN, bet - BET_STEP);
    updateBetDisplay();
    beep(260, 0.05, 'square', 0.03);
  });
  els.betPlus.addEventListener('click', () => {
    if(spinning) return;
    bet = Math.min(BET_MAX, bet + BET_STEP);
    updateBetDisplay();
    beep(320, 0.05, 'square', 0.03);
  });

  function evaluate(results){
    const [a,b,c] = results;
    clearHighlights();
    if(a === b && b === c){
      const mult = PAYOUTS[a];
      highlightCombo(a+a+a);
      return { win: bet * mult, comboText: a+a+a+' 일치!', jackpot: a === '7️⃣', tier: mult };
    }
    const cherryCount = results.filter(s => s === '🍒').length;
    if(cherryCount === 2){
      highlightCombo('🍒🍒?');
      return { win: bet * CHERRY_PAIR_MULT, comboText: '체리 2개!', jackpot:false, tier:1 };
    }
    return { win: 0, comboText: null, jackpot:false, tier:0 };
  }

  async function doSpin(){
    if(spinning) return;
    if(credit < bet){
      setMessage('게임머니가 부족합니다', 'broke');
      beep(120, 0.12, 'sine', 0.04);
      return;
    }

    spinning = true;
    els.spinBtn.disabled = true;
    els.lever.disabled = true;
    els.betMinus.disabled = true;
    els.betPlus.disabled = true;
    clearHighlights();
    els.winBanner.classList.remove('show');

    const creditBefore = credit;
    credit -= bet;
    updateCreditDisplay(false);
    els.lastWin.textContent = '0';
    setMessage('돌아가는 중...', null);

    els.lever.classList.remove('pulled');
    void els.lever.offsetWidth;
    els.lever.classList.add('pulled');
    beep(150, 0.05, 'triangle', 0.03);
    playSequence([
      {freq:440, dur:0.08, at:0.0},
      {freq:520, dur:0.08, at:0.06},
      {freq:600, dur:0.08, at:0.12},
    ], 'sine', 0.025);

    const plan = [
      { filler: 14, duration: 900,  tick: 520 },
      { filler: 20, duration: 1250, tick: 580 },
      { filler: 26, duration: 1600, tick: 660 },
    ];

    const results = [];
    for(let i=0;i<3;i++){
      results.push(await spinOneReel(els.reels[i], els.tracks[i], plan[i].filler, plan[i].duration, plan[i].tick));
    }

    const { win, comboText, jackpot, tier } = evaluate(results);

    if(win > 0){
      const before = credit;
      credit += win;
      els.lastWin.textContent = win;
      updateCreditDisplay(true, before);
      setMessage(comboText + '  +' + win, 'win');
      els.cabinet.classList.add('win');
      showWinBanner(jackpot ? 'JACKPOT!!' : 'WIN!');
      burstConfetti(jackpot || tier >= 10);

      if(jackpot){
        els.cabinet.classList.add('shake');
        setTimeout(() => els.cabinet.classList.remove('shake'), 450);
        playSequence([
          {freq:523,dur:0.16,at:0},{freq:659,dur:0.16,at:0.14},
          {freq:784,dur:0.16,at:0.28},{freq:1046,dur:0.3,at:0.42},
          {freq:784,dur:0.4,at:0.75}
        ], 'square', 0.06);
      } else if(tier >= 8){
        playSequence([
          {freq:523,dur:0.12,at:0},{freq:659,dur:0.12,at:0.1},{freq:784,dur:0.2,at:0.2}
        ], 'square', 0.055);
      } else {
        playSequence([
          {freq:523,dur:0.1,at:0},{freq:659,dur:0.16,at:0.09}
        ], 'square', 0.05);
      }
      setTimeout(() => els.cabinet.classList.remove('win'), 1500);
    } else {
      updateCreditDisplay(false);
      setMessage('꽝! 다시 도전해보세요', 'lose');
      playSequence([
        {freq:220,dur:0.14,at:0},{freq:160,dur:0.2,at:0.12}
      ], 'sine', 0.04);
    }

    if(credit <= 0){
      setTimeout(() => setMessage('게임머니 소진! 리셋 버튼을 눌러주세요', 'broke'), 1000);
    }

    spinning = false;
    els.spinBtn.disabled = credit < bet;
    els.lever.disabled = credit < bet;
    updateBetDisplay();
  }

  els.spinBtn.addEventListener('click', doSpin);
  els.lever.addEventListener('click', doSpin);

  els.resetBtn.addEventListener('click', () => {
    if(spinning) return;
    const before = credit;
    credit = 100;
    bet = 10;
    updateCreditDisplay(true, before);
    updateBetDisplay();
    setMessage('게임머니가 리셋되었습니다', null);
    els.spinBtn.disabled = false;
    els.lever.disabled = false;
    clearHighlights();
    els.winBanner.classList.remove('show');
    els.lastWin.textContent = '0';
    beep(440, 0.1, 'triangle', 0.04);
  });

  // Initial reel symbols.
  const initialSymbols = ['🍒','🍋','🔔'];
  els.tracks.forEach((t, i) => {
    const cell = document.createElement('div');
    cell.className = 'reel-cell';
    cell.textContent = initialSymbols[i];
    t.appendChild(cell);
  });

  initBgParticles();
  initMarqueeBulbs();
  updateCreditDisplay(false);
  updateBetDisplay();
})();
