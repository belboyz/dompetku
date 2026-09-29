const STORAGE_KEY='dompetku';
const OLD_KEY='dompetku';
const CATEGORIES={
  Makan:{icon:'utensils',color:'#16a673'},Transportasi:{icon:'car-front',color:'#4f74d9'},Kuliah:{icon:'book-open',color:'#8a62d8'},Kos:{icon:'house',color:'#e08b3e'},Belanja:{icon:'shopping-cart',color:'#d65b75'},Hiburan:{icon:'gamepad-2',color:'#e2ad37'},Kesehatan:{icon:'heart-pulse',color:'#e05c69'},Tagihan:{icon:'receipt',color:'#657080'},Lainnya:{icon:'package',color:'#697386'}
};
const DEFAULT_DATA={budget:500000,periodStart:null,periodEnd:null,transactions:[]};
let data=loadData();
let selectedCategory='Makan';
let editingId=null;
let detailId=null;

function pad(n){return String(n).padStart(2,'0')}
function dateKey(d=new Date()){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function parseKey(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return null;const [y,m,d]=s.split('-').map(Number);const x=new Date(y,m-1,d);x.setHours(0,0,0,0);return Number.isNaN(x.getTime())?null:x}
function today(){return dateKey()}
function addDays(key,n){const d=parseKey(key);if(!d)return key;d.setDate(d.getDate()+n);return dateKey(d)}
function formatMoney(v){return new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Math.round(Number(v)||0))}
function formatDate(key,withYear=false){const d=parseKey(key)||new Date(key);if(Number.isNaN(d.getTime()))return '-';return d.toLocaleDateString('id-ID',{day:'numeric',month:'short',...(withYear?{year:'numeric'}:{})})}
function fullDate(key){const d=parseKey(key);return d?d.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'}):'-'}
function uid(){return `${Date.now()}-${Math.random().toString(36).slice(2,8)}`}
function cloneDefault(){return {budget:DEFAULT_DATA.budget,periodStart:DEFAULT_DATA.periodStart,periodEnd:DEFAULT_DATA.periodEnd,transactions:[]}}

function loadData(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);

    if(!raw){
      const d=cloneDefault();
      const n=new Date();
      d.periodStart=`${n.getFullYear()}-${pad(n.getMonth()+1)}-01`;
      d.periodEnd=dateKey(new Date(n.getFullYear(),n.getMonth()+1,0));
      return d;
    }

    const p=JSON.parse(raw);
    const d={...cloneDefault(),...p};

    d.budget=Number(d.budget)>0?Number(d.budget):DEFAULT_DATA.budget;
    d.transactions=Array.isArray(d.transactions)
      ?d.transactions.map(normalizeTransaction).filter(Boolean)
      :[];

    if(!d.periodStart||!d.periodEnd){
      const oldMode=p.mode;

      if(oldMode==='monthly'){
        const n=new Date();
        d.periodStart=`${n.getFullYear()}-${pad(n.getMonth()+1)}-01`;
        d.periodEnd=dateKey(new Date(n.getFullYear(),n.getMonth()+1,0));
      }else{
        const end=today();
        d.periodEnd=end;
        d.periodStart=oldMode==='weekly'?addDays(end,-6):end;
      }
    }

    return d;
  }catch(e){
    console.error(e);
    return initPeriod(cloneDefault());
  }
}

function normalizeTransaction(t){
  if(!t||Number(t.amount)<=0)return null;

  return {
    id:String(t.id||uid()),
    amount:Math.round(Number(t.amount)),
    category:CATEGORIES[t.category]?t.category:'Lainnya',
    note:String(t.note||''),
    date:/^\d{4}-\d{2}-\d{2}$/.test(t.date)?t.date:today(),
    createdAt:t.createdAt||new Date().toISOString()
  };
}

function initPeriod(d){
  const n=new Date();
  const start=`${n.getFullYear()}-${pad(n.getMonth()+1)}-01`;
  const end=dateKey(new Date(n.getFullYear(),n.getMonth()+1,0));

  d.periodStart=d.periodStart||start;
  d.periodEnd=d.periodEnd||end;

  return d;
}

function save(){
  localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
}

function periodDays(){
  const a=parseKey(data.periodStart);
  const b=parseKey(data.periodEnd);

  return a&&b
    ?Math.max(1,Math.round((b-a)/86400000)+1)
    :1;
}

