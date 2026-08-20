(function(){
  /* ============ 게임 시스템 (기존과 동일) ============ */
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

  /* ============ 사운드 (Web Audio, 외부 리소스 없음) ============ */
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
    }catch(e){ /* 오디오 미지원 시 무시 */ }
  }
  function playSequence(notes, type='square', gain=0.05){
    notes.forEach(n => beep(n.freq, n.dur, type, gain, n.at));
  }

  /* ============ 배경 파티클 ============ */
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

  /* ============ 마퀴 전구 ============ */
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

  /* ============ 릴 결과 상관관계 (1,2번 릴 일치 확률 ↑ / 3번 릴 일치 확률 ↓) ============ */
  const MATCH_12_PROB = 0.5;   // 첫번째-두번째 릴이 같은 모양으로 나올 확률
  const MATCH_3_PROB  = 0.12;  // 1,2번이 같을 때 3번째도 같이 맞아 3연속이 될 확률

  function generateReelResults(){
    const s0 = weightedRandomSymbol();

    let s1;
    if(Math.random() < MATCH_12_PROB){
      s1 = s0; // 의도적으로 첫 두 릴을 맞춰줌
    } else {
      s1 = weightedRandomSymbol();
    }

    let s2;
    if(s0 === s1){
      if(Math.random() < MATCH_3_PROB){
        s2 = s0; // 낮은 확률로 3연속 완성 (실제 당첨)
      } else {
        // 3번째는 확실히 다른 모양으로 (아깝게 놓치는 연출)
        do { s2 = weightedRandomSymbol(); } while(s2 === s0);
      }
    } else {
      s2 = weightedRandomSymbol();
    }
    return [s0, s1, s2];
  }

  /* ============ 릴 스트립 빌드 & 스핀 ============ */
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

  function spinOneReel(reelEl, trackEl, fillerCount, duration, tickFreq, finalSymbol, easing){
    return new Promise(resolve => {
      const finalIndex = buildTrack(trackEl, fillerCount, finalSymbol);
      reelEl.classList.add('spinning');

      // 강제 리플로우 후 트랜지션 시작
      void trackEl.offsetHeight;
      trackEl.style.transition = `transform ${duration}ms ${easing || 'cubic-bezier(.18,.86,.24,1)'}`;
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

  /* ============ 숫자 롤업 애니메이션 ============ */
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

  /* ============ 컨페티 ============ */
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

  /* ============ 잭팟 내역 (localStorage로 새로고침 후에도 유지) ============ */
  const JACKPOT_LS_KEY = 'gameMoneySlots_jackpotHistory_v1';
  let jackpotHistory = [];
  const historyBtn = document.getElementById('jackpotHistoryBtn');
  const historyOverlay = document.getElementById('historyOverlay');
  const historyList = document.getElementById('historyList');
  const historyClose = document.getElementById('historyClose');
  let storageAvailable = true;

  function loadJackpotHistory(){
    try{
      const raw = localStorage.getItem(JACKPOT_LS_KEY);
      if(raw){
        const parsed = JSON.parse(raw);
        jackpotHistory = parsed.map(r => ({ time: new Date(r.time), bet: r.bet, win: r.win }));
      }
    }catch(e){
      storageAvailable = false;
      jackpotHistory = [];
    }
  }

  function saveJackpotHistory(){
    if(!storageAvailable) return;
    try{
      localStorage.setItem(JACKPOT_LS_KEY, JSON.stringify(jackpotHistory));
    }catch(e){
      storageAvailable = false; // 저장 공간이 없거나 차단된 환경 (조용히 무시)
    }
  }

  function formatTime(d){
    return d.toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  }

  function updateJackpotButton(){
    historyBtn.textContent = `🏆 잭팟 내역 (${jackpotHistory.length})`;
  }

  function recordJackpot(betAmt, winAmt){
    jackpotHistory.unshift({ time: new Date(), bet: betAmt, win: winAmt });
    if(jackpotHistory.length > 50) jackpotHistory.length = 50;
    updateJackpotButton();
    saveJackpotHistory();
  }

  function clearJackpotHistory(){
    jackpotHistory = [];
    updateJackpotButton();
    saveJackpotHistory();
    renderHistoryList();
  }

  function renderHistoryList(){
    historyList.innerHTML = '';
    if(jackpotHistory.length === 0){
      const empty = document.createElement('div');
      empty.className = 'history-empty';
      empty.innerHTML = '아직 잭팟 기록이 없습니다.<br>7️⃣7️⃣7️⃣ 를 노려보세요!';
      historyList.appendChild(empty);
      return;
    }
    jackpotHistory.forEach(rec => {
      const item = document.createElement('div');
      item.className = 'history-item';

      const left = document.createElement('div');
      left.className = 'hi-left';
      const combo = document.createElement('span');
      combo.className = 'hi-combo';
      combo.textContent = '7️⃣7️⃣7️⃣';
      const time = document.createElement('span');
      time.className = 'hi-time';
      time.textContent = `${formatTime(rec.time)} · BET ${rec.bet}`;
      left.appendChild(combo);
      left.appendChild(time);

      const win = document.createElement('span');
      win.className = 'hi-win pixel';
      win.textContent = `+${rec.win}`;

      item.appendChild(left);
      item.appendChild(win);
      historyList.appendChild(item);
    });
  }

  function openHistory(){
    renderHistoryList();
    historyOverlay.classList.add('show');
  }
  function closeHistory(){
    historyOverlay.classList.remove('show');
  }

  historyBtn.addEventListener('click', openHistory);
  historyClose.addEventListener('click', closeHistory);
  historyOverlay.addEventListener('click', (e) => {
    if(e.target === historyOverlay) closeHistory();
  });
  document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape') closeHistory();
  });

  document.getElementById('historyClearBtn').addEventListener('click', () => {
    clearJackpotHistory();
  });

  loadJackpotHistory();

  /* ============ UI 갱신 ============ */
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

  async function doSpin(fromDrag){
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

    if(!fromDrag){
      els.lever.classList.remove('pulled');
      void els.lever.offsetWidth;
      els.lever.classList.add('pulled');
    }
    beep(150, 0.05, 'triangle', 0.03);
    playSequence([
      {freq:440, dur:0.08, at:0.0},
      {freq:520, dur:0.08, at:0.06},
      {freq:600, dur:0.08, at:0.12},
    ], 'sine', 0.025);

    // 스릴감을 위해 회전 시간과 정지 전 텀을 늘림 (릴이 길게, 특히 마지막 릴은 더 오래 끌도록)
    const plan = [
      { filler: 22, duration: 1500, tick: 520, easing: 'cubic-bezier(.18,.86,.24,1)' },
      { filler: 32, duration: 2200, tick: 580, easing: 'cubic-bezier(.14,.88,.16,1)' },
      { filler: 46, duration: 3200, tick: 660, easing: 'cubic-bezier(.08,.9,.1,1)' },
    ];
    const PAUSE_BEFORE = [0, 300, 550]; // 각 릴이 멈춘 뒤 다음 릴이 시작되기 전 서스펜스 텀(ms)

    const finalResults = generateReelResults();
    const results = [];
    for(let i=0;i<3;i++){
      if(PAUSE_BEFORE[i] > 0){
        await new Promise(res => setTimeout(res, PAUSE_BEFORE[i]));
      }
      results.push(await spinOneReel(els.reels[i], els.tracks[i], plan[i].filler, plan[i].duration, plan[i].tick, finalResults[i], plan[i].easing));
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
        recordJackpot(bet, win);
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

  els.spinBtn.addEventListener('click', () => doSpin(false));


  /* ============ 레버 드래그 인터랙션 (봉의 뿌리를 축으로 회전) ============ */
  (function setupLeverDrag(){
    const lever = els.lever;
    const wrap = lever.closest('.lever-wrap');
    const base = wrap.querySelector('.lever-base');
    const MAX_ANGLE = 90;         // 최대 회전각 (오른쪽으로 90도)
    const ACTIVATE_RATIO = 0.9;   // 90도에 근접해야(90%) 스핀이 실행됨

    let dragging = false;
    let currentAngle = 0;

    function getPivot(){
      const r = base.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }

    function setAngle(angle){
      currentAngle = Math.max(0, Math.min(MAX_ANGLE, angle));
      const ratio = currentAngle / MAX_ANGLE;
      wrap.style.setProperty('--pull-ratio', ratio.toFixed(3));
      lever.style.transform = `rotate(${currentAngle}deg)`;
    }

    function onPointerMove(e){
      if(!dragging) return;
      e.preventDefault();
      const pivot = getPivot();
      const dx = e.clientX - pivot.x;      // 오른쪽으로 갈수록 양수
      const dy = pivot.y - e.clientY;       // 위로 갈수록 양수 (막대는 기본적으로 수직 위를 향함)
      const angle = Math.atan2(dx, dy) * (180 / Math.PI);
      setAngle(angle);
    }

    function onPointerUp(){
      if(!dragging) return;
      dragging = false;
      lever.classList.remove('dragging');
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);

      const ratio = currentAngle / MAX_ANGLE;
      lever.style.transition = 'transform 260ms cubic-bezier(.34,1.56,.64,1)';

      if(ratio >= ACTIVATE_RATIO && !spinning && credit >= bet){
        // 90도까지 완전히 넘어가는 모션을 보여준 뒤 스핀 실행
        setAngle(MAX_ANGLE);
        beep(200, 0.06, 'triangle', 0.035);
        setTimeout(() => {
          setAngle(0);
          doSpin(true);
        }, 90);
      } else {
        setAngle(0);
      }
    }

    lever.addEventListener('pointerdown', (e) => {
      if(lever.disabled || spinning) return;
      dragging = true;
      lever.classList.add('dragging');
      lever.style.transition = 'none';
      document.addEventListener('pointermove', onPointerMove, { passive:false });
      document.addEventListener('pointerup', onPointerUp);
    });

    // 키보드(Enter/Space)로 활성화된 클릭만 처리 (detail===0은 마우스가 아닌 활성화)
    lever.addEventListener('click', (e) => {
      if(e.detail === 0) doSpin(false);
    });
  })();

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

  // 초기 릴 심볼 세팅 (정적)
  const initialSymbols = ['🍒','🍋','🔔'];
  els.tracks.forEach((t, i) => {
    const cell = document.createElement('div');
    cell.className = 'reel-cell';
    cell.textContent = initialSymbols[i];
    t.appendChild(cell);
  });

  /* ============ 자동 해상도 맞춤 (화면 크기에 맞게 캐비닛 스케일) ============ */
  function fitToScreen(){
    const stage = document.getElementById('cabinetStage');
    if(!stage) return;
    stage.style.transition = 'none';
    stage.style.transform = 'scale(1)';
    // 실제 렌더링 크기 측정을 위해 강제 리플로우
    void stage.offsetHeight;

    const naturalW = stage.offsetWidth;
    const naturalH = stage.offsetHeight;
    const margin = 16;
    const availW = window.innerWidth - margin;
    const availH = window.innerHeight - margin;

    let scale = Math.min(availW / naturalW, availH / naturalH);
    scale = Math.max(0.4, Math.min(scale, 1.5)); // 너무 작거나 과도하게 커지는 것 방지

    requestAnimationFrame(() => {
      stage.style.transition = 'transform 200ms ease';
      stage.style.transform = `scale(${scale})`;
    });
  }

  let fitRaf = null;
  function scheduleFit(){
    if(fitRaf) cancelAnimationFrame(fitRaf);
    fitRaf = requestAnimationFrame(fitToScreen);
  }

  window.addEventListener('resize', scheduleFit);
  window.addEventListener('orientationchange', scheduleFit);
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize', scheduleFit);
  }
  if(document.fonts && document.fonts.ready){
    document.fonts.ready.then(scheduleFit);
  }
  window.addEventListener('load', scheduleFit);

  initBgParticles();
  initMarqueeBulbs();
  updateCreditDisplay(false);
  updateBetDisplay();
  updateJackpotButton();
  fitToScreen();
})();
