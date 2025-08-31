// Meyram Quiz — app.js
// Клиенттік: ТЕЗ print, PDF-ті СЕРВЕР ҚҰРАДЫ (JSONP арқылы Drive-қа салу).
// TZ: Asia/Almaty (UTC+5)
'use strict';

/* ================== GOOGLE APPS SCRIPT ================== */
// ЖАҢА веб-ап URL (сіз берген):
const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxvdLsIASDcRClDXGWoQMHCRZjLiVp1KTgwhUv7ZVyGosKgF4wg2GPxv0vvsUAA3kQ/exec';
// Сервермен келісілген құпия:
const GAS_SECRET   = 'meyram_2025_Xx9hP7kL2qRv3sW8aJf1tZ4oBcDyGnHm';

/* ================== QUIZ ДЕРЕКТЕРІ ================== */
const DOMAINS = {
  TH: { name: 'Мышление (Стратегиялық ойлау)', color: '#86ffda',
    desc: 'Идеялар, талдау, болашақты көру, стратегия құруға бейім.' },
  RB: { name: 'Отношения (Қарым-қатынас)', color: '#6ea8fe',
    desc: 'Команданы біріктіріп, сенім орнатады, эмпатиясы жоғары.' },
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

/* ================== ЖАҒДАЙ ================== */
let current = 0;                                // 0..19
const answers = new Array(QUESTIONS.length).fill(null); // 0..4, null=skip
let useTimer = false;
let timerId = null;
const PER_QUESTION = 20; // сек
const LS_KEY = 'meyram-quiz-v1';

/* ================== КӨМЕКШІЛЕР ================== */
const $  = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);
function on(sel, ev, handler){ const el=$(sel); if(el) el.addEventListener(ev, handler); }

function show(id){
  ['#screen-start','#screen-quiz','#screen-result'].forEach(s=>$(s)?.classList.add('hidden'));
  $(id)?.classList.remove('hidden');
}

// Кириллді сақтаймыз, тек шын тыйым салынғандарын алып тастаймыз
function sanitizeFilename(name){
  let s = String(name || '').trim();
  s = s.replace(/[\/\\:\*\?"<>|\u0000-\u001F]+/g, ''); // forbidden
  s = s.replace(/\s+/g, ' ').replace(/^ +| +$/g, '');  // артық бос орын
  if (!s) s = 'Маман';
  return s.slice(0, 120);
}
function formatDateYMD(d=new Date()){
  const yyyy=d.getFullYear(), mm=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}

/* ================== QUIZ RENDER ================== */
function renderQuestion(){
  const q = QUESTIONS[current];
  $('#qText').textContent = q.t;
  $('#qCounter').textContent = `Сұрақ ${current+1} / ${QUESTIONS.length}`;

  const answeredCount = answers.filter(v => v != null).length;
  $('#progress').style.width = Math.round((answeredCount/QUESTIONS.length)*100) + '%';

  const labels = ['Мүлде сәйкес келмейді','Көбірек сәйкес келмейді','Бейтарап','Көбірек сәйкес келеді','Өте сәйкес келеді'];
  const scale = $('#scale');
  scale.innerHTML=''; 
  scale.setAttribute('role','radiogroup'); 
  scale.setAttribute('aria-label','Бағалау шкаласы');

  labels.forEach((lab, idx) => {
    const opt = document.createElement('div');
    opt.className='opt';
    opt.setAttribute('role','radio');
    opt.setAttribute('aria-checked', answers[current]===idx?'true':'false');
    opt.tabIndex=0;

    const text=document.createElement('span'); 
    text.textContent=lab;

    const input=document.createElement('input');
    input.type='radio'; input.name=`q${current}`;
    input.value=String(idx); input.tabIndex=-1;
    input.style.pointerEvents='none';

    if(answers[current]===idx){ input.checked=true; opt.classList.add('active'); }

    input.addEventListener('change',()=>{
      answers[current]=idx;
      $$('.opt').forEach(el=>{ el.classList.remove('active'); el.setAttribute('aria-checked','false'); });
      opt.classList.add('active'); 
      opt.setAttribute('aria-checked','true');
      saveState();
      if(useTimer) setTimeout(()=>move(1),120); // автокөшу тек таймер қосулыда
    });

    opt.addEventListener('click',()=>input.click());
    opt.addEventListener('keydown',(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); input.click(); }});

    opt.append(text,input);
    scale.appendChild(opt);
  });

  if(useTimer){ $('#timerPill').style.display='inline-flex'; startTimer(PER_QUESTION,()=>move(1)); }
  else { $('#timerPill').style.display='none'; stopTimer(); }

  $('#btnBack').disabled = (current===0);
}