function inPeriod(t){
  const d=parseKey(t.date);
  const a=parseKey(data.periodStart);
  const b=parseKey(data.periodEnd);

  return d&&a&&b&&d>=a&&d<=b;
}

function periodSpent(){
  return data.transactions
    .filter(inPeriod)
    .reduce((s,t)=>s+t.amount,0);
}

function todaySpent(){
  const k=today();

  return data.transactions
    .filter(t=>t.date===k)
    .reduce((s,t)=>s+t.amount,0);
}

/*
 * BATAS HARIAN DASAR
 *
 * Contoh:
 * Budget       : Rp500.000
 * Periode      : 7 hari
 * Batas dasar  : Rp71.429/hari
 */
function baseDailyLimit(){
  const budget=Math.max(0,Number(data.budget));
  const days=periodDays();

  return days>0
    ?budget/days
    :0;
}

/*
 * TOTAL PENGELUARAN PADA TANGGAL TERTENTU
 */
function spentOnDate(dateKeyValue){
  return data.transactions
    .filter(t=>t.date===dateKeyValue)
    .reduce((s,t)=>s+t.amount,0);
}

/*
 * HITUNG BATAS HARIAN BERDASARKAN KELEBIHAN HARI SEBELUMNYA
 *
 * Logika:
 *
 * Hari 1:
 * Batas dasar = Rp71.429
 * Pengeluaran = Rp80.000
 * Kelebihan   = Rp8.571
 *
 * Hari 2:
 * Batas = Rp71.429 - Rp8.571
 *      = Rp62.858
 *
 * Jika Hari 2 hanya menghabiskan Rp50.000:
 * Sisa Rp12.858 TIDAK ditambahkan ke Hari 3.
 *
 * Hari 3:
 * Kembali ke Rp71.429
 *
 * Jadi yang dibawa ke hari berikutnya
 * hanya KELEBIHAN pengeluaran.
 */
function calculateDailyLimit(dateKeyValue=today()){
  const start=parseKey(data.periodStart);
  const end=parseKey(data.periodEnd);
  const target=parseKey(dateKeyValue);

  if(
    !start||
    !end||
    !target||
    target<start||
    target>end
  ){
    return baseDailyLimit();
  }

  const base=baseDailyLimit();

  // Kelebihan pengeluaran yang dibawa dari hari sebelumnya.
  let carry=0;

  let cursor=new Date(start);

  while(cursor<target){
    const key=dateKey(cursor);

    // Batas hari ini dikurangi kelebihan dari hari sebelumnya.
    const limit=Math.max(0,base-carry);

    // Total pengeluaran pada hari tersebut.
    const spent=spentOnDate(key);

    /*
     * Hanya kelebihan yang diteruskan.
     *
     * Jika:
     * spent > limit
     * maka kelebihan dibawa ke besok.
     *
     * Jika:
     * spent < limit
     * maka tidak ada surplus yang dibawa.
     */
    carry=Math.max(0,spent-limit);

    cursor.setDate(cursor.getDate()+1);
  }

  return Math.max(0,base-carry);
}

function greeting(){
  const h=new Date().getHours();

  return h<5
    ?'Selamat malam'
    :h<11
      ?'Selamat pagi'
      :h<15
        ?'Selamat siang'
        :h<18
          ?'Selamat sore'
          :'Selamat malam';
}

function periodLabel(){
  return `${formatDate(data.periodStart)} – ${formatDate(data.periodEnd)}`;
}

function icon(name,size=20){
  return `<i data-lucide="${name}" style="width:${size}px;height:${size}px"></i>`;
}

function refreshIcons(){
  if(window.lucide)lucide.createIcons();
}

function categoryOptions(){
  return Object.entries(CATEGORIES)
    .map(([name,c])=>`
      <button type="button"
        class="category-option ${selectedCategory===name?'selected':''}"
        data-category="${name}">
        ${icon(c.icon,21)}
        <span>${name}</span>
      </button>
    `)
    .join('');
}

function renderCategories(){
  document.getElementById('categoryGrid').innerHTML=categoryOptions();
  refreshIcons();
}

function renderCategoryFilter(){
  const el=document.getElementById('categoryFilter');
  const old=el.value;

  el.innerHTML=
    '<option value="all">Semua</option>'+
    Object.keys(CATEGORIES)
      .map(c=>`<option value="${escapeAttr(c)}">${escapeHTML(c)}</option>`)
      .join('');

  el.value=Object.keys(CATEGORIES).includes(old)?old:'all';
}

