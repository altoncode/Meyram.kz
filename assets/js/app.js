// Meyram Quiz — app.js (JSONP + same-tab PDF)
'use strict';

const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzkGbVW2GL_9X3IGHLjzvjXj0FTF4aM1l-X58Mx9BjtjHhnWiRWvjpQB2tc3ruc5UhI/exec'; // мыс: https://script.google.com/macros/s/XXXX/exec
const GAS_SECRET   = 'meyram_2025_Xx9hP7kL2qRv3sW8aJf1tZ4oBcDyGnHm';

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

/* ---- State ---- */
let current = 0;
const answers = new Array(QUESTIONS.length).fill(null);
let useTimer = false, timerId = null;
const PER_Q = 20;

let LAST_PDF = null;    // {ok,fileId,fileUrl,name}
let CREATE_PROMISE = null;

const $ = s => document.querySelector(s);
function on(sel, ev, fn){ const el=$(sel); if(el) el.addEventListener(ev, fn); }
function show(id){ ['#screen-start','#screen-quiz','#screen-result'].forEach(s=>$(s)?.classList.add('hidden')); $(id)?.classList.remove('hidden'); }
function sanitizeFilename(name){
  let s = String(name||'').trim();
  s = s.replace(/[\/\\:\*\?"<>|\u0000-\u001F]+/g,'').replace(/\s+/g,'_').replace(/_+/g,'_').replace(/^_+|_+$/g,'');
  return (s || 'Маман').slice(0,80);
}
function uid(){ return Math.random().toString(16).slice(2)+Math.random().toString(16).slice(2); }
function setButtonsEnabled(flag){ const e=$('#btnExport'), s=$('#btnSend'); if (e) e.disabled=!flag; if (s) s.disabled=!flag; }

/* ---- JSONP ---- */
function jsonp(url){
  return new Promise((resolve)=>{
    const cb='__CB_'+uid();
    window[cb] = (data)=>{ try{ resolve(data); } finally { delete window[cb]; } };
    const sc=document.createElement('script');
    sc.src = url + (url.includes('?')?'&':'?') + 'callback=' + encodeURIComponent(cb);
    sc.async = true;
    sc.onerror = ()=> resolve({ ok:false, error:'Network' });
    document.head.appendChild(sc);
  });
}
function buildCreateUrl(expert, answersArr){
  const csv = answersArr.map(v=> (v==null?-1:Number(v))).join(',');
  const qs = [
    'mode=create',
    'secret=' + encodeURIComponent(GAS_SECRET),
    'expert=' + encodeURIComponent(expert),
    'answers=' + encodeURIComponent(csv)
  ].join('&');
  return `${GAS_ENDPOINT}?${qs}`;
}

/* ---- Quiz UI ---- */
function renderQuestion(){
  const q = QUESTIONS[current];
  $('#qText').textContent = q.t;
  $('#qCounter').textContent = `Сұрақ ${current+1} / ${QUESTIONS.length}`;

  const done = answers.filter(v=>v!=null).length;
  $('#progress').style.width = Math.round(done/QUESTIONS.length*100)+'%';

  const labels = ['Мүлде сәйкес келмейді','Көбірек сәйкес келмейді','Бейтарап','Көбірек сәйкес келеді','Өте сәйкес келеді'];
  const scale = $('#scale'); scale.innerHTML='';
  labels.forEach((lab, idx)=>{
    const btn = document.createElement('button');
    btn.type='button';
    btn.className='opt';
    btn.textContent = lab;
    btn.style.color = '#fff'; // ақ мәтін (қараңғы фонда көрінсін)
    if (answers[current]===idx) btn.classList.add('active');
    btn.addEventListener('click', ()=>{
      answers[current]=idx;
      renderQuestion();
      if (useTimer) setTimeout(()=>move(1), 120);
    });
    scale.appendChild(btn);
  });

  $('#timerPill').style.display = useTimer ? 'inline-flex' : 'none';
  if (useTimer) startTimer(PER_Q, ()=>move(1)); else stopTimer();

  $('#btnBack').disabled = (current===0);
}
function move(d){
  stopTimer();
  current += d;
  if (current<0) current=0;
  if (current>=QUESTIONS.length){ finishQuiz(); return; }
  renderQuestion();
}
function startTimer(sec, onDone){
  let left=sec; $('#timer').textContent=left;
  timerId=setInterval(()=>{ left--; $('#timer').textContent=left; if(left<=0){ stopTimer(); onDone&&onDone(); } },1000);
}
function stopTimer(){ if(timerId){ clearInterval(timerId); timerId=null; } }

function compute(){
  const per={TH:[],RB:[],EX:[],IN:[]}; QUESTIONS.forEach((q,i)=> per[q.d].push(answers[i]));
  const raw={}, norm={};
  for(const k of Object.keys(per)){
    const arr=per[k].filter(v=>v!=null); const sum=arr.reduce((a,b)=>a+Number(b),0);
    const denom=Math.max(arr.length*4,1);
    raw[k]=sum; norm[k]=Math.round((sum/denom)*100);
  }
  const max=Math.max(...Object.values(raw));
  const top=Object.entries(raw).filter(([,v])=>v===max).map(([k])=>k);
  return { raw, norm, top };
}

/* ---- Waiting → create → render ---- */
function showWaiting(){
  show('#screen-result');
  $('#expertDisplay').textContent = '';
  $('#topTitle').textContent = 'Нәтиже дайындалуда…';
  $('#topDesc').textContent  = 'PDF жасалып, Google Drive-қа сақталып жатыр. Бір сәт күтіңіз.';

  $('#bars').innerHTML = `
    <div class="loader-wrap">
      <div class="spinner" aria-label="Жүктелуде" role="status"></div>
      <div class="muted" style="margin-top:8px">Құжат дайындалып жатыр…</div>
    </div>
  `;
  $('#explain').innerHTML = '';
  setButtonsEnabled(false);
}
function renderResultContent(){
  const { norm, top } = compute();
  const name = $('#expertName')?.value?.trim() || '';
  $('#expertDisplay').innerHTML = name ? `<span class="hl">Маман:</span> ${name}` : '';

  const topNames = top.map(k=>DOMAINS[k].name).join(' + ');
  $('#topTitle').innerHTML = `<span class="hl">Басым домен:</span> ${topNames}`;
  $('#topDesc').textContent  = top.length>1
    ? 'Екі (немесе одан да көп) доменіңіз тең дәрежеде күшті көрінеді — бұл жан-жақтылықты білдіреді.'
    : (DOMAINS[top[0]]?.desc || '');

  const bars=$('#bars'); bars.innerHTML='';
  ['TH','RB','EX','IN'].forEach(k=>{
    const row=document.createElement('div'); row.className='barrow';
    const lab=document.createElement('div'); lab.innerHTML=`<span class="badge">${k}</span> ${DOMAINS[k].name}`;
    const track=document.createElement('div'); track.className='bartrack';
    const fill=document.createElement('div'); fill.className='barfill';
    fill.style.background=`linear-gradient(90deg, ${DOMAINS[k].color}, #6ea8fe)`; fill.style.width='0%';
    const pct=document.createElement('div'); pct.textContent=(norm[k]||0)+'%'; pct.style.textAlign='right';
    track.appendChild(fill); row.append(lab,track,pct); bars.appendChild(row);
    requestAnimationFrame(()=>{ fill.style.width=(norm[k]||0)+'%'; });
  });

  const expl = $('#explain'); expl.innerHTML='';
  const SUG = {
    TH:'Аналитик, стратег, сценарий архитектор, R&D, дерекке негізделген шешімдер.',
    RB:'Команда коучы, HR/қабылдау, қауымдастық жетекшісі, ата-аналармен байланыс.',
    EX:'Операциялық менеджер, продюсер, жобаны жеткізу, стандарттар мен KPI.',
    IN:'Маркетинг/PR, сахналық жүргізуші, сату көшбасшысы, қоғам алдында сөйлеу.'
  };
  Object.keys(DOMAINS).forEach(k=>{
    const div=document.createElement('div');
    div.innerHTML=`<div class="pill">${DOMAINS[k].name}</div>
                   <div class="tip"><span class="hl">Түсіндірме:</span> ${DOMAINS[k].desc}<br>
                   <span class="hl">Ұсынылатын рөлдер:</span> ${SUG[k]}</div>`;
    expl.appendChild(div);
  });

  $('#progress').style.width='100%';
  setButtonsEnabled(!!LAST_PDF);
}
async function ensurePdfCreated(){
  if (LAST_PDF && LAST_PDF.fileId) return LAST_PDF;
  if (CREATE_PROMISE) return CREATE_PROMISE;

  const expert = sanitizeFilename(
    $('#expertName')?.value?.trim() ||
    ($('#expertDisplay')?.textContent || '').replace(/^Маман:\s*/,'') ||
    'Маман'
  );
  const url = buildCreateUrl(expert, answers);
  CREATE_PROMISE = jsonp(url).then(resp=>{
    CREATE_PROMISE = null;
    LAST_PDF = (resp && resp.ok) ? resp : null;
    return LAST_PDF;
  });
  return CREATE_PROMISE;
}
async function finishQuiz(){
  showWaiting();
  LAST_PDF = null;
  await ensurePdfCreated();
  renderResultContent();
}

/* ---- Actions ---- */
async function onExportPdf(){
  const pdf = await ensurePdfCreated();
  if (!pdf || !pdf.fileId) { alert('PDF дайын емес. Кейін қайталап көріңіз.'); return; }
  const url = `${GAS_ENDPOINT}?mode=pdf&secret=${encodeURIComponent(GAS_SECRET)}&id=${encodeURIComponent(pdf.fileId)}`;
  location.assign(url); // жаңа таб ашпай, осы бетте PDF viewer
}
async function onSendPdf(){
  const pdf = await ensurePdfCreated();
  if (!pdf || !pdf.fileUrl) { alert('PDF дайын емес. Кейін қайталап көріңіз.'); return; }
  const title='Meyram — домен-тест нәтижесі';
  const text ='Нәтиже PDF:';
  const url  = pdf.fileUrl;
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); return; } catch(_) {}
  }
  // Қажет болса мұнда WA/TG deeplink қосыңыз
}