function move(delta){
  stopTimer();
  current += delta;
  if(current<0) current=0;
  if(current>=QUESTIONS.length){ showResult(); return; }
  saveState();
  renderQuestion();
}

function startTimer(sec,onDone){
  let left=sec; $('#timer').textContent=left;
  timerId=setInterval(()=>{
    left--; $('#timer').textContent=left;
    if(left<=0){ stopTimer(); onDone&&onDone(); }
  },1000);
}
function stopTimer(){ if(timerId){ clearInterval(timerId); timerId=null; } }

function compute(){
  const per={TH:[],RB:[],EX:[],IN:[]};
  QUESTIONS.forEach((q,i)=> per[q.d].push(answers[i]));

  const raw={}, norm={};
  for(const [k,arr] of Object.entries(per)){
    const answered=arr.filter(v=>v!=null);
    const sum=answered.reduce((a,b)=>a+Number(b),0);
    const denom=Math.max(answered.length*4,1);
    raw[k]=sum;
    norm[k]=Math.round((sum/denom)*100);
  }
  const maxRaw=Math.max(...Object.values(raw));
  const top=Object.entries(raw).filter(([,v])=>v===maxRaw).map(([k])=>k);
  return { raw, norm, top };
}

function showResult(){
  $('#progress').style.width='100%';
  const { norm, top } = compute();

  const name = $('#expertName')?.value?.trim() || '';
  $('#expertDisplay').textContent = name ? `Маман: ${name}` : '';

  const topNames = top.map(k=>DOMAINS[k].name).join(' + ');
  $('#topTitle').textContent = `Басым домен: ${topNames}`;
  $('#topDesc').textContent = top.length>1
    ? 'Екі (немесе одан да көп) доменіңіз тең дәрежеде күшті көрінеді — бұл жан-жақтылықты білдіреді.'
    : DOMAINS[top[0]].desc;

  const bars=$('#bars'); bars.innerHTML='';
  ['TH','RB','EX','IN'].forEach(k=>{
    const row=document.createElement('div'); row.className='barrow';
    const lab=document.createElement('div'); lab.innerHTML=`<span class="badge">${k}</span> ${DOMAINS[k].name}`;
    const track=document.createElement('div'); track.className='bartrack';
    const fill=document.createElement('div'); fill.className='barfill';
    fill.style.background=`linear-gradient(90deg, ${DOMAINS[k].color}, #6ea8fe)`; 
    fill.style.width='0%';
    const pct=document.createElement('div'); pct.textContent=norm[k]+'%'; pct.style.textAlign='right';
    track.appendChild(fill); row.append(lab,track,pct); bars.appendChild(row);
    requestAnimationFrame(()=>{ fill.style.width=norm[k]+'%'; });
  });

  const ex=$('#explain'); ex.innerHTML='';
  const SUG={
    TH:'Аналитик, стратег, сценарий архитектор, R&D, дерекке негізделген шешімдер.',
    RB:'Команда коучы, HR/қабылдау, қауымдастық жетекшісі, ата-аналармен байланыс.',
    EX:'Операциялық менеджер, продюсер, жобаны жеткізу, стандарттар мен KPI.',
    IN:'Маркетинг/PR, сахналық жүргізуші, сату көшбасшысы, қоғам алдында сөйлеу.'
  };
  Object.keys(DOMAINS).forEach(k=>{
    const div=document.createElement('div');
    div.innerHTML=`<div class="pill">${DOMAINS[k].name}</div><div class="tip">${DOMAINS[k].desc}<br><strong>Ұсынылатын рөлдер:</strong> ${SUG[k]}</div>`;
    ex.appendChild(div);
  });

  show('#screen-result');
  saveState();
}

/* ================== ПЕЧАТ (жылдам) ================== */
function exportPDF(){ try{ window.print(); }catch(_){} }