function updateDashboard(){
  const spent=periodSpent();
  const remain=Math.max(0,data.budget-spent);
  const todayValue=todaySpent();
  const limit=calculateDailyLimit();

  document.getElementById('greeting').textContent=greeting();
  document.getElementById('todayLabel').textContent=fullDate(today());

  document.getElementById('remainingMoney').textContent=formatMoney(remain);
  document.getElementById('periodSpent').textContent=formatMoney(spent);
  document.getElementById('periodBudget').textContent=formatMoney(data.budget);
  document.getElementById('periodLabel').textContent=periodLabel();

  document.getElementById('dailyLimit').textContent=formatMoney(limit);
  document.getElementById('todaySpent').textContent=`Terpakai ${formatMoney(todayValue)}`;

  const left=limit-todayValue;

  document.getElementById('todayRemaining').textContent=
    left>=0
      ?`Sisa ${formatMoney(left)}`
      :`Lebih ${formatMoney(Math.abs(left))}`;

  document.getElementById('todayTotal').textContent=formatMoney(todayValue);
  document.getElementById('periodTotal').textContent=formatMoney(spent);

  const pct=limit>0
    ?Math.min(100,(todayValue/limit)*100)
    :0;

  document.getElementById('progressBar').style.width=`${pct}%`;

  const badge=document.getElementById('statusBadge');

  badge.className='status';

  if(todayValue>limit){
    badge.textContent='Melebihi';
    badge.classList.add('danger');
  }else if(todayValue>=limit*.8){
    badge.textContent='Waspada';
    badge.classList.add('warning');
  }else{
    badge.textContent='Aman';
  }

  renderRecent();
  renderHistory();
  renderCategoryFilter();
}

function sortedTransactions(list=data.transactions){
  return [...list].sort((a,b)=>{
    const da=`${b.date} ${b.createdAt||''}`;
    const db=`${a.date} ${a.createdAt||''}`;

    return da.localeCompare(db);
  });
}

function groupTransactions(list){
  const groups={};

  sortedTransactions(list).forEach(t=>{
    (groups[t.date]??=[]).push(t);
  });

  return groups;
}

function transactionHTML(t){
  const c=CATEGORIES[t.category]||CATEGORIES.Lainnya;

  return `
    <button class="transaction" data-detail="${escapeAttr(t.id)}">
      <div class="transaction-icon"
        style="color:${c.color};background:${hexToSoft(c.color)}">
        ${icon(c.icon,20)}
      </div>

      <div class="transaction-info">
        <strong>${escapeHTML(t.category)}</strong>
        <small>
          ${escapeHTML(t.note||'Tanpa catatan')} · ${formatDateTime(t)}
        </small>
      </div>

      <div class="transaction-amount">
        -${formatMoney(t.amount)}
      </div>
    </button>
  `;
}

function formatDateTime(t){
  const d=t.createdAt?new Date(t.createdAt):null;

  return d&&
    !Number.isNaN(d.getTime())&&
    t.date===today()
      ?d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})
      :formatDate(t.date);
}

function renderGroups(
  containerId,
  list,
  emptyText='Belum ada transaksi'
){
  const el=document.getElementById(containerId);
  const groups=groupTransactions(list);
  const keys=Object.keys(groups);

  if(!keys.length){
    el.innerHTML=`
      <div class="empty">
        <div class="empty-icon">${icon('receipt',22)}</div>
        <strong>${emptyText}</strong>
        <p style="margin:6px 0;font-size:11px">
          Catatan pengeluaranmu akan muncul di sini.
        </p>
      </div>
    `;

    refreshIcons();
    return;
  }

  el.innerHTML=keys.map(k=>`
    <div class="transaction-group">
      <div class="group-title">
        <span>
          ${
            k===today()
              ?'Hari ini'
              :k===addDays(today(),-1)
                ?'Kemarin'
                :formatDate(k,true)
          }
        </span>

        <strong>
          ${formatMoney(
            groups[k].reduce((s,t)=>s+t.amount,0)
          )}
        </strong>
      </div>

      ${groups[k].map(transactionHTML).join('')}
    </div>
  `).join('');

  refreshIcons();
}

function renderRecent(){
  renderGroups(
    'recentList',
    sortedTransactions(data.transactions).slice(0,5),
    'Belum ada pengeluaran'
  );
}

