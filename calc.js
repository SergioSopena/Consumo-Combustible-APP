'use strict';
// Capa de cálculo: única fuente de verdad para todas las pantallas.
const Calc=(()=>{
const MS=864e5,sum=(a,f)=>a.reduce((s,x)=>s+f(x),0);
const med=a=>{const s=[...a].sort((x,y)=>x-y),n=s.length;return n?(n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2):0};
function solve(A,b){const n=b.length;for(let i=0;i<n;i++){let p=i;for(let r=i+1;r<n;r++)if(Math.abs(A[r][i])>Math.abs(A[p][i]))p=r;if(Math.abs(A[p][i])<1e-9)return null;[A[i],A[p]]=[A[p],A[i]];[b[i],b[p]]=[b[p],b[i]];for(let r=i+1;r<n;r++){const k=A[r][i]/A[i][i];for(let c=i;c<n;c++)A[r][c]-=k*A[i][c];b[r]-=k*b[i]}}const x=[];for(let i=n-1;i>=0;i--){let s=b[i];for(let c=i+1;c<n;c++)s-=A[i][c]*x[c];x[i]=s/A[i][i]}return x}
function wls(X,y,w){const p=X[0].length,A=Array.from({length:p},()=>Array(p).fill(0)),b=Array(p).fill(0);X.forEach((x,i)=>{for(let r=0;r<p;r++){b[r]+=w[i]*x[r]*y[i];for(let c=0;c<p;c++)A[r][c]+=w[i]*x[r]*x[c]}});return solve(A,b)}
// Modelo: L = C·(F−Fprev) + Σ R_m·D/100  → incógnitas C y R_m. Huber IRLS.
function fit(sm){
 const ms=[...new Set(sm.map(s=>s.m))],n=sm.length;
 const bad=msg=>({ok:false,n,msg});
 if(n<ms.length+3)return bad('Faltan datos para estimar el depósito y los consumos.');
 const dfs=sm.map(s=>s.dF);
 if(Math.max(...dfs)-Math.min(...dfs)<.1)return bad('Aún no hay suficiente variación de niveles para separar capacidad y consumo.');
 const X=sm.map(s=>[s.dF,...ms.map(m=>s.m==m?s.d/100:0)]),y=sm.map(s=>s.L);
 let w=sm.map(()=>1),b,res,sc;
 for(let k=0;k<12;k++){b=wls(X,y,w);if(!b)return bad('Datos no identificables todavía (modalidades o niveles colineales).');
  res=X.map((x,i)=>y[i]-x.reduce((a,v,j)=>a+v*b[j],0));sc=Math.max(1.4826*med(res.map(Math.abs)),.4);
  w=res.map(e=>{const a=Math.abs(e)/(1.345*sc);return a<=1?1:1/a})}
 if(!(b[0]>3&&b[0]<300)||b.slice(1).some(v=>!(v>1&&v<60)))return bad('Las estimaciones no son físicamente coherentes; revisa registros o añade más.');
 const R={};ms.forEach((m,i)=>R[m]=b[i+1]);
 return{ok:true,n,C:b[0],R,out:res.map(e=>Math.abs(e)>3*sc),sc,spread:Math.max(...dfs)-Math.min(...dfs)};
}
const lv=(n,km)=>n>=8&&km>=800?2:n>=4&&km>=300?1:0;
function analyze(v,fills){
 const f=fills.filter(x=>x.vid==v.id).sort((a,b)=>a.ts-b.ts),car=v.type=='car',rows=[],sm=[];
 let pk=v.km0,pf=car?1:v.lvl0/100,ok=true,acc=0,rk=v.km0;
 for(const x of f){
  const dk=x.km-pk,F=car?(x.partial?(x.lvl??50)/100:1):x.lvl/100,r={f:x,dk,m:car?null:x.mode,state:'valido',fuel:null,cd:null,est:null,out:false,susp:false};
  if(car){acc+=x.l;
   if(x.skipped){r.state='omitido';if(x.partial){ok=false;acc=0}else{ok=true;acc=0;rk=x.km}}
   else if(x.partial)r.state='parcial';
   else{if(ok&&x.km>rk){r.fuel=acc;r.cd=x.km-rk}else r.state='estimado';ok=true;acc=0;rk=x.km}
  }else if(x.skipped)r.state='omitido';
  else if(dk>0)sm.push({r,L:x.l,dF:F-pf,d:dk,m:x.mode});
  rows.push(r);pk=x.km;pf=F;
 }
 const A={rows,car,fit:null,rel:null};
 if(car){
  const cs=rows.filter(r=>r.fuel!=null).map(r=>r.fuel/r.cd*100);
  rows.forEach(r=>{if(r.fuel!=null&&cs.length>2){const c=r.fuel/r.cd*100,m=med(cs);r.susp=c<.5*m||c>1.8*m}});
  const a=agg(rows);rows.forEach(r=>{if(r.state=='omitido'||r.state=='estimado')r.est=a});
  return A;
 }
 const ft=A.fit=fit(sm);
 if(ft.ok){
  sm.forEach((s,i)=>{s.r.fuel=s.L-ft.C*s.dF;s.r.cd=s.d;s.r.out=s.r.susp=ft.out[i]});
  const rel={},meanL=sum(sm,s=>s.L)/sm.length,sp=ft.sc/meanL>.25?1:0,stat=m=>{const q=sm.filter((s,i)=>!ft.out[i]&&(m=='all'||s.m==m));return[q.length,sum(q,s=>s.d)]};
  for(const m of['all','road','off','mix']){const[n,km]=stat(m);rel[m]=Math.max(0,lv(n,km)-sp-(m=='all'&&ft.spread<.25?1:0));rel[m+'n']=n;rel[m+'km']=km}
  A.rel=rel;
  rows.forEach(r=>{if(r.state=='omitido')r.est=ft.R[r.m]??null});
 }
 return A;
}
function agg(rows){let fu=0,cd=0;rows.forEach(r=>{if(r.fuel!=null&&!r.out){fu+=r.fuel;cd+=r.cd}});return cd?fu/cd*100:null}
function rng(p,cu){const n=Date.now(),m={m1:1,m3:3,m6:6,y1:12}[p];
 if(m){const d=new Date(n);d.setMonth(d.getMonth()-m);return[d.getTime(),n]}
 if(p=='c')return[cu[0],cu[1]];return[-Infinity,n]}
function stats(v,A,p,cu,mode){
 const[t0,t1]=rng(p,cu),car=v.type=='car';
 const rows=A.rows.filter(r=>r.f.ts>=t0&&r.f.ts<=t1&&(car||mode=='all'||r.m==mode));
 const l=sum(rows,r=>r.f.l),eur=sum(rows,r=>r.f.total),km=sum(rows,r=>r.dk);
 const days=(t1-(isFinite(t0)?t0:Date.parse(v.date)))/MS,mo=days/30.4375,yr=days/365.25,ok=days>=1;
 return{rows,l,eur,km,ppl:l?eur/l:null,cons:agg(rows),days,
  mes:ok?{km:km/mo,l:l/mo,eur:eur/mo}:null,anio:ok?{km:km/yr,l:l/yr,eur:eur/yr}:null};
}
return{analyze,agg,stats,rng,fit,med,sum,MS};
})();
if(typeof module!='undefined')module.exports=Calc;
