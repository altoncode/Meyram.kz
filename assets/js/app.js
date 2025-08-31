// Meyram Quiz — app.js
// TZ: Asia/Almaty (UTC+5)

// --- Data ---------------------------------------------------------------
const DOMAINS = {
  TH: { name: 'Мышление (Стратегиялық ойлау)', color: '#86ffda',
    desc: 'Идеялар, талдау, болашақты көру, стратегия құруға бейім.' },
  RB: { name: 'Отношения (Қарым-қатынас)', color: '#6ea8fe',
    desc: 'Команданы біріктіреді, сенім орнатады, эмпатиясы жоғары.' },
  EX: { name: 'Достигаторство (Орындау)', color: '#c8a5ff',
    desc: 'Жоспарды жүйелі орындайды, тәртіп пен дедлайнға сүйенеді.' },
  IN: { name: 'Влияние (Әсер ету)', color: '#ffd28a',
    desc: 'Көшбасшылық көрсетеді, көпшілікке ойды жеткізе алады.' }
};

const QUESTIONS = [
  { t: 'Маған ойлануға, жалғыз отырып жоспар құруға уақыт қажет.', d:'TH' },
  { t: 'Жаңа идеялар ойлап табу мені шабыттандырады.', d:'TH' },
  { t: 'Ақпаратты терең талдауды ұнатамын.', d:'TH' },
  { t: 'Күрделі мәселелерді шешкенде өзімді мықты сезінемін.', d:'TH' },
  { t: 'Болашақ туралы стратегия құру маған қуат береді.', d:'TH' },

  { t: 'Мен адамдарды біріктіріп, жылы атмосфера жасағанды жақсы көремін.', d:'RB' },
  { t: 'Командадағы достық маған нәтижеден де маңызды.', d:'RB' },
  { t: 'Адамдардың сезімін тез түсінемін.', d:'RB' },
  { t: 'Біреуге қолдау көрсеткенде өзімді бақытты сезінемін.', d:'RB' },
  { t: 'Қарым-қатынаста сенім – мен үшін ең бастысы.', d:'RB' },

  { t: 'Жоспар құрсам, міндетті түрде соңына дейін жеткіземін.', d:'EX' },
  { t: 'Маған нақты тапсырма мен дедлайн берілсе, жақсы жұмыс істеймін.', d:'EX' },
  { t: 'Тәртіп пен жүйелілік маған күш береді.', d:'EX' },
  { t: 'Бір күнді бос өткізсем, өзімді жайсыз сезінемін.', d:'EX' },
  { t: 'Мақсатқа жету жолында кедергілерден қаймықпаймын.', d:'EX' },

  { t: 'Көпшілік алдында сөйлегенді ұнатамын.', d:'IN' },
  { t: 'Басқаларды сендіріп, өз идеяма тарту қолымнан келеді.', d:'IN' },
  { t: 'Командада көшбасшы болу маған табиғи көрінеді.', d:'IN' },
  { t: 'Таныс емес адамдармен тез тіл табысамын.', d:'IN' },
  { t: 'Жаңа бастаманы бастауға өзгелерді ерте аламын.', d:'IN' }
];

// --- State --------------------------------------------------------------
let current = 0; // 0..19
const answers = new Array(QUESTIONS.length).fill(null); // 0..4 scale, null = skipped
let useTimer = false;
let timerId = null;
const PER_QUESTION = 20; // seconds

const LS_KEY = 'meyram-quiz-v1';

// --- Helpers ------------------------------------------------------------
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

function show(id){
  ['#screen-start','#screen-quiz','#screen-result'].forEach(s=>$(s).classList.add('hidden'));
  $(id).classList.remove('hidden');
}