/* ---- Wire UI ---- */
function wireUi(){
  on('#btnStart','click', ()=>{
    useTimer = !!($('#timerToggle') && $('#timerToggle').checked);
    const name=$('#expertName')?.value?.trim();
    if(name){ window.__who = window.__who || {}; window.__who.name = name; }
    current=0; show('#screen-quiz'); renderQuestion();
  });

  on('#btnNext','click', ()=>{
    if (answers[current]==null){
      const pill=$('#qHint'); if (pill){ const old=pill.textContent; pill.textContent='Алдымен жауап беріңіз 🙂'; setTimeout(()=>pill.textContent=old,1200); }
      return;
    }
    move(1);
  });
  on('#btnBack','click', ()=> move(-1));
  on('#btnReview','click', ()=>{ show('#screen-quiz'); renderQuestion(); });
  on('#btnRestart','click', ()=>{ answers.fill(null); location.reload(); });

  on('#btnExport','click', onExportPdf);
  on('#btnSend'  ,'click', onSendPdf);

  document.addEventListener('keydown',(e)=>{
    if($('#screen-quiz')?.classList.contains('hidden')) return;
    if (['1','2','3','4','5'].includes(e.key)){
      answers[current]=Number(e.key)-1;
      renderQuestion();
      if (useTimer) setTimeout(()=>move(1),120);
    }
    if (e.key==='ArrowRight') move(1);
    if (e.key==='ArrowLeft')  move(-1);
  });
}
document.addEventListener('DOMContentLoaded', wireUi);
