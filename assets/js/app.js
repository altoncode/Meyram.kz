// Meyram Quiz — app.js (JSONP-only; no DOM->PDF)
'use strict';

/* ====== GAS CONFIG (жаңа кілт) ====== */
const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbw7kw5Sqg4ZCTHXUDt92WnceSqpmxLjG44ujsIg9hRXNvHPqKUCBDPbWOAs6rnZxGEs/exec';
const GAS_SECRET   = 'meyram_2025_Xx9hP7kL2qRv3sW8aJf1tZ4oBcDyGnHm';

/* ====== QUIZ DATA ====== */
const DOMAINS = {
  TH:{ name:'Мышление (Стратегиялық ойлау)', color:'#86ffda', desc:'Идеялар, талдау, болашақты көру, стратегия құруға бейім.' },
  RB:{ name:'Отношения (Қарым-қатынас)',      color:'#6ea8fe', desc:'Команданы біріктіріп, сенім орнатады, эмпатиясы жоғары.' },
  EX:{ name:'Достигаторство (Орындау)',       color:'#c8a5ff', desc:'Жоспарды жүйелі орындайды, тәртіп пен дедлайнға сүйенеді.' },
  IN:{ name:'Влияние (Әсер ету)',             color:'#ffd28a', desc:'Көшбасшылық көрсетеді, көпшілікке ойды жеткізе алады.' }
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

/* ====== STATE ====== */
let current = 0;
const answers = new Array(QUESTIONS.length).fill(null); // 0..4, null=skip
let useTimer = false;
let timerId  = null;
const PER_Q  = 20;

/* ====== HELPERS ====== */
const $ = s => document.querySelector(s);
function on(sel, ev, fn){ const el=$(sel); if(el) el.addEventListener(ev, fn); }

function sanitizeFilename(name){
  let s = String(name||'').trim();
  s = s.replace(/[\/\\:\*\?"<>|\u0000-\u001F]+/g,'').replace(/\s+/g,'_').replace(/_+/g,'_').replace(/^_+|_+$/g,'');
  return (s || 'Маман').slice(0,80);
}
function ymd(d=new Date()){ const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), da=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${da}`; }
function uid(){ return Math.random().toString(16).slice(2)+Math.random().toString(16).slice(2); }

// JSONP
function jsonp(url){
  return new Promise((resolve)=>{
    const cb = '__CB_' + uid();
    window[cb] = (data)=>{ try{ resolve(data); } finally { delete window[cb]; } };
    const s = document.createElement('script');
    s.src = url + (url.includes('?')?'&':'?') + 'callback=' + encodeURIComponent(cb);
    s.async = true;
    s.onerror = ()=> resolve({ ok:false, error:'Network' });
    document.head.appendChild(s);
  });
}

/* ====== QUIZ RENDER ====== */
function renderQuestion(){
  const q = QUESTIONS[current];
  $('#qText').textContent = q.t;
  $('#qCounter').textContent = `Сұрақ ${current+1} / ${QUESTIONS.length}`;

  const done = answers.filter(v=>v!=null).length;
  $('#progress').style.width = Math.round(done/QUESTIONS.length*100)+'%';

  const labels = ['Мүлде сәйкес келмейді','Көбірек сәйкес келмейді','Бейтарап','Көбірек сәйкес келеді','Өте сәйкес келеді'];
  const scale = $('#scale'); scale.innerHTML='';
  labels.forEach((lab, idx)=>{
    const opt = document.createElement('button');
    opt.type='button';
    opt.className='opt';
    opt.textContent = lab;
    if (answers[current]===idx) opt.classList.add('active');
    opt.addEventListener('click', ()=>{
      answers[current]=idx;
      renderQuestion();
      if (useTimer) setTimeout(()=>move(1), 120);
    });
    scale.appendChild(opt);
  });

  $('#timerPill').style.display = useTimer ? 'inline-flex' : 'none';
  if (useTimer) startTimer(PER_Q, ()=>move(1)); else stopTimer();

  $('#btnBack').disabled = (current===0);
}

function move(d){
  stopTimer();
  current += d;
  if (current<0) current=0;
  if (current>=QUESTIONS.length){ showResult(); return; }
  renderQuestion();
}

function startTimer(sec, onDone){
  let left = sec;
  $('#timer').textContent = left;
  timerId = setInterval(()=>{
    left--; $('#timer').textContent = left;
    if (left<=0){ stopTimer(); onDone && onDone(); }
  }, 1000);
}
function stopTimer(){ if (timerId){ clearInterval(timerId); timerId=null; } }

function compute(){
  const per={TH:[],RB:[],EX:[],IN:[]};
  QUESTIONS.forEach((q,i)=> per[q.d].push(answers[i]));
  const raw={}, norm={};
  for(const k of Object.keys(per)){
    const arr = per[k].filter(v=>v!=null);
    const sum = arr.reduce((a,b)=>a+Number(b),0);
    const denom = Math.max(arr.length*4,1);
    raw[k]=sum; norm[k]=Math.round((sum/denom)*100);
  }
  const max = Math.max(...Object.values(raw));
  const top = Object.entries(raw).filter(([,v])=>v===max).map(([k])=>k);
  return { raw, norm, top };
}

function show(id){ ['#screen-start','#screen-quiz','#screen-result'].forEach(s=>$(s)?.classList.add('hidden')); $(id)?.classList.remove('hidden'); }
function showResult(){
  const { norm, top } = compute();

  const name = $('#expertName')?.value?.trim() || '';
  $('#expertDisplay').textContent = name ? `Маман: ${name}` : '';

  const topNames = top.map(k=>DOMAINS[k].name).join(' + ');
  $('#topTitle').textContent = `Басым домен: ${topNames}`;
  $('#topDesc').textContent  = top.length>1
    ? 'Екі (немесе одан да көп) доменіңіз тең дәрежеде күшті көрінеді — бұл жан-жақтылықты білдіреді.'
    : (DOMAINS[top[0]]?.desc || '');

  const bars = $('#bars'); bars.innerHTML='';
  ['TH','RB','EX','IN'].forEach(k=>{
    const row=document.createElement('div'); row.className='barrow';
    const lab=document.createElement('div'); lab.innerHTML = `<span class="badge">${k}</span> ${DOMAINS[k].name}`;
    const track=document.createElement('div'); track.className='bartrack';
    const fill=document.createElement('div'); fill.className='barfill';
    fill.style.background=`linear-gradient(90deg, ${DOMAINS[k].color}, #6ea8fe)`;
    fill.style.width='0%';
    const pct=document.createElement('div'); pct.textContent=(norm[k]||0)+'%'; pct.style.textAlign='right';
    track.appendChild(fill); row.append(lab,track,pct); bars.appendChild(row);
    requestAnimationFrame(()=>{ fill.style.width=(norm[k]||0)+'%'; });
  });

  // түсіндірме визуал (сервер PDF-қа толық енгізеді)
  const ex=$('#explain'); ex.innerHTML='';
  const SUG={TH:'Аналитик, стратег, сценарий архитектор, R&D, дерекке негізделген шешімдер.',
             RB:'Команда коучы, HR/қабылдау, қауымдастық жетекшісі, ата-аналармен байланыс.',
             EX:'Операциялық менеджер, продюсер, жобаны жеткізу, стандарттар мен KPI.',
             IN:'Маркетинг/PR, сахналық жүргізуші, сату көшбасшысы, қоғам алдында сөйлеу.'};
  Object.keys(DOMAINS).forEach(k=>{
    const div=document.createElement('div');
    div.innerHTML = `<div class="pill">${DOMAINS[k].name}</div>
                     <div class="tip">${DOMAINS[k].desc}<br><strong>Ұсынылатын рөлдер:</strong> ${SUG[k]}</div>`;
    ex.appendChild(div);
  });

  $('#progress').style.width='100%';
  show('#screen-result');
}

/* ====== SERVER CALLS (JSONP) ====== */
function buildCreateUrl(expert, answersArr){
  const answersCsv = answersArr.map(v => (v==null?-1:Number(v))).join(',');
  const qs = [
    'mode=create',
    'secret=' + encodeURIComponent(GAS_SECRET),
    'expert=' + encodeURIComponent(expert),
    'answers=' + encodeURIComponent(answersCsv)
  ].join('&');
  return `${GAS_ENDPOINT}?${qs}`;
}

// 1) PDF ретінде сақтау: жаңа таб ашып, дайын PDF-ты соған жүктейміз
async function onExportPdf(){
  const expert = sanitizeFilename(
    $('#expertName')?.value?.trim() ||
    ($('#expertDisplay')?.textContent || '').replace(/^Маман:\s*/,'') ||
    'Маман'
  );

  // Попап-блокер ұстамасын деп — табты дәл қазір ашамыз
  const win = window.open('about:blank', '_blank', 'noopener');

  const url = buildCreateUrl(expert, answers);
  const resp = await jsonp(url);
  if (resp && resp.ok && resp.fileUrl){
    // жаңа табқа PDF сілтемесін жібереміз
    try { win.location.replace(resp.fileUrl); } catch { win.location.href = resp.fileUrl; }
    // беттегі сілтемені де жаңартамыз (қаласаңыз)
    const a = document.getElementById('driveLink');
    if (a){ a.href = resp.fileUrl; a.textContent = 'Drive сілтеме: ашу'; a.style.display='inline-block'; }
  } else {
    if (win && !win.closed) win.close();
    alert('PDF құру сәтсіз. Кейінірек қайталаңыз.');
  }
}

// 2) Тек Drive-қа жіберу: сілтемені көрсетеміз, жаңа таб ашпаймыз
async function onSendPdf(){
  const btn = document.getElementById('btnSend');
  const a   = document.getElementById('driveLink');
  if (btn) btn.disabled = true;
  if (a){ a.removeAttribute('href'); a.textContent='Жүктеліп жатыр…'; a.style.display='inline-block'; }

  const expert = sanitizeFilename(
    $('#expertName')?.value?.trim() ||
    ($('#expertDisplay')?.textContent || '').replace(/^Маман:\s*/,'') ||
    'Маман'
  );

  const url = buildCreateUrl(expert, answers);
  const resp = await jsonp(url);

  if (resp && resp.ok && resp.fileUrl){
    if (a){ a.href = resp.fileUrl; a.textContent='Drive сілтеме: ашу'; }
  } else {
    if (a){ a.removeAttribute('href'); a.textContent='Сілтеме дайын емес. Кейінірек көріңіз.'; }
  }
  if (btn) btn.disabled = false;
}

/* ====== EVENTS ====== */
document.addEventListener('DOMContentLoaded', ()=>{
  // бастау
  on('#btnStart','click', ()=>{
    useTimer = !!($('#timerToggle') && $('#timerToggle').checked);
    const name=$('#expertName')?.value?.trim();
    if(name){ window.__who = window.__who || {}; window.__who.name = name; }
    current=0; show('#screen-quiz'); renderQuestion();
  });

  // навигация
  on('#btnNext','click', ()=>{
    if (answers[current]==null){
      const pill=$('#qHint'); if (pill){ const old=pill.textContent; pill.textContent='Алдымен жауап беріңіз 🙂'; setTimeout(()=>pill.textContent=old, 1200); }
      return;
    }
    move(1);
  });
  on('#btnBack','click', ()=> move(-1));
  on('#btnReview','click', ()=>{ show('#screen-quiz'); renderQuestion(); });
  on('#btnRestart','click', ()=>{ answers.fill(null); location.reload(); });

  // қысқа пернелер
  document.addEventListener('keydown',(e)=>{
    if ($('#screen-quiz')?.classList.contains('hidden')) return;
    if (['1','2','3','4','5'].includes(e.key)){
      answers[current] = Number(e.key)-1;
      renderQuestion();
      if (useTimer) setTimeout(()=>move(1),120);
    }
    if (e.key==='ArrowRight') move(1);
    if (e.key==='ArrowLeft')  move(-1);
  });

  // Drive әрекеттері
  on('#btnExport','click', onExportPdf);
  on('#btnSend','click',   onSendPdf);
});
