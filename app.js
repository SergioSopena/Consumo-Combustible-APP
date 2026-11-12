'use strict';
const $=s=>document.querySelector(s),uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const nf=(v,d)=>v.toLocaleString('es-ES',{minimumFractionDigits:d,maximumFractionDigits:d,useGrouping:'always'});
const F=(u,d)=>v=>v==null||isNaN(v)?'—':nf(v,d)+u;
const fe=F(' €',2),fp=F(' €/l',3),fc=F(' l/100 km',2),fk=F(' km',0),fl=F(' l',2);
const MODES={road:'Carretera',off:'Monte',mix:'Mixto'},LV=['baja','media','alta'],FUELS=['Diésel','Gasolina 95','Gasolina 98','GLP','Gas natural','Otro'];
const fd=ts=>new Date(ts).toLocaleString('es-ES',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
const loc=ts=>new Date(ts-new Date(ts).getTimezoneOffset()*6e4).toISOString().slice(0,16);
const num=id=>{const x=parseFloat(($(id).value||'').replace(',','.'));return isNaN(x)?null:x};
let S={version:1,vehicles:[],fills:[],active:null},tab='home',sub='v',per='all',cu=[0,0],md='all',edit=null,adding=false;
// ---- Persistencia (un único registro: escritura atómica) ----
const dbp=new Promise((ok,ko)=>{const r=indexedDB.open('consumo',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>ok(r.result);r.onerror=ko});
const load=()=>dbp.then(d=>new Promise(ok=>{const q=d.transaction('kv').objectStore('kv').get('s');q.onsuccess=()=>ok(q.result)}));
const save=keep=>{if(!keep)S.mod=Date.now();return dbp.then(d=>new Promise((ok,ko)=>{const t=d.transaction('kv','readwrite');t.objectStore('kv').put(JSON.parse(JSON.stringify(S)),'s');t.oncomplete=ok;t.onerror=()=>ko(t.error)})).then(()=>{if(!keep&&typeof Sync!='undefined')Sync.changed()})};
const cur=()=>S.vehicles.find(v=>v.id==S.active&&!v.archived)||S.vehicles.find(v=>!v.archived);
const An=v=>Calc.analyze(v,S.fills);
// ---- Indicador de aguja: 0 % = −45°, 100 % = +45°, 0° = horizontal derecha, antihorario positivo ----
const P=(a,r)=>[30+r*Math.cos(a*Math.PI/180),100-r*Math.sin(a*Math.PI/180)];
function gauge(p){let t='';for(const q of[0,25,50,75,100]){const a=q*.9-45,[x1,y1]=P(a,132),[x2,y2]=P(a,146),[x3,y3]=P(a,112);t+=`<line x1=${x1} y1=${y1} x2=${x2} y2=${y2} class=tk /><text x=${x3} y=${y3+4} class=gt>${q}</text>`}
 const[a1,b1]=P(-45,140),[a2,b2]=P(45,140);
 return`<div class=gw><svg class=g viewBox="0 0 200 200" data-v=${p}><path d="M${a1} ${b1}A140 140 0 0 0 ${a2} ${b2}" class=arc />${t}<line class=nd x1=30 y1=100 x2=30 y2=100 /><circle cx=30 cy=100 r=7 class=hub /></svg><div class=gv></div></div>`}
function gSet(s,p){p=Math.max(0,Math.min(100,p));s.dataset.v=p;const[x,y]=P(p*.9-45,124),n=s.querySelector('.nd');n.setAttribute('x2',x);n.setAttribute('y2',y);s.parentElement.querySelector('.gv').textContent=Math.round(p)+' %'}
function gMove(s,e){const b=s.getBoundingClientRect(),k=200/b.width;let a=Math.atan2(100-(e.clientY-b.top)*k,(e.clientX-b.left)*k-30)*180/Math.PI;gSet(s,(Math.max(-45,Math.min(45,a))+45)/90*100)}
document.addEventListener('pointerdown',e=>{const s=e.target.closest('.g');if(s){s.setPointerCapture(e.pointerId);s.dr=1;gMove(s,e)}});
document.addEventListener('pointermove',e=>{const s=e.target.closest&&e.target.closest('.g');if(s&&s.dr)gMove(s,e)});
document.addEventListener('pointerup',e=>{const s=e.target.closest&&e.target.closest('.g');if(s)s.dr=0});
// ---- Gráficas ----
const COL=['#e8a33d','#5aa9e6','#7bc47f','#d96c6c','#b58ee0'];
function chart(ss,f){const pts=ss.flatMap(s=>s.p);if(pts.length<2)return'<p class=mu>Sin datos suficientes.</p>';
 let x0=Math.min(...pts.map(p=>p[0])),x1=Math.max(...pts.map(p=>p[0])),y0=Math.min(...pts.map(p=>p[1])),y1=Math.max(...pts.map(p=>p[1]));if(y0==y1){y0-=1;y1+=1}if(x0==x1)x1+=1;
 const W=340,H=150,X=x=>38+(x-x0)/(x1-x0)*(W-48),Y=y=>H-22-(y-y0)/(y1-y0)*(H-36),d=t=>new Date(t).toLocaleDateString('es-ES',{month:'2-digit',year:'2-digit'});
 return`<svg viewBox="0 0 ${W} ${H}" class=ch><text x=2 y=14 class=ax>${f(y1)}</text><text x=2 y=${H-22} class=ax>${f(y0)}</text><text x=38 y=${H-5} class=ax>${d(x0)}</text><text x=${W-10} y=${H-5} class=ax text-anchor=end>${d(x1)}</text>`+
 ss.map((s,i)=>`<polyline fill=none stroke="${COL[i%5]}" stroke-width=2 points="${s.p.map(p=>X(p[0])+','+Y(p[1])).join(' ')}"/>`+(s.p.length<60?s.p.map(p=>`<circle cx=${X(p[0])} cy=${Y(p[1])} r=2.5 fill="${COL[i%5]}"/>`).join(''):'')).join('')+'</svg>'+
 (ss.length>1?'<p class=lg>'+ss.map((s,i)=>`<span style="color:${COL[i%5]}">● ${s.n}</span>`).join(' ')+'</p>':'')}
// ---- Vistas ----
const sel=(id,opts,v)=>`<select id=${id}>${opts.map(([k,t])=>`<option value="${k}" ${k==v?'selected':''}>${t}</option>`).join('')}</select>`;
const filt=()=>`<div class=row>${sel('per',[['all','Todo el histórico'],['m1','Último mes'],['m3','Últimos 3 meses'],['m6','Últimos 6 meses'],['y1','Último año'],['c','Personalizado']],per)}${sub=='v'&&cur()?.type=='4x4'?sel('md',[['all','General'],...Object.entries(MODES)],md):''}</div>`+(per=='c'?`<div class=row><input type=date id=d0 value="${cu[0]?new Date(cu[0]).toISOString().slice(0,10):''}"><input type=date id=d1 value="${cu[1]?new Date(cu[1]).toISOString().slice(0,10):''}"></div>`:'');
const kpi=(t,v,s='')=>`<div class=k><b>${v}</b><span>${t}</span>${s}</div>`;
function vHome(){const v=cur();if(!v)return vNew(true);const A=An(v),R=A.rows,t=Calc.stats(v,A,'all',cu,'all'),last=R.filter(r=>r.fuel!=null).pop();
 const c=v.type=='car'?(last?last.fuel/last.cd*100:null):t.cons;
 return`<div class=row>${sel('vs',[...S.vehicles.filter(x=>!x.archived).map(x=>[x.id,x.name]),['+','＋ Nuevo vehículo']],v.id)}</div><h1>${v.name}</h1>
 <div class=big>${fc(c)}</div><p class=mu>${v.type=='car'?(last?'Último intervalo cerrado (llenado completo)':'Se calculará al registrar un llenado completo'):'Consumo medio histórico · fiabilidad '+(A.rel?LV[A.rel.all]:'baja (datos insuficientes)')}</p>
 <div class=grid>${kpi('Recorridos',fk(t.km))}${kpi('Precio medio',fp(t.ppl))}</div><button class=pri onclick="go('fill')">Registrar repostaje</button>`}
function vFill(){const v=cur();if(!v)return vNew(true);const e=edit&&S.fills.find(x=>x.id==edit),car=v.type=='car',A=An(v);
 const x=e||{ts:Date.now(),km:'',l:'',ppl:'',total:'',lvl:50,mode:'road',partial:false,skipped:false},s=Calc.stats(v,A,'all',cu,'all');
 return`<h1>${e?'Editar repostaje':'Repostar'} · ${v.name}</h1><label>Fecha y hora<input id=dt type=datetime-local value="${loc(x.ts)}"></label>
 <label>Kilometraje (km)<input id=km inputmode=decimal value="${x.km}"></label><div class=row><label>Litros<input id=l inputmode=decimal oninput="lk('l')" value="${x.l}"></label>
 <label>€/l<input id=pp inputmode=decimal oninput="lk('p')" value="${x.ppl?+x.ppl.toFixed(3):''}"></label><label>Total €<input id=tt inputmode=decimal oninput="lk('t')" value="${x.total?+x.total.toFixed(2):''}"></label></div>
 ${car?`<label>Tipo${sel('tp',[['f','Lleno (100 %)'],['p','Repostaje parcial']],x.partial?'p':'f')}</label><div id=gp style="display:${x.partial?'block':'none'}">${gauge(x.lvl??50)}</div>`:`<label>Modalidad${sel('mo',Object.entries(MODES),x.mode)}</label><p class=mu>Nivel después de repostar</p>${gauge(x.lvl)}`}
 <label class=ck><input id=sk type=checkbox ${x.skipped?'checked':''}> Me he saltado uno o varios repostajes anteriores</label><button class=pri onclick="saveFill()">Guardar</button>${e?'<button onclick="edit=null;go(\'fill\')">Cancelar</button>':''}
 <p class=mu>Consumo medio histórico: <b>${fc(v.type=='car'?A.rows.filter(r=>r.fuel!=null).map(r=>r.fuel/r.cd*100).pop():s.cons)}</b>${car?'':' · Fiabilidad '+(A.rel?LV[A.rel.all]:'baja')}</p>`}
function vStats(){const v=cur(),tabs=`<div class=seg>${[['v','Vehículo'],['g','Global'],['f','Combustibles']].map(([k,t])=>`<button class="${sub==k?'on':''}" onclick="sub='${k}';draw()">${t}</button>`).join('')}</div>`+filt();
 const rg=Calc.rng(per,cu);if(sub!='v')return tabs+vGlobal(rg);if(!v)return tabs+'<p class=mu>Añade un vehículo.</p>';
 const A=An(v),s=Calc.stats(v,A,per,cu,md),R=s.rows,ok=R.filter(r=>r.fuel!=null&&!r.out),m=s.mes,a=s.anio,ser=f=>[{p:R.map(r=>[r.f.ts,f(r)])}];
 const k=(t,x,y)=>kpi(t,x,y?`<small>${y}</small>`:'');
 let h=tabs+`<h2>Del periodo seleccionado</h2><div class=grid>${k('Km recorridos',fk(s.km))}${k('Litros repostados',fl(s.l))}${k('Gasto total',fe(s.eur))}${k('Precio medio (ponderado)',fp(s.ppl))}${k('Consumo medio',fc(s.cons))}</div>
 <h2>Medias estimadas <small>(extrapoladas con la duración real del periodo: ${nf(s.days,0)} días)</small></h2><div class=grid>${k('Km/mes',fk(m?.km))}${k('Km/año',fk(a?.km))}${k('Litros/mes',fl(m?.l))}${k('Litros/año',fl(a?.l))}${k('Gasto/mes',fe(m?.eur))}${k('Gasto/año',fe(a?.eur))}</div>`;
 if(v.type=='4x4'){const f=A.fit,r=A.rel;h+=`<h2>Fiabilidad por modalidad</h2><div class=grid>${['all','road','off','mix'].map(q=>kpi(q=='all'?'General':MODES[q],r?'Fiabilidad '+LV[r[q]]:'—',r?`<small>${r[q+'n']} intervalos · ${nf(r[q+'km'],0)} km${q!='all'&&f.R[q]?' · '+fc(f.R[q]):''}</small>`:'')).join('')}</div>
 <details><summary>Estimación del depósito</summary><p>${f.ok?`Capacidad estimada: <b>${fl(f.C)}</b><br>Registros usados: ${f.n-f.out.filter(Boolean).length} de ${f.n}`:f.msg}</p></details>`}
 return h+`<h2>Evolución del consumo (l/100 km)</h2>${chart([{p:ok.map(r=>[r.f.ts,r.fuel/r.cd*100])}],F('',1))}<h2>Gasto (€)</h2>${chart(ser(r=>r.f.total),fe)}<h2>Precio (€/l)</h2>${chart(ser(r=>r.f.ppl),fp)}<h2>Km entre repostajes</h2>${chart(ser(r=>r.dk),fk)}<h2>Litros</h2>${chart(ser(r=>r.f.l),fl)}`}
function vGlobal(rg){const f=S.fills.filter(x=>x.ts>=rg[0]&&x.ts<=rg[1]),fu=x=>S.vehicles.find(v=>v.id==x.vid)?.fuel||'—',g={};
 f.forEach(x=>{(g[fu(x)]??=[]).push(x)});const S_=a=>Calc.sum(a,x=>x.l),E=a=>Calc.sum(a,x=>x.total);
 if(sub=='f')return`<table>${Object.entries(g).map(([k,a])=>`<tr><td>${k}</td><td>${fl(S_(a))}</td><td>${fe(E(a))}</td><td>${fp(E(a)/S_(a))}</td></tr>`).join('')||'<tr><td>Sin datos</td></tr>'}</table>`+chart(Object.entries(g).map(([k,a])=>({n:k,p:a.sort((x,y)=>x.ts-y.ts).map(x=>[x.ts,x.ppl])})),fp);
 const km=Calc.sum(S.vehicles,v=>Calc.stats(v,An(v),per,cu,'all').km);
 return`<div class=grid>${kpi('Km totales',fk(km))}${kpi('Litros totales',fl(S_(f)))}${kpi('Gasto total',fe(E(f)))}</div><h2>Gasto por vehículo</h2><table>${S.vehicles.map(v=>`<tr><td>${v.name}</td><td>${fe(E(f.filter(x=>x.vid==v.id)))}</td></tr>`).join('')}</table><h2>Gasto por combustible</h2><table>${Object.entries(g).map(([k,a])=>`<tr><td>${k}</td><td>${fe(E(a))}</td></tr>`).join('')}</table>`}
function vNew(first){return`<h1>${first?'Crea tu primer vehículo':'Nuevo vehículo'}</h1><label>Nombre<input id=nn></label><label>Tipo${sel('nt',[['4x4','Todoterreno'],['car','Turismo']],'4x4')}</label><label>Combustible${sel('nf',FUELS.map(x=>[x,x]),'Diésel')}</label>
 <label>Fecha de incorporación<input id=nd type=date value="${new Date().toISOString().slice(0,10)}"></label><label>Kilometraje inicial<input id=nk inputmode=decimal></label><div id=ng><p class=mu>Nivel inicial del depósito</p>${gauge(50)}</div><button class=pri onclick="addV()">Crear vehículo</button>${first&&typeof Sync!='undefined'?Sync.ui():''}`}
function vManage(){const v=cur(),A=v&&An(v);if(adding||!S.vehicles.length)return vNew(!S.vehicles.length);
 const hist=v?[...A.rows].reverse().map(r=>{const x=r.f;return`<div class=h><b>${fd(x.ts)}</b> · ${fk(x.km)} (+${nf(r.dk,0)})<br>${fl(x.l)} · ${fp(x.ppl)} · ${fe(x.total)}${v.type=='4x4'?' · '+MODES[x.mode]+' · '+nf(x.lvl,0)+' %':(x.partial?' · parcial '+nf(x.lvl,0)+' %':' · lleno')}<br><small class=st>${r.state=='valido'?(r.out?'atípico (excluido)':'válido'):r.state}${r.est?' · estimado '+fc(r.est):''}</small>
 <span><button onclick="edit='${x.id}';go('fill')">Editar</button><button onclick="delF('${x.id}')">Borrar</button></span></div>`}).join(''):'';
 return`<button onclick="adding=true;draw()">＋ Añadir vehículo</button>${typeof Sync!='undefined'?Sync.ui():''}<h2>Vehículos</h2>${S.vehicles.map(x=>`<div class=h><b>${x.name}</b> · ${x.type=='car'?'Turismo':'Todoterreno'} · ${x.fuel}<br><small>Desde ${x.date} · ${fk(x.km0)}${x.type=='4x4'?' · nivel inicial '+nf(x.lvl0,0)+' %':''}${x.archived?' · archivado':''}</small>
 <span><button onclick="renV('${x.id}')">Editar</button><button onclick="arch('${x.id}')">${x.archived?'Reactivar':'Archivar'}</button><button onclick="delV('${x.id}')">Eliminar</button></span></div>`).join('')}
 <h2>Historial${v?' · '+v.name:''}</h2>${hist||'<p class=mu>Sin repostajes.</p>'}<h2>Copia de seguridad</h2><div class=row><button onclick="exp()">Exportar copia de seguridad</button><button onclick="$('#imp').click()">Importar copia de seguridad</button></div><input id=imp type=file accept=".json,application/json" hidden onchange="imp(this.files[0])">
 <p class=warn>Los datos se guardan en este dispositivo y, si inicias sesión, también en la nube. Exporta una copia de vez en cuando y guárdala fuera de GitHub.</p>`}
// ---- Acciones ----
const toast=t=>{const e=$('#ts');e.textContent=t;e.style.opacity=1;setTimeout(()=>e.style.opacity=0,2200)};
const V={home:vHome,fill:vFill,stats:vStats,man:vManage};
function draw(){$('#m').innerHTML=V[tab]();document.querySelectorAll('.g').forEach(s=>gSet(s,+s.dataset.v));
 document.querySelectorAll('#n button').forEach(b=>b.classList.toggle('on',b.dataset.t==tab));
 const q=(i,f)=>$(i)&&($(i).onchange=f);q('#per',e=>{per=e.target.value;draw()});q('#md',e=>{md=e.target.value;draw()});
 q('#d0',()=>{cu[0]=Date.parse($('#d0').value)||0;draw()});q('#d1',()=>{cu[1]=Date.parse($('#d1').value)+864e5-1||0;draw()});
 q('#vs',e=>{if(e.target.value=='+'){adding=true;tab='man'}else S.active=e.target.value;draw();save()});
 q('#tp',e=>$('#gp').style.display=e.target.value=='p'?'block':'none');q('#nt',e=>$('#ng').style.display=e.target.value=='car'?'none':'block')}
function go(t){tab=t;if(t!='fill')edit=null;adding=false;draw();scrollTo(0,0)}
function lk(s){const l=num('#l');if(s=='t'&&l>0&&num('#tt')!=null)$('#pp').value=+(num('#tt')/l).toFixed(4);else if(l>0&&num('#pp')!=null)$('#tt').value=+(l*num('#pp')).toFixed(2)}
async function addV(){const n=$('#nn').value.trim(),k=num('#nk'),car=$('#nt').value=='car';
 if(!n)return alert('Escribe un nombre para el vehículo.');if(k==null||k<0)return alert('Introduce un kilometraje inicial válido (0 o más).');
 const v={id:uid(),name:n,type:$('#nt').value,fuel:$('#nf').value,date:$('#nd').value||new Date().toISOString().slice(0,10),km0:k,lvl0:car?100:+$('.g').dataset.v};
 S.vehicles.push(v);S.active=v.id;adding=false;await save();go('home')}
async function saveFill(){const v=cur(),car=v.type=='car',ts=Date.parse($('#dt').value),km=num('#km'),l=num('#l');let pp=num('#pp'),tt=num('#tt');
 if(isNaN(ts))return alert('La fecha no es válida.');if(ts>Date.now()+36e5&&!confirm('La fecha es futura. ¿Continuar?'))return;
 if(km==null||km<0)return alert('Introduce un kilometraje válido.');if(!(l>0))return alert('Los litros deben ser mayores que 0.');
 if(!(pp>0)&&!(tt>0))return alert('Introduce el precio por litro o el importe total.');if(pp>0&&tt==null||pp>0&&!(tt>0))tt=l*pp;else pp=tt/l;
 const o=S.fills.filter(x=>x.vid==v.id&&x.id!=edit),pv=o.filter(x=>x.ts<ts).sort((a,b)=>b.ts-a.ts)[0],nx=o.filter(x=>x.ts>ts).sort((a,b)=>a.ts-b.ts)[0];
 if(km<(pv?pv.km:v.km0))return alert(`El kilometraje no puede ser inferior al registro anterior (${nf(pv?pv.km:v.km0,0)} km).`);
 if(nx&&km>nx.km)return alert(`El kilometraje supera el del registro posterior (${nf(nx.km,0)} km).`);
 if(o.some(x=>x.km==km&&x.l==l&&Math.abs(x.ts-ts)<36e5)&&!confirm('Parece un registro duplicado. ¿Guardarlo igualmente?'))return;
 const partial=car&&$('#tp').value=='p',x={id:edit||uid(),vid:v.id,ts,km,l,ppl:pp,total:tt,lvl:car?(partial?+$('.g').dataset.v:100):+$('.g').dataset.v,mode:car?null:$('#mo').value,partial,skipped:$('#sk').checked};
 S.fills=S.fills.filter(y=>y.id!=x.id);S.fills.push(x);S.active=v.id;
 const r=An(v).rows.find(r=>r.f.id==x.id);
 if(r&&r.susp&&!x.skipped&&confirm('Es posible que hayas omitido uno o varios repostajes. ¿Quieres marcar este intervalo como omitido?'))x.skipped=true;
 await save();edit=null;toast('Repostaje guardado');go('home')}
async function delF(id){if(confirm('¿Eliminar este repostaje? Se recalcularán las estadísticas.')){S.fills=S.fills.filter(x=>x.id!=id);await save();draw()}}
async function renV(id){const v=S.vehicles.find(x=>x.id==id),n=prompt('Nombre del vehículo',v.name);if(n&&n.trim())v.name=n.trim();
 const f=prompt('Combustible ('+FUELS.join(', ')+'). Se aplicará a todo el histórico.',v.fuel);if(f&&f.trim())v.fuel=f.trim();await save();draw()}
async function arch(id){const v=S.vehicles.find(x=>x.id==id);v.archived=!v.archived;await save();draw()}
async function delV(id){if(confirm('¿Eliminar el vehículo y TODOS sus registros? No se puede deshacer.')){S.vehicles=S.vehicles.filter(x=>x.id!=id);S.fills=S.fills.filter(x=>x.vid!=id);await save();draw()}}
function exp(){const b=new Blob([JSON.stringify({app:'consumo-combustible',version:1,exported:new Date().toISOString(),data:S},null,1)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='consumo-combustible-'+new Date().toISOString().slice(0,10)+'.json';a.click()}
async function imp(file){if(!file)return;const old=S;try{const j=JSON.parse(await file.text()),d=j.data;
 if(j.app!='consumo-combustible'||j.version>1||!Array.isArray(d?.vehicles)||!Array.isArray(d?.fills))throw'Archivo no válido o de una versión no compatible.';
 const ids=new Set(d.vehicles.map(v=>v.id));if(d.vehicles.some(v=>!v.id||!v.name||!['4x4','car'].includes(v.type)||typeof v.km0!='number')||d.fills.some(x=>!ids.has(x.vid)||[x.ts,x.km,x.l].some(n=>typeof n!='number')))throw'La estructura de la copia es incorrecta.';
 if(!confirm(`La copia contiene ${d.vehicles.length} vehículos y ${d.fills.length} repostajes.\nSe BORRARÁN todos los datos actuales y se sustituirán por estos.\n¿Continuar?`))return;
 S=d;await save();tab='home';draw();toast('Copia importada')}catch(e){S=old;alert(typeof e=='string'?e:'No se pudo importar: '+e.message)}$('#imp')&&($('#imp').value='')}
(async()=>{const d=await load();if(d)S=d;const l=[...S.fills].sort((a,b)=>b.ts-a.ts).find(x=>S.vehicles.some(v=>v.id==x.vid&&!v.archived));if(l)S.active=l.vid;
 document.querySelectorAll('#n button').forEach(b=>b.onclick=()=>go(b.dataset.t));draw();if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{});if(typeof Sync!='undefined')Sync.init({get:()=>S,set:d=>{S=d},persist:()=>save(true),redraw:()=>{if(tab!='fill')draw()}});if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js')})();
