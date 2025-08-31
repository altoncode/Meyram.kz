// Meyram Quiz — app.js (Drive JSONP polling edition)
// TZ: Asia/Almaty (UTC+5)
'use strict';

/* ===================== GAS CONFIG ===================== */
const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzepRWbTlgTEF1bKABiFQbvTow3EHKIWcDUspquJ-3EzNeKCSYE9ZQja1PYW0pQMW0U/exec';
const GAS_SECRET   = 'meyram_2025_Xx9hP7kL2qRv3sW8aJf1tZ4oBcDyGnHm';

/* ===================== QUIZ DATA ====================== */
const DOMAINS = {
  TH:{ name:'Мышление (Стратегиялық ойлау)', color:'#86ffda',
       desc:'Идеялар, талдау, болашақты көру, стратегия құруға бейім.' },
  RB:{ name:'Отношения (Қарым-қатынас)',  color:'#6ea8fe',
       desc:'Команданы біріктіріп, сенім орнатады, эмпатиясы жоғары.' },
  EX:{ name:'Достигаторство (Орындау)',   color:'#c8a5ff',
       desc:'Жоспарды жүйелі орындайды, тәртіп пен дедлайнға сүйенеді.' },
  IN:{ name:'Влияние (Әсер ету)',         color:'#ffd28a',
       desc:'Көшбасшылық көрсетеді, көпшілікке ойды жеткізе алады.' }
};

const QUESTIONS = [
  { t:'Маған ойлануға, жалғыз отырып жоспар құруға уақыт қажет.', d:'TH' },
  { t:'Жаңа идеялар ойлап табу мені шабыттандырады.', d:'TH' },
  { t:'Ақпаратты терең талдауды ұнатамын.', d:'TH' },
  { t:'Күрделі мәселелерді шешкенде өзімді мықты сезінемін.', d:'TH' },
  { t:'Болашақ туралы стратегия құру маған қуат береді.', d:'TH' },

  { t:'Мен адамдарды біріктіріп, жылы атмосфера жасағанды жақсы көремін.', d:'RB' },
  { t:'Командадағы достық маған нәтижеден де маңызды.', d:'RB' },
  { t:'Адамдардың сезімін тез түсінемін.', d:'RB' },
  { t:'Біреуге қолдау көрсеткенде өзімді бақытты сезінемін.', d:'RB' },
  { t:'Қарым-қатынаста сенім – мен үшін ең бастысы.', d:'RB' },

  { t:'Жоспар құрсам, міндетті түрде соңына дейін жеткіземін.', d:'EX' },
  { t:'Маған нақты тапсырма мен дедлайн берілсе, жақсы жұмыс істеймін.', d:'EX' },
  { t:'Тәртіп пен жүйелілік маған күш береді.', d:'EX' },
  { t:'Бір күнді бос өткізсем, өзімді жайсыз сезінемін.', d:'EX' },
  { t:'Мақсатқа жету жолында кедергілерден қаймықпаймын.', d:'EX' },

  { t:'Көпшілік алдында сөйлегенді ұнатамын.', d:'IN' },
  { t:'Басқаларды сендіріп, өз идеяма тарту қолымнан келеді.', d:'IN' },
  { t:'Командада көшбасшы болу маған табиғи көрінеді.', d:'IN' },
  { t:'Таныс емес адамдармен тез тіл табысамын.', d:'IN' },
  { t:'Жаңа бастаманы бастауға өзгелерді ерте аламын.', d:'IN' }
];

/* ===================== STATE ========================== */
let current = 0;
const answers = new Array(QUESTIONS.length).fill(null); // 0..4, null=skipped
let useTimer = false;
let timerId = null;
const PER_QUESTION = 20;

/* ===================== HELPERS ======================== */
const $  = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);
function on(sel, ev, handler){ const el = $(sel); if (el) el.addEventListener(ev, handler); }

function show(id){
  ['#screen-start','#screen-quiz','#screen-result'].forEach(s => $(s)?.classList.add('hidden'));
  $(id)?.classList.remove('hidden');
}

