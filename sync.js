'use strict';
// Sincronización con tu cuenta personal de Supabase.
// Si no está configurada o la librería no carga, la app funciona igual, solo en este dispositivo.
const Sync=(()=>{
// ▼▼▼ RELLENA ESTAS DOS LÍNEAS (Supabase → Project Settings → API Keys) ▼▼▼
const SUPABASE_URL='https://hzzqybwhbpfumrretgzb.supabase.co/rest/v1/';
const SUPABASE_KEY='sb_publishable_V18Ve049BdYmn-Pr-tYPTg_lRBR8ve0';   // empieza por sb_publishable_
// ▲▲▲ Nunca pongas aquí la clave "secret" ni la "service_role". ▲▲▲
const configured=!SUPABASE_URL.includes('TU-PROYECTO')&&!SUPABASE_KEY.startsWith('TU_');
let sb=null,user=null,api=null,timer=null,running=false,again=false,status='';
const q=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const key=()=>'sync_last_'+user.id;
const getLast=()=>{try{return +localStorage.getItem(key())||0}catch(e){return 0}};
const setLast=m=>{try{localStorage.setItem(key(),m)}catch(e){}};
const setStatus=t=>{status=t;const e=q('#sst');if(e)e.textContent=t};
const hora=()=>new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});

async function run(){
 if(!sb||!user||!api)return;
 if(running){again=true;return}
 running=true;
 try{
  setStatus('Sincronizando…');
  const{data,error}=await sb.from('datos_usuario').select('datos').maybeSingle();
  if(error)throw error;
  const L=api.get(),remote=data&&data.datos,valid=remote&&Array.isArray(remote.vehicles)&&Array.isArray(remote.fills),
   rm=valid&&remote.mod||0,lm=L.mod||0,last=getLast(),has=L.vehicles.length>0||L.fills.length>0;
  let act;
  if(!valid)act=has?'push':'none';
  else if(last>0&&rm==last)act=lm>last?'push':'none';
  else if((last>0&&lm<=last)||(!has&&last==0))act='pull';
  else act=confirm(`Hay datos distintos en la nube (${remote.vehicles.length} vehículos, ${remote.fills.length} repostajes) y en este dispositivo (${L.vehicles.length} vehículos, ${L.fills.length} repostajes).\n\nAceptar = usar los de la nube (sustituye los de este dispositivo).\nCancelar = usar los de este dispositivo (sustituye los de la nube).`)?'pull':'push';
  if(act=='pull'){api.set(remote);await api.persist();setLast(rm);api.redraw()}
  else if(act=='push'){
   if(!L.mod){L.mod=Date.now();await api.persist()}
   const{error:e2}=await sb.from('datos_usuario').upsert({user_id:user.id,datos:L,actualizado_en:new Date().toISOString()});
   if(e2)throw e2;
   setLast(L.mod);
  }
  setStatus('Sincronizado · '+hora());
 }catch(e){
  setStatus(navigator.onLine?'Error de sincronización: '+(e.message||e):'Sin conexión · se sincronizará al volver');
 }finally{running=false;if(again){again=false;changed()}}
}
function changed(){if(!user||!sb)return;clearTimeout(timer);setStatus('Cambios pendientes…');timer=setTimeout(run,1500)}

async function signIn(){
 const e=q('#se').value.trim(),p=q('#sp').value;
 if(!e||!p)return alert('Escribe tu email y tu contraseña.');
 const{error}=await sb.auth.signInWithPassword({email:e,password:p});
 if(error)alert('No se pudo entrar. Revisa el email y la contraseña.\n('+error.message+')');
}
async function signOut(){
 if(!confirm('¿Cerrar sesión? Los datos seguirán guardados en este dispositivo.'))return;
 await sb.auth.signOut();
}

function inner(){
 if(!configured)return'<p class=warn>La sincronización no está configurada todavía (faltan la URL y la clave de Supabase en sync.js).</p>';
 if(!sb)return'<p class=warn>No se pudo cargar el servicio de cuentas (¿sin conexión?). La app sigue funcionando en este dispositivo.</p>';
 if(user)return`<div class=h><b>Sesión iniciada</b><br>${esc(user.email||'')}<br><small class=st id=sst>${esc(status||'')}</small><span><button onclick="Sync.now()">Sincronizar ahora</button><button onclick="Sync.signOut()">Cerrar sesión</button></span></div>`;
 return`<label>Email<input id=se type=email autocomplete=username></label><label>Contraseña<input id=sp type=password autocomplete=current-password></label><button class=pri onclick="Sync.signIn()">Entrar</button><p class=mu>Cuenta personal: tus datos se guardan también en la nube y los ves desde cualquier dispositivo.</p>`;
}
const ui=()=>'<h2>Cuenta y sincronización</h2><div id=acc>'+inner()+'</div>';
const renderAcc=()=>{const e=q('#acc');if(e)e.innerHTML=inner()};

function init(a){
 api=a;
 if(!configured||typeof supabase=='undefined'){renderAcc();return}
 sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true}});
 // Importante: no llamar a Supabase dentro de este callback; se difiere con setTimeout.
 sb.auth.onAuthStateChange((ev,ses)=>{user=ses&&ses.user||null;renderAcc();if(user)setTimeout(run,0)});
 addEventListener('online',()=>run());
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)run()});
 renderAcc();
}
return{init,ui,changed,now:run,signIn,signOut};
})();