function renderQuestion(){
  const q = QUESTIONS[current];

  // Мәтіндер мен прогресс
  $('#qText').textContent = q.t;
  $('#qCounter').textContent = `Сұрақ ${current+1} / ${QUESTIONS.length}`;
  const answeredCount = answers.filter(v => v != null).length;
  const p = Math.round((answeredCount / QUESTIONS.length) * 100);
  $('#progress').style.width = p + '%';

  // Шкала
  const labels = [
    'Мүлде сәйкес келмейді',
    'Көбірек сәйкес келмейді',
    'Бейтарап',
    'Көбірек сәйкес келеді',
    'Өте сәйкес келеді'
  ];

  const scale = $('#scale');
  scale.innerHTML = '';
  scale.setAttribute('role','radiogroup');
  scale.setAttribute('aria-label','Бағалау шкаласы');

  labels.forEach((lab, idx) => {
    const opt = document.createElement('div');
    opt.className = 'opt';
    opt.setAttribute('role','radio');
    opt.setAttribute('aria-checked', answers[current] === idx ? 'true' : 'false');
    opt.setAttribute('tabindex','0'); // пернетақта қолдауы

    const text = document.createElement('span');
    text.textContent = lab;

    // Нақты input (iOS үшін change-ті тыңдаймыз)
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = `q${current}`;
    input.value = String(idx);
    input.tabIndex = -1; // фокусты opt алады
    // Егер CSS-та .opt input {position:absolute; inset:0; opacity:0;} болса — ок.
    // Қос-қадамды болдырмау үшін pointerEvents-ті сөндіреміз:
    input.style.pointerEvents = 'none';

    if (answers[current] === idx) {
      input.checked = true;
      opt.classList.add('active');
    }

    // Негізгі: iOS-та тұрақты жұмыс үшін change оқиғасы
    input.addEventListener('change', () => {
      answers[current] = idx;
      $$('.opt').forEach(el => { el.classList.remove('active'); el.setAttribute('aria-checked','false'); });
      opt.classList.add('active');
      opt.setAttribute('aria-checked','true');
      saveState();
      // Қаласаңыз, авто-келесі қосыңыз:
      // setTimeout(() => move(1), 120);
    });

    // Click/Enter/Space → input.click() (бір қадамда таңдалады)
    opt.addEventListener('click', () => input.click());
    opt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
    });

    opt.append(text, input);
    scale.appendChild(opt);
  });

  // Таймер UI
  if (useTimer) {
    $('#timerPill').style.display = 'inline-flex';
    startTimer(PER_QUESTION, () => move(1));
  } else {
    $('#timerPill').style.display = 'none';
    stopTimer();
  }

  // Батырмалар
  $('#btnBack').disabled = (current === 0);
}

function move(delta){
  stopTimer();
  current += delta;
  if(current<0) current=0;
  if(current>=QUESTIONS.length){
    showResult();
    return;
  }
  saveState();
  renderQuestion();
}

function startTimer(sec, onDone){
  let left = sec;
  $('#timer').textContent = left;
  timerId = setInterval(()=>{
    left--; $('#timer').textContent = left;
    if(left<=0){ stopTimer(); onDone && onDone(); }
  }, 1000);
}
function stopTimer(){ if(timerId){ clearInterval(timerId); timerId=null; } }

function compute(){
  // bucket per domain
  const per = { TH: [], RB: [], EX: [], IN: [] };
  QUESTIONS.forEach((q, i)=> per[q.d].push(answers[i]));

  const raw = {}, norm = {};
  for (const [k, arr] of Object.entries(per)) {
    const answered = arr.filter(v => v != null);
    const sum = answered.reduce((a,b)=> a + Number(b), 0);
    const denom = Math.max(answered.length * 4, 1);
    raw[k] = sum;
    norm[k] = Math.round((sum / denom) * 100);
  }

  const maxRaw = Math.max(...Object.values(raw));
  const top = Object.entries(raw).filter(([,v]) => v === maxRaw).map(([k]) => k);
  return { raw, norm, top };
}