function sanitizeFilename(name){
  // Кирилл/латын — бәрі қалады. Тек файлдық тыйым салынған таңбаларды алып тастаймыз.
  let s = String(name || '').trim();
  s = s.replace(/[\/\\:\*\?"<>|\u0000-\u001F]+/g, '');
  s = s.replace(/\s+/g, '_').replace(/_+/g, '_');
  s = s.replace(/^_+|_+$/g, '');
  if (!s) s = 'Маман';
  return s.slice(0, 80);
}
function ymd(d=new Date()){
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}
function uid(bytes=8){
  const b=new Uint8Array(bytes); crypto.getRandomValues(b);
  return [...b].map(x=>x.toString(16).padStart(2,'0')).join('');
}

/* ===================== QUIZ RENDER ==================== */
function renderQuestion(){
  const q = QUESTIONS[current];
  $('#qText').textContent = q.t;
  $('#qCounter').textContent = `Сұрақ ${current+1} / ${QUESTIONS.length}`;

  const done = answers.filter(v=>v!=null).length;
  $('#progress').style.width = Math.round(done/QUESTIONS.length*100)+'%';

  const labels = ['Мүлде сәйкес келмейді','Көбірек сәйкес келмейді','Бейтарап','Көбірек сәйкес келеді','Өте сәйкес келеді'];
  const scale  = $('#scale');
  scale.innerHTML = '';
  scale.setAttribute('role','radiogroup');
  scale.setAttribute('aria-label','Бағалау шкаласы');

  labels.forEach((lab, idx)=>{
    const opt  = document.createElement('div');
    opt.className = 'opt';
    opt.setAttribute('role','radio');
    opt.setAttribute('aria-checked', answers[current]===idx ? 'true' : 'false');
    opt.tabIndex = 0;

    const text = document.createElement('span');
    text.textContent = lab;

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = `q${current}`;
    input.value = String(idx);
    input.tabIndex = -1;
    input.style.pointerEvents = 'none';

    if (answers[current]===idx){ input.checked=true; opt.classList.add('active'); }

    input.addEventListener('change', ()=>{
      answers[current]=idx;
      $$('.opt').forEach(el=>{ el.classList.remove('active'); el.setAttribute('aria-checked','false'); });
      opt.classList.add('active'); opt.setAttribute('aria-checked','true');
      if (useTimer) setTimeout(()=>move(1), 120); // автокөшу тек таймер қосулыда
    });

    opt.addEventListener('click', ()=> input.click());
    opt.addEventListener('keydown', (e)=>{
      if (e.key==='Enter' || e.key===' ') { e.preventDefault(); input.click(); }
    });

    opt.append(text, input);
    scale.appendChild(opt);
  });

  if (useTimer){
    $('#timerPill').style.display='inline-flex';
    startTimer(PER_QUESTION, ()=>move(1));
  } else {
    $('#timerPill').style.display='none';
    stopTimer();
  }

  $('#btnBack').disabled = (current===0);
}

function move(delta){
  stopTimer();
  current += delta;
  if (current < 0) current = 0;
  if (current >= QUESTIONS.length) { showResult(); return; }
  renderQuestion();
}

function startTimer(sec, onDone){
  let left = sec;
  $('#timer').textContent = left;
  timerId = setInterval(()=>{
    left--;
    $('#timer').textContent = left;
    if (left <= 0){ stopTimer(); onDone && onDone(); }
  }, 1000);
}
function stopTimer(){ if (timerId){ clearInterval(timerId); timerId = null; } }

function compute(){
  const per = { TH:[], RB:[], EX:[], IN:[] };
  QUESTIONS.forEach((q,i)=> per[q.d].push(answers[i]));

  const raw={}, norm={};
  for (const [k,arr] of Object.entries(per)){
    const done = arr.filter(v=>v!=null);
    const sum  = done.reduce((a,b)=> a + Number(b), 0);
    const denom= Math.max(done.length*4, 1);
    raw[k]  = sum;
    norm[k] = Math.round((sum/denom)*100);
  }
  const max = Math.max(...Object.values(raw));
  const top = Object.entries(raw).filter(([,v])=> v===max).map(([k])=>k);
  return { raw, norm, top };
}

function showResult(){
  $('#progress').style.width = '100%';

  const { norm, top } = compute();

  // Маман аты
  const name = $('#expertName')?.value?.trim() || '';
  $('#expertDisplay').textContent = name ? `Маман: ${name}` : '';

  // Титр/сипаттама
  const topNames = top.map(k=>DOMAINS[k].name).join(' + ');
  $('#topTitle').textContent = `Басым домен: ${topNames}`;
  $('#topDesc').textContent  = top.length>1
    ? 'Екі (немесе одан да көп) доменіңіз тең дәрежеде күшті көрінеді — бұл жан-жақтылықты білдіреді.'
    : (DOMAINS[top[0]]?.desc || '');

  // Барлар
  const bars = $('#bars'); bars.innerHTML='';
  ['TH','RB','EX','IN'].forEach(k=>{
    const row  = document.createElement('div'); row.className = 'barrow';
    const lab  = document.createElement('div'); lab.innerHTML = `<span class="badge">${k}</span> ${DOMAINS[k].name}`;
    const track= document.createElement('div'); track.className = 'bartrack';
    const fill = document.createElement('div'); fill.className = 'barfill';
    fill.style.background = `linear-gradient(90deg, ${DOMAINS[k].color}, #6ea8fe)`;
    fill.style.width = '0%';
    const pct  = document.createElement('div'); pct.textContent = (norm[k]||0) + '%'; pct.style.textAlign='right';
    track.appendChild(fill); row.append(lab, track, pct); bars.appendChild(row);
    requestAnimationFrame(()=>{ fill.style.width = (norm[k]||0) + '%'; });
  });

  // Түсіндірме блок (визуал үшін, сервер PDF-ке толық түсіндірме қояды)
  const ex = $('#explain'); ex.innerHTML='';
  const SUG = {
    TH:'Аналитик, стратег, сценарий архитектор, R&D, дерекке негізделген шешімдер.',
    RB:'Команда коучы, HR/қабылдау, қауымдастық жетекшісі, ата-аналармен байланыс.',
    EX:'Операциялық менеджер, продюсер, жобаны жеткізу, стандарттар мен KPI.',
    IN:'Маркетинг/PR, сахналық жүргізуші, сату көшбасшысы, қоғам алдында сөйлеу.'
  };
  Object.keys(DOMAINS).forEach(k=>{
    const div=document.createElement('div');
    div.innerHTML = `<div class="pill">${DOMAINS[k].name}</div>
                     <div class="tip">${DOMAINS[k].desc}<br><strong>Ұсынылатын рөлдер:</strong> ${SUG[k]}</div>`;
    ex.appendChild(div);
  });

  show('#screen-result');
}

/* ========== DRIVE: POST (no-cors) + JSONP polling ========== */
// Серверге нәтижені жібереміз (жауап оқылмайды: sendBeacon / no-cors)
function postResultToServer(token, expert, norm, top, answersArr){
  const payload = {
    secret:  GAS_SECRET,
    token:   token,
    expert:  expert,
    baseName:`${expert}_${ymd(new Date())}`,
    norm:    norm,
    top:     top,
    answers: answersArr.map(v => (v==null ? -1 : v))
  };
  const bodyStr = JSON.stringify(payload);

  // sendBeacon (фондық)
  if (navigator.sendBeacon){
    const ok = navigator.sendBeacon(GAS_ENDPOINT, new Blob([bodyStr], { type:'text/plain;charset=utf-8' }));
    if (ok) return;
  }
  // Фолбэк: fetch(no-cors)
  fetch(GAS_ENDPOINT, {
    method:'POST', mode:'no-cors',
    headers:{ 'Content-Type':'text/plain;charset=utf-8' },
    body: bodyStr
  }).catch(()=>{ /* ignore */ });
}

// JSONP loader (CORS керек емес)
function jsonp(url, cbName){
  return new Promise(resolve=>{
    const s = document.createElement('script');
    s.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + encodeURIComponent(cbName);
    s.async = true;
    s.onerror = ()=> resolve(null);
    document.head.appendChild(s);
  });
}

// Токен бойынша файл дайын болғанын polling
function pollForFile(token, onReady, onPending, onTimeout){
  let stopped=false, tries=0, maxTries=40; // ~60 сек (1.5s * 40)
  (function tick(){
    if(stopped) return;
    const cbName = '__MEYRAM_CB_' + uid();
    window[cbName] = (data)=>{
      try{
        if (data && data.ok && data.fileUrl){
          stopped=true; delete window[cbName];
          onReady(data);
        } else {
          onPending && onPending(data);
          tries++;
          if (tries >= maxTries){
            stopped=true; delete window[cbName];
            onTimeout && onTimeout();
          } else {
            setTimeout(tick, 1500);
          }
        }
      } finally {
        const tags = document.querySelectorAll(`script[src*="${encodeURIComponent(cbName)}"]`);
        tags.forEach(n=> n.parentNode && n.parentNode.removeChild(n));
      }
    };
    const url = `${GAS_ENDPOINT}?mode=result&token=${encodeURIComponent(token)}`;
    jsonp(url, cbName);
  })();
}

// Нәтижені Drive-қа жіберу батырмасы
function sendToDrive(){
  const btn = $('#btnSend');
  const a   = $('#driveLink');
  if (btn) btn.disabled = true;
  if (a){
    a.removeAttribute('href');
    a.textContent = 'Жүктеліп жатыр… (Drive)';
    a.style.display = 'inline-block';
  }

  const expert = sanitizeFilename(
    $('#expertName')?.value?.trim() ||
    ($('#expertDisplay')?.textContent || '').replace(/^Маман:\s*/,'') ||
    'Маман'
  );
  const { norm, top } = compute();
  const token = uid();

  postResultToServer(token, expert, norm, top, answers);

  pollForFile(
    token,
    // onReady
    (data)=>{
      if (a){ a.href = data.fileUrl; a.textContent = 'Drive сілтеме: ашу'; }
      if (btn) btn.disabled = false;
    },
    // onPending
    ()=>{
      if (a) a.textContent = 'Дайындалуда…';
    },
    // onTimeout
    ()=>{
      if (a){
        a.removeAttribute('href');
        a.textContent = 'Сілтеме дайын емес. Кейінірек көріңіз.';
      }
      if (btn) btn.disabled = false;
    }
  );
}

/* ===================== EVENTS ======================== */
document.addEventListener('DOMContentLoaded', ()=>{
  // Бастау
  on('#btnStart', 'click', ()=>{
    const tgl = $('#timerToggle'); useTimer = !!(tgl && tgl.checked);
    const name = $('#expertName')?.value?.trim();
    if (name){ window.__who = window.__who || {}; window.__who.name = name; }
    current = 0; show('#screen-quiz'); renderQuestion();
  });

  // Келесі/Алдыңғы
  on('#btnNext', 'click', ()=>{
    if (answers[current] == null){
      const pill = $('#qHint'); if (pill){ const old=pill.textContent; pill.textContent='Алдымен жауап беріңіз 🙂'; setTimeout(()=>{ pill.textContent=old; },1200); }
      return;
    }
    move(1);
  });
  on('#btnBack', 'click', ()=> move(-1));

  // Шолу/Қайта бастау
  on('#btnReview','click', ()=>{ show('#screen-quiz'); renderQuestion(); });
  on('#btnRestart','click', ()=>{
    answers.fill(null);
    try{ localStorage.removeItem('meyram-quiz-v1'); }catch{}
    location.reload();
  });

  // Drive-қа жіберу
  on('#btnSend','click', sendToDrive);

  // Қысқа пернелер
  document.addEventListener('keydown', (e)=>{
    if ($('#screen-quiz')?.classList.contains('hidden')) return;
    if (['1','2','3','4','5'].includes(e.key)){
      answers[current] = Number(e.key) - 1;
      renderQuestion();
      if (useTimer) setTimeout(()=>move(1), 120);
    }
    if (e.key === 'ArrowRight') move(1);
    if (e.key === 'ArrowLeft')  move(-1);
  });

  // Таймер визибилити
  document.addEventListener('visibilitychange', ()=>{
    if (!useTimer) return;
    if (document.hidden) stopTimer(); else startTimer(PER_QUESTION, ()=>move(1));
  });
});