function renderHistory(){
  const q=(
    document.getElementById('searchInput')?.value||''
  ).trim().toLowerCase();

  const cat=
    document.getElementById('categoryFilter')?.value||'all';

  const filtered=data.transactions.filter(t=>
    (cat==='all'||t.category===cat)&&
    (!q||`${t.category} ${t.note}`.toLowerCase().includes(q))
  );

  renderGroups(
    'historyList',
    filtered,
    q
      ?'Tidak ada transaksi yang cocok'
      :'Belum ada transaksi'
  );
}

function showView(name){
  document
    .querySelectorAll('.view')
    .forEach(v=>v.classList.remove('active-view'));

  document
    .getElementById(`${name}View`)
    .classList.add('active-view');

  document
    .querySelectorAll('.bottom-nav button[data-nav]')
    .forEach(b=>
      b.classList.toggle(
        'active',
        b.dataset.nav===name
      )
    );

  window.scrollTo({
    top:0,
    behavior:'smooth'
  });

  updateDashboard();
}

function openModal(id){
  const el=document.getElementById(id);

  el.classList.add('show');
  el.setAttribute('aria-hidden','false');
}

function closeModal(id){
  const el=document.getElementById(id);

  el.classList.remove('show');
  el.setAttribute('aria-hidden','true');
}

function openExpense(id=null){
  editingId=id;
  selectedCategory='Makan';

  if(id){
    const t=data.transactions.find(x=>x.id===id);

    if(!t)return;

    selectedCategory=t.category;

    document.getElementById('expenseTitle').textContent='Edit pengeluaran';
    document.getElementById('expenseSubmit').textContent='Simpan perubahan';

    document.getElementById('expenseAmount').value=t.amount;
    document.getElementById('expenseNote').value=t.note;
    document.getElementById('expenseDate').value=t.date;
  }else{
    document.getElementById('expenseTitle').textContent='Tambah pengeluaran';
    document.getElementById('expenseSubmit').textContent='Simpan pengeluaran';

    document.getElementById('expenseAmount').value='';
    document.getElementById('expenseNote').value='';
    document.getElementById('expenseDate').value=today();
  }

  renderCategories();
  openModal('expenseModal');

  setTimeout(()=>{
    document.getElementById('expenseAmount').focus();
  },220);
}

function submitExpense(){
  const amount=Math.round(
    Number(document.getElementById('expenseAmount').value)
  );

  const note=document
    .getElementById('expenseNote')
    .value
    .trim();

  const date=
    document.getElementById('expenseDate').value||today();

  if(!Number.isFinite(amount)||amount<=0){
    toast('Masukkan nominal yang valid.');
    return;
  }

  if(amount>1000000000){
    toast('Nominal terlalu besar.');
    return;
  }

  if(!parseKey(date)){
    toast('Tanggal tidak valid.');
    return;
  }

  if(editingId){
    const t=data.transactions.find(x=>x.id===editingId);

    Object.assign(t,{
      amount,
      category:selectedCategory,
      note,
      date
    });

    toast('Transaksi diperbarui.');
  }else{
    data.transactions.push({
      id:uid(),
      amount,
      category:selectedCategory,
      note,
      date,
      createdAt:new Date().toISOString()
    });

    toast('Pengeluaran disimpan.');
  }

  save();
  closeModal('expenseModal');
  updateDashboard();
  editingId=null;
}

function openDetail(id){
  const t=data.transactions.find(x=>x.id===id);

  if(!t)return;

  detailId=id;

  const c=CATEGORIES[t.category]||CATEGORIES.Lainnya;

  document.getElementById('detailTitle').textContent=t.category;

  document.getElementById('detailBody').innerHTML=`
    <div class="detail-box">

      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">

        <div class="transaction-icon"
          style="color:${c.color};background:${hexToSoft(c.color)}">
          ${icon(c.icon,22)}
        </div>

        <div>
          <strong>${escapeHTML(t.category)}</strong>

          <div style="font-size:11px;color:var(--muted);margin-top:3px">
            ${formatDate(t.date,true)}
          </div>
        </div>

      </div>

      <div class="detail-amount">
        -${formatMoney(t.amount)}
      </div>

      <div class="detail-row">
        <span>Catatan</span>
        <strong>${escapeHTML(t.note||'—')}</strong>
      </div>

      <div class="detail-row">
        <span>Tanggal</span>
        <strong>${formatDate(t.date,true)}</strong>
      </div>

    </div>

    <div class="detail-actions">
      <button class="edit-btn"
        data-detail-edit="${escapeAttr(id)}">
        Edit
      </button>

      <button class="delete-btn"
        data-detail-delete="${escapeAttr(id)}">
        Hapus
      </button>
    </div>
  `;

  refreshIcons();
  openModal('detailModal');
}

