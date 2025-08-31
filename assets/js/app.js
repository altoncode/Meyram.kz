// Meyram Quiz — app.js (JSONP-only; no DOM->PDF)
'use strict';

/* ===== GAS endpoint (жаңа ключ) ===== */
const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwhpToU1iOp2yQ625DF1zdaJb5uUROaTRFGATWAOQZHjT4o3rmLkQ-K0JpcUxbYXSDg/exec';
const GAS_SECRET   = 'meyram_2025_Xx9hP7kL2qRv3sW8aJf1tZ4oBcDyGnHm';

/* ===== Quiz data ===== */
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

/* ===== State ===== */
let current = 0;
const answers = new Array(QUESTIONS.length).fill(null); // 0..4, null=skip
let useTimer = false, timerId = null;
const PER_Q = 20;
let LAST_PDF = null;          // { url, id, name }
let CREATE_PROMISE = null;    // duplicate-құтылу үшін

/* ===== Helpers ===== */
const $ = s => document.querySelector(s);
function on(sel, ev, fn){ const el=$(sel); if(el) el.addEventListener(ev, fn); }
function show(id){
  ['#screen-start','#screen-quiz','#screen-result'].forEach(s=>$(s)?.classList.add('hidden'));
  $(id)?.classList.remove('hidden');
}
function sanitizeFilename(name){
  let s = String(name||'').trim();
  s = s.replace(/[\/\\:\*\?"<>|\u0000-\u001F]+/g,'').replace(/\s+/g,'_').replace(/_+/g,'_').replace(/^_+|_+$/g,'');
  return (s || 'Маман').slice(0,80);
}
function uid(){ return Math.random().toString(16).slice(2)+Math.random().toString(16).slice(2); }

// JSONP шақыру (тазалау + таймаут)
function jsonp(url, timeoutMs=15000){
  return new Promise((resolve)=>{
    const cb='__CB_'+uid();
    let done=false;
    const s=document.createElement('script');
    const finish = (data)=>{ if(done) return; done=true; try{ resolve(data); } finally { delete window[cb]; try{s.remove();}catch{} } };
    window[cb] = (data)=> finish(data);
    s.src = url + (url.includes('?')?'&':'?') + 'callback=' + encodeURIComponent(cb);
    s.async = true;
    s.onerror = ()=> finish({ ok:false, error:'Network' });
    document.head.appendChild(s);
    setTimeout(()=> finish({ ok:false, error:'Timeout' }), timeoutMs);
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

/* ===== Quiz render ===== */
function renderQuestion(){
  // ☑ Ескі таймерді тоқтатып аламыз
  stopTimer();

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
    // мәтін — ақ
    btn.style.color = '#fff';

    if (answers[current]===idx) btn.classList.add('active');
    btn.addEventListener('click', ()=>{
      answers[current]=idx;
      renderQuestion();
      if (useTimer) setTimeout(()=>move(1), 120);
    });
    scale.appendChild(btn);
  });

  $('#timerPill').style.display = useTimer ? 'inline-flex' : 'none';
  if (useTimer) startTimer(PER_Q, ()=>move(1));

  $('#btnBack').disabled = (current===0);
}
function move(d){
  stopTimer();
  current += d;
  if (current<0) current=0;
  if (current>=QUESTIONS.length){ finishQuiz(); return; } // ❗ finish: серверде PDF жасап, сосын нәтиже
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
    const arr=per[k].filter(v=>v!=null);
    const sum=arr.reduce((a,b)=>a+Number(b),0);
    const denom=Math.max(arr.length*4,1);
    raw[k]=sum; norm[k]=Math.round((sum/denom)*100);
  }
  const max=Math.max(...Object.values(raw));
  const top=Object.entries(raw).filter(([,v])=>v===max).map(([k])=>k);
  return { raw, norm, top };
}

/* ===== Waiting → create PDF → then render result ===== */
function showWaiting(){
  show('#screen-result');
  $('#expertDisplay').textContent = '';
  $('#topTitle').textContent = 'Нәтиже дайындалуда…';
  $('#topDesc').textContent  = 'PDF жасалып, Google Drive-қа сақталып жатыр.';
  $('#bars').innerHTML = '';
  $('#explain').innerHTML = '';
  const be = $('#btnExport'), bs = $('#btnSend');
  if (be) be.disabled = true;
  if (bs) bs.disabled = true;
}
function renderResultContent(){
  const { norm, top } = compute();
  const name = $('#expertName')?.value?.trim() || '';
  $('#expertDisplay').textContent = name ? `Маман: ${name}` : '';
  const topNames = top.map(k=>DOMAINS[k].name).join(' + ');
  $('#topTitle').textContent = `Басым домен: ${topNames}`;
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

  // қысқаша түсіндірме (визуал)
  const ex=$('#explain'); ex.innerHTML='';
  const SUG={TH:'Аналитик, стратег, сценарий архитектор, R&D, дерекке негізделген шешімдер.',
             RB:'Команда коучы, HR/қабылдау, қауымдастық жетекшісі, ата-аналармен байланыс.',
             EX:'Операциялық менеджер, продюсер, жобаны жеткізу, стандарттар мен KPI.',
             IN:'Маркетинг/PR, сахналық жүргізуші, сату көшбасшысы, қоғам алдында сөйлеу.'};
  Object.keys(DOMAINS).forEach(k=>{
    const div=document.createElement('div');
    div.innerHTML=`<div class="pill">${DOMAINS[k].name}</div>
                   <div class="tip">${DOMAINS[k].desc}<br><strong>Ұсынылатын рөлдер:</strong> ${SUG[k]}</div>`;
    ex.appendChild(div);
  });

  const be = $('#btnExport'), bs = $('#btnSend');
  if (be) be.disabled = !LAST_PDF;
  if (bs) bs.disabled = !LAST_PDF;
}
async function ensurePdfCreated(){
  if (LAST_PDF && LAST_PDF.url) return LAST_PDF;
  if (CREATE_PROMISE) return CREATE_PROMISE;

  const expert = sanitizeFilename(
    $('#expertName')?.value?.trim() ||
    ($('#expertDisplay')?.textContent || '').replace(/^Маман:\s*/,'') ||
    'Маман'
  );
  const url = buildCreateUrl(expert, answers);
  CREATE_PROMISE = jsonp(url).then(resp=>{
    CREATE_PROMISE = null;
    if (resp && resp.ok) { LAST_PDF = { url: resp.fileUrl, id: resp.fileId, name: resp.name }; return LAST_PDF; }
    LAST_PDF = null; return null;
  });
  return CREATE_PROMISE;
}
async function finishQuiz(){
  showWaiting();                 // 1) күту экраны
  LAST_PDF = null;
  await ensurePdfCreated();      // 2) сервер PDF жасайды/сақтайды
  renderResultContent();         // 3) содан кейін ғана нақты нәтиже
  $('#progress').style.width='100%';
}

/* ===== Print helpers (no popup) ===== */
function printViaHiddenIframe(url) {
  // бар болса — өшіреміз
  const prev = document.getElementById('print-frame');
  if (prev) try{ prev.remove(); }catch{}
  const f = document.createElement('iframe');
  f.id = 'print-frame';
  f.style.position = 'fixed';
  f.style.right = '0';
  f.style.bottom = '0';
  f.style.width = '0';
  f.style.height = '0';
  f.style.border = '0';
  f.src = url + (url.includes('#') ? '' : '#view=FitH');

  let printed = false;
  const fire = () => {
    if (printed) return;
    printed = true;
    try {
      f.contentWindow && f.contentWindow.focus();
      f.contentWindow && f.contentWindow.print();
    } catch (_) {}
    setTimeout(()=>{ try{ f.remove(); }catch{} }, 2000);
  };

  f.onload = () => setTimeout(fire, 300);
  setTimeout(fire, 8000); // сақтық фолбэк
  document.body.appendChild(f);
}

/* ===== Export / Send actions ===== */
async function onExportPdf(){
  const pdf = await ensurePdfCreated();
  if (!pdf || !pdf.url) {
    alert('PDF дайын емес. Кейін қайталап көріңіз.');
    return;
  }
  // Поп-апсыз принт: жасырын iframe ішінде ашып, бірден print()
  printViaHiddenIframe(pdf.url);
}

async function onSendPdf(){
  const pdf = await ensurePdfCreated();
  if (!pdf || !pdf.url) { alert('PDF дайын емес. Кейін қайталап көріңіз.'); return; }

  const title='Meyram — домен-тест нәтижесі';
  const text ='Нәтиже PDF:';
  const url  = pdf.url;

  if (navigator.share) {
    try { await navigator.share({ title, text, url }); return; }
    catch(_) { /* fallback */ }
  }
  const wa = 'https://wa.me/?text=' + encodeURIComponent(`${title}\n${url}`);
  window.open(wa, '_blank', 'noopener');
}

/* ===== UI glue ===== */
function renderStart(){
  // Жауап опцияларының мәтінін ақ ету (CSS override-ынан сақтаныңыз)
  const style = document.createElement('style');
  style.textContent = `.scale .opt{color:#fff !important}`;
  document.head.appendChild(style);

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

  // Actions
  on('#btnExport','click', onExportPdf);
  on('#btnSend','click',   onSendPdf);

  // Shortcut пернелер
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

  // Таймерді пауза/қалпына келтіру
  document.addEventListener('visibilitychange',()=>{
    if(!useTimer) return;
    if(document.hidden) stopTimer(); else startTimer(PER_Q,()=>move(1));
  });
}

document.addEventListener('DOMContentLoaded', renderStart);