/* ================== JSONP -> GAS: PDF-ті сервер жинайды ================== */
function sendToDrive(){
  const btnSend = $('#btnSend');
  const doneBox = $('#driveDone');
  const linkEl  = $('#driveFileLink');
  const copyBtn = $('#btnCopyLink');
  if (doneBox) doneBox.style.display = 'none';

  const { norm, top } = compute();
  const expert = sanitizeFilename(
    $('#expertName')?.value?.trim()
    || (window.__who && window.__who.name)
    || ($('#expertDisplay')?.textContent || '').replace(/^Маман:\s*/, '')
  );
  const dateYMD  = formatDateYMD(new Date());
  const topNames = top.map(k => DOMAINS[k].name).join(' + ');
  const tips = 'Бұл қысқартылған сынама Gallup® ресми тестін алмастырмайды.';

  // JSONP callback аты (safe)
  const cbName = 'MeyramJSONP_' + Math.random().toString(36).slice(2);
  window[cbName] = function(resp){
    cleanup();
    if (btnSend) { btnSend.disabled = false; btnSend.textContent = 'PDF жіберу (Drive)'; }

    if (!resp || !resp.ok) {
      alert('Жіберу сәтсіз. Кейінірек қайталап көріңіз.');
      return;
    }
    if (linkEl) {
      linkEl.href = resp.url;
      linkEl.textContent = resp.name || 'PDF сілтемесі';
    }
    if (doneBox) doneBox.style.display = 'block';

    if (copyBtn) {
      copyBtn.onclick = async () => {
        try { await navigator.clipboard.writeText(resp.url); copyBtn.textContent = 'Көшірілді ✅'; }
        catch { copyBtn.textContent = 'Көшіре алмады'; }
        setTimeout(()=> copyBtn.textContent = 'Көшіру', 2000);
      };
    }
  };
  function cleanup(){
    try { delete window[cbName]; } catch {}
    if (script && script.parentNode) script.parentNode.removeChild(script);
  }

  const params = new URLSearchParams({
    action: 'createjsonp',
    secret: GAS_SECRET,
    expertName: expert,
    dateYMD,
    th: String(norm.TH || 0),
    rb: String(norm.RB || 0),
    ex: String(norm.EX || 0),
    in: String(norm.IN || 0),        // "in" — рұқсат етілген query key
    top: topNames,
    tips,
    callback: cbName
  });

  const script = document.createElement('script');
  script.src = GAS_ENDPOINT + '?' + params.toString();
  script.onerror = () => { cleanup(); if (btnSend){ btnSend.disabled=false; btnSend.textContent='PDF жіберу (Drive)'; } alert('Желі қатесі. Кейінірек қайталап көріңіз.'); };

  if (btnSend) { btnSend.disabled = true; btnSend.textContent = 'Жіберілуде…'; }
  document.head.appendChild(script);
}

/* ================== STATE (LS) ================== */
function saveState(){ try{ localStorage.setItem(LS_KEY, JSON.stringify({ current, answers, useTimer })); }catch{} }
function loadState(){
  try{
    const s = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); if(!s) return;
    useTimer=!!s.useTimer; const tgl=$('#timerToggle'); if(tgl) tgl.checked=useTimer;
    current=Math.min(Math.max(Number(s.current)||0,0), QUESTIONS.length-1);
    if(Array.isArray(s.answers)) s.answers.forEach((v,i)=> answers[i]=(v===null?null:Number(v)));
  }catch{}
}

/* ================== БАЙНДИНГ ================== */
document.addEventListener('DOMContentLoaded', () => {
  loadState();

  on('#btnStart','click',()=>{
    const tgl=$('#timerToggle'); useTimer=!!(tgl && tgl.checked);
    const name=$('#expertName')?.value?.trim();
    if(name){ window.__who=window.__who||{}; window.__who.name=name; }
    current=0; show('#screen-quiz'); renderQuestion();
  });

  on('#btnNext','click',()=>{
    if (answers[current] == null) {
      const pill=$('#qHint'); const old=pill?.textContent||'';
      if (pill){ pill.textContent='Алдымен жауап беріңіз 🙂'; setTimeout(()=>{ pill.textContent=old; },1200); }
      return;
    }
    move(1);
  });

  on('#btnBack','click',()=> move(-1));
  on('#btnSkip','click',()=>{ answers[current]=null; move(1); });

  on('#btnRestart','click',()=>{ answers.fill(null); localStorage.removeItem(LS_KEY); location.reload(); });
  on('#btnReview','click',()=>{ show('#screen-quiz'); renderQuestion(); });

  on('#btnExport','click', exportPDF);  // лезде print
  on('#btnSend','click', sendToDrive);   // сервер жасайды PDF + share link

  document.addEventListener('keydown',(e)=>{
    if($('#screen-quiz')?.classList.contains('hidden')) return;
    const key=e.key;
    if(['1','2','3','4','5'].includes(key)){
      const idx=Number(key)-1; answers[current]=idx; saveState(); renderQuestion();
      if(useTimer) setTimeout(()=>move(1),120);
    }
    if(key==='ArrowRight') move(1);
    if(key==='ArrowLeft') move(-1);
  });

  document.addEventListener('visibilitychange',()=>{
    if(!useTimer) return; 
    if(document.hidden) stopTimer(); else startTimer(PER_QUESTION,()=>move(1));
  });
});