function deleteTransaction(id){
  const t=data.transactions.find(x=>x.id===id);

  if(!t)return;

  if(!confirm(`Hapus pengeluaran ${formatMoney(t.amount)}?`))
    return;

  data.transactions=data.transactions.filter(
    x=>x.id!==id
  );

  save();
  closeModal('detailModal');
  toast('Transaksi dihapus.');
  updateDashboard();
}

function saveSettings(){
  const budget=Math.round(
    Number(document.getElementById('budgetAmount').value)
  );

  const start=
    document.getElementById('periodStart').value;

  const end=
    document.getElementById('periodEnd').value;

  if(!Number.isFinite(budget)||budget<=0){
    toast('Masukkan budget yang valid.');
    return;
  }

  if(
    !parseKey(start)||
    !parseKey(end)||
    parseKey(start)>parseKey(end)
  ){
    toast('Tanggal periode tidak valid.');
    return;
  }

  data.budget=budget;
  data.periodStart=start;
  data.periodEnd=end;

  save();

  toast('Budget periode diperbarui.');

  showView('home');
}

function openSettings(){
  document.getElementById('budgetAmount').value=data.budget;
  document.getElementById('periodStart').value=data.periodStart;
  document.getElementById('periodEnd').value=data.periodEnd;

  showView('settings');
}

function resetAll(){
  if(!confirm(
    'Semua transaksi dan pengaturan budget akan dihapus. Lanjutkan?'
  ))return;

  data=initPeriod(cloneDefault());

  save();

  toast('Data DOMPETKU dihapus.');

  showView('home');
}

function escapeHTML(s){
  return String(s??'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

function escapeAttr(s){
  return escapeHTML(s);
}

function hexToSoft(hex){
  const h=hex.replace('#','');
  const n=parseInt(h,16);

  const r=(n>>16)&255;
  const g=(n>>8)&255;
  const b=n&255;

  return `rgba(${r},${g},${b},.11)`;
}

let toastTimer;

function toast(msg){
  const el=document.getElementById('toast');

  el.textContent=msg;
  el.classList.add('show');

  clearTimeout(toastTimer);

  toastTimer=setTimeout(
    ()=>el.classList.remove('show'),
    2200
  );
}

document.addEventListener('click',e=>{

  const action=
    e.target.closest('[data-action]')?.dataset.action;

  if(action==='add')openExpense();
  if(action==='settings')openSettings();
  if(action==='history')showView('history');
  if(action==='save-settings')saveSettings();
  if(action==='submit-expense')submitExpense();
  if(action==='reset')resetAll();

  const nav=
    e.target.closest('[data-nav]')?.dataset.nav;

  if(nav==='home')showView('home');
  if(nav==='history')showView('history');
  if(nav==='settings')openSettings();

  const cat=
    e.target.closest('[data-category]')?.dataset.category;

  if(cat){
    selectedCategory=cat;
    renderCategories();
  }

  const detail=
    e.target.closest('[data-detail]')?.dataset.detail;

  if(detail)openDetail(detail);

  const edit=
    e.target.closest('[data-detail-edit]')?.dataset.detailEdit;

  if(edit){
    closeModal('detailModal');
    openExpense(edit);
  }

  const del=
    e.target.closest('[data-detail-delete]')?.dataset.detailDelete;

  if(del)deleteTransaction(del);

  const close=
    e.target.closest('[data-close]')?.dataset.close;

  if(close)closeModal(close);
});

document
  .querySelectorAll('.modal-backdrop')
  .forEach(m=>
    m.addEventListener('click',e=>{
      if(e.target===m)closeModal(m.id);
    })
  );

document
  .getElementById('searchInput')
  .addEventListener('input',renderHistory);

document
  .getElementById('categoryFilter')
  .addEventListener('change',renderHistory);

if(!data.periodStart||!data.periodEnd)
  initPeriod(data);

renderCategoryFilter();
renderCategories();
updateDashboard();
refreshIcons();

let lastDate=today();

setInterval(()=>{
  if(today()!==lastDate){
    lastDate=today();
    updateDashboard();
  }
},30000);