function showResult(){
  // finalize progress bar
  $('#progress').style.width = '100%';

  const {raw, norm, top} = compute();
  
  // Маман аты
  const name = $('#expertName')?.value || '';
  if(name){
    $('#expertDisplay').textContent = `Маман: ${name}`;
  } else {
    $('#expertDisplay').textContent = '';
  }

  // Title
  const topNames = top.map(k=>DOMAINS[k].name).join(' + ');
  $('#topTitle').textContent = `Басым домен: ${topNames}`;

  const tie = top.length>1;
  $('#topDesc').textContent = tie
    ? 'Екі (немесе одан да көп) доменіңіз тең дәрежеде күшті көрінеді — бұл жан-жақтылықты білдіреді.'
    : DOMAINS[top[0]].desc;

  // Bars
  const bars = $('#bars'); bars.innerHTML='';
  ['TH','RB','EX','IN'].forEach(k=>{
    const row = document.createElement('div'); row.className = 'barrow';
    const lab = document.createElement('div'); lab.innerHTML = `<span class="badge">${k}</span> ${DOMAINS[k].name}`;
    const track = document.createElement('div'); track.className='bartrack';
    const fill = document.createElement('div'); fill.className='barfill'; fill.style.background = `linear-gradient(90deg, ${DOMAINS[k].color}, #6ea8fe)`; fill.style.width = '0%';
    const pct = document.createElement('div'); pct.textContent = norm[k] + '%'; pct.style.textAlign='right';
    track.appendChild(fill); row.append(lab, track, pct); bars.appendChild(row);
    requestAnimationFrame(()=>{ fill.style.width = norm[k] + '%'; });
  });

  // Explain / suggestions
  const ex = $('#explain'); ex.innerHTML='';
  const SUG = {
    TH: 'Аналитик, стратег, сценарий архитектор, R&D, дерекке негізделген шешімдер.',
    RB: 'Команда коучы, HR/қабылдау, қауымдастық жетекшісі, ата-аналармен байланыс.',
    EX: 'Операциялық менеджер, продюсер, жобаны жеткізу, стандарттар мен KPI.',
    IN: 'Маркетинг/PR, сахналық жүргізуші, сату көшбасшысы, қоғам алдында сөйлеу.'
  };
  Object.keys(DOMAINS).forEach(k=>{
    const div = document.createElement('div');
    div.innerHTML = `<div class="pill">${DOMAINS[k].name}</div><div class="tip">${DOMAINS[k].desc}<br><strong>Ұсынылатын рөлдер:</strong> ${SUG[k]}</div>`;
    ex.appendChild(div);
  });

  show('#screen-result');
  saveState();
}

function exportPDF(){
  window.print();
}

// --- Persistence ---------------------------------------------------------
function saveState(){
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ current, answers, useTimer }));
  } catch {}
}
function loadState(){
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (!s) return;
    useTimer = !!s.useTimer;
    $('#timerToggle').checked = useTimer;
    current = Math.min(Math.max(Number(s.current)||0,0), QUESTIONS.length-1);
    if (Array.isArray(s.answers)) s.answers.forEach((v,i)=> answers[i] = (v===null?null:Number(v)));
  } catch {}
}

// --- Events -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  loadState();

  $('#btnStart').addEventListener('click',()=>{
    useTimer = $('#timerToggle').checked;
    current = 0;
    show('#screen-quiz');
    renderQuestion();
  });

  $('#btnNext').addEventListener('click',()=>{
    if (answers[current] == null) {
      const pill = $('#qHint');
      const old = pill.textContent;
      pill.textContent = 'Алдымен жауап беріңіз 🙂';
      setTimeout(()=> pill.textContent = old, 1200);
      return;
    }
    move(1);
  });

  $('#btnBack').addEventListener('click',()=> move(-1));
  $('#btnSkip').addEventListener('click',()=>{ answers[current] = null; move(1); });

  $('#btnRestart').addEventListener('click',()=>{
    answers.fill(null);
    localStorage.removeItem(LS_KEY);
    location.reload();
  });

  $('#btnReview').addEventListener('click',()=>{
    show('#screen-quiz'); renderQuestion();
  });
  $('#btnExport').addEventListener('click', exportPDF);

  // Keyboard shortcuts
  document.addEventListener('keydown',(e)=>{
    if($('#screen-quiz').classList.contains('hidden')) return;
    const key = e.key;
    if(['1','2','3','4','5'].includes(key)){
      const idx = Number(key)-1;
      answers[current]=idx;
      saveState();
      renderQuestion();
      setTimeout(()=> move(1), 120);
    }
    if(key==='ArrowRight') move(1);
    if(key==='ArrowLeft') move(-1);
  });

  // Visibility pause/resume timer
  document.addEventListener('visibilitychange', () => {
    if (!useTimer) return;
    if (document.hidden) {
      stopTimer();
    } else {
      startTimer(PER_QUESTION, ()=>move(1));
    }
  });
});
