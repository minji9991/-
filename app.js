import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.58.0/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase-config.js";
const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const state={studentId:"",sessionId:null,currentActivity:0,openActivities:new Set(),experimentsDone:new Set(),heartbeat:null,controls:null,intro1Done:false,intro3Done:false};
const norm=v=>String(v??"").toLowerCase().replace(/\s+/g,"").replaceAll("×","*").replaceAll("°","");
function fb(id,t,ok=false){const e=$("#"+id);e.textContent=t;e.className="feedback "+(ok?"ok":"bad")}
async function rpc(n,a={}){const{data,error}=await supabase.rpc(n,a);if(error)throw error;return data}
async function event(type,payload={}){if(state.sessionId)try{await rpc("poly_student_event",{p_session_id:state.sessionId,p_event_type:type,p_payload:payload})}catch(e){}}
async function answer(k,a,f=false){if(!state.sessionId)return;$("#saveBadge").textContent="저장 중";try{await rpc("poly_student_answer",{p_session_id:state.sessionId,p_activity_key:k,p_answer:a,p_is_final:f});$("#saveBadge").textContent="저장됨";$("#saveBadge").className="pill"}catch(e){$("#saveBadge").textContent="저장 실패";$("#saveBadge").className="pill warn";console.error(e)}}
async function start(){const id=$("#studentId").value.trim();if(!/^[0-9A-Za-z_-]{2,12}$/.test(id)){fb("loginMsg","학번을 다시 확인해 주세요.");return}$("#startBtn").disabled=true;fb("loginMsg","접속 중...",true);try{const sid=await rpc("poly_student_start",{p_student_id:id,p_user_agent:navigator.userAgent});state.studentId=id;state.sessionId=sid;$("#studentBadge").textContent="학번 "+id;$("#studentBadge").className="pill";$("#connectionBadge").textContent="접속 중";$("#connectionBadge").className="pill";$("#loginModal").classList.remove("show");await fetchControls();beginPoll();await event("joined",{path:location.pathname})}catch(e){fb("loginMsg","접속 저장 실패: "+(e.message||e));$("#startBtn").disabled=false}}
$("#startBtn").onclick=start;$("#studentId").addEventListener("keydown",e=>{if(e.key==="Enter")start()});
function checkIntro(kind){
  const isInterior=kind==="interior", input=$(isInterior?"#introInterior":"#introExterior"), msgId=isInterior?"introInteriorMsg":"introExteriorMsg";
  const expected=isInterior?"내각":"외각", ok=norm(input.value)===expected;
  fb(msgId,ok?`맞아요. 이번에는 다각형의 ${expected}의 크기의 합을 탐구합니다.`:`00에 들어갈 말을 다시 생각해 보세요.`,ok);
  if(ok){
    if(isInterior) state.intro1Done=true; else state.intro3Done=true;
    answer(isInterior?"intro_interior":"intro_exterior",{value:expected});
    applyAccessState();
    const target=$(`.activity[data-activity="${isInterior?1:3}"]`);
    setTimeout(()=>target?.scrollIntoView({behavior:"smooth",block:"start"}),250);
  }
}
$("#introInteriorBtn").onclick=()=>checkIntro("interior");
$("#introExteriorBtn").onclick=()=>checkIntro("exterior");
$("#introInterior").addEventListener("keydown",e=>{if(e.key==="Enter")checkIntro("interior")});
$("#introExterior").addEventListener("keydown",e=>{if(e.key==="Enter")checkIntro("exterior")});

async function ping(){if(!state.sessionId)return;try{await rpc("poly_student_ping",{p_session_id:state.sessionId,p_visibility:document.hidden?"hidden":"visible",p_current_activity:state.currentActivity});$("#connectionBadge").textContent=document.hidden?"페이지 이탈":"접속 중";$("#connectionBadge").className=document.hidden?"pill warn":"pill"}catch(e){$("#connectionBadge").textContent="연결 실패";$("#connectionBadge").className="pill warn"}}
function applyAccessState(){
  $$(".concept-gate").forEach(g=>{const no=+g.dataset.gateFor;g.classList.toggle("teacher-open",state.openActivities.has(no));});
  $$(".activity").forEach(s=>{
    const no=+s.dataset.activity;
    const teacherOpen=state.openActivities.has(no);
    const prereqOk=no===1?state.intro1Done:(no===3?state.intro3Done:true);
    s.classList.toggle("open",teacherOpen&&prereqOk);
    s.classList.toggle("prereq-wait",teacherOpen&&!prereqOk&&(no===1||no===3));
    const cover=$(".lock-cover",s);
    if(cover){
      if(!teacherOpen) cover.textContent=`🔒 교사가 활동 ${no}을 열면 시작할 수 있습니다.`;
      else if(!prereqOk&&no===1) cover.textContent="🔒 위에서 ‘내각’을 정확히 입력하면 활동 1을 시작할 수 있습니다.";
      else if(!prereqOk&&no===3) cover.textContent="🔒 위에서 ‘외각’을 정확히 입력하면 활동 3을 시작할 수 있습니다.";
    }
  });
}
async function fetchControls(){try{const{data,error}=await supabase.from("poly_lesson_control").select("activity_no,is_open").order("activity_no");if(error)throw error;state.openActivities=new Set((data||[]).filter(x=>x.is_open).map(x=>+x.activity_no));applyAccessState()}catch(e){$("#connectionBadge").textContent="활동 상태 연결 실패";$("#connectionBadge").className="pill warn";console.error(e)}}
function beginPoll(){clearInterval(state.heartbeat);clearInterval(state.controls);ping();state.heartbeat=setInterval(ping,15000);state.controls=setInterval(fetchControls,3000)}
document.addEventListener("visibilitychange",async()=>{if(!state.sessionId)return;try{await rpc("poly_student_visibility",{p_session_id:state.sessionId,p_visibility:document.hidden?"hidden":"visible"})}catch(e){}await ping()});
const points=(n,cx=150,cy=135,r=92,rot=-Math.PI/2)=>Array.from({length:n},(_,i)=>({x:cx+r*Math.cos(rot+i*2*Math.PI/n),y:cy+r*Math.sin(rot+i*2*Math.PI/n)}));
const line=(a,b,c)=>`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${c}"/>`;
function card(n){const names={4:"사각형",5:"오각형",6:"육각형"},c=document.createElement("div");c.className="poly-card";c.innerHTML=`<h3>${names[n]}</h3><p>① 기준 꼭짓점 선택 ② 대각선의 다른 끝점을 클릭</p><svg class="poly-svg" viewBox="0 0 300 270"></svg><div class="poly-done"></div>`;const svg=$("svg",c),st=$(".poly-done",c),p=points(n),L="ABCDEFG";let base=null,ds=new Set();function render(){let h="";for(let i=0;i<n;i++)h+=line(p[i],p[(i+1)%n],"poly-edge");if(base!==null)for(const j of ds)h+=line(p[base],p[j],"diag");p.forEach((q,i)=>h+=`<circle class="vertex ${base===i?"selected":""}" data-i="${i}" cx="${q.x}" cy="${q.y}" r="10"></circle><text class="vertex-label" x="${q.x+12}" y="${q.y-10}">${L[i]}</text>`);svg.innerHTML=h;$$(".vertex",svg).forEach(v=>v.onclick=()=>click(+v.dataset.i))}function click(i){if(base===null){base=i;ds.clear();st.textContent="기준 꼭짓점 "+L[i]+" 선택";render();return}if(i===base)return;const a=(base-1+n)%n,b=(base+1)%n;if(i===a||i===b){st.textContent="이웃한 꼭짓점을 이으면 변입니다.";return}ds.add(i);render();const need=n-3;st.textContent=ds.size===need?`완료! ${n-2}개의 삼각형이 만들어집니다.`:`대각선 ${ds.size}/${need}개`;if(ds.size===need)event("a1_polygon_done",{n,base})}render();return c}[4,5,6].forEach(n=>$("#polygonExplore").appendChild(card(n)));
document.addEventListener("click",async e=>{const k=e.target?.dataset?.check;if(!k)return;
if(k==="triangle-sum"){const ok=norm($("#triangleSum").value)==="180";fb("triangleSumMsg",ok?"맞아요. 삼각형의 내각의 합은 180°입니다.":"다시 생각해 보세요.",ok);if(ok)answer("a1_triangle_sum",{value:180})}
if(k==="table1"){const ex={4:["2","360"],5:["3","540"],6:["4","720"]};let ok=true,a={};[4,5,6].forEach(n=>{const t=$(`.tri-count[data-n="${n}"]`).value,s=norm($(`.sum-input[data-n="${n}"]`).value);a[n]={t,s};if(t!==ex[n][0]||s!==ex[n][1])ok=false});fb("table1Msg",ok?"표를 정확히 완성했습니다.":"삼각형 수와 내각의 합을 다시 확인하세요.",ok);if(ok)answer("a1_table",a)}
if(k==="n-triangles"){const ok=norm($("#nTriangleCount").value)==="n-2";fb("nTriangleMsg",ok?"맞아요. n-2개의 삼각형으로 나뉩니다.":"2, 3, 4의 규칙을 식으로 나타내 보세요.",ok);if(ok)answer("a1_n_triangles",{value:"n-2"})}
if(k==="n-interior"){const v=norm($("#nInteriorSum").value).replaceAll("*",""),ok=v==="180(n-2)";fb("nInteriorMsg",ok?"n각형의 내각의 합은 180°×(n-2)입니다.":"180°와 n-2를 이용해 보세요.",ok);if(ok)answer("a1_n_interior",{value:"180(n-2)"})}
if(k==="interior-x"){const ok=norm($("#interiorX").value)==="70";fb("interiorXMsg",ok?"정답입니다. x=70°입니다.":"오각형의 내각의 합은 540°입니다.",ok);if(ok)answer("a2_interior_x",{value:70})}
if(k==="exterior-360"){const ok=norm($("#exterior360").value)==="360";fb("exterior360Msg",ok?"맞아요. 외각의 합은 360°입니다.":"모아진 외각 조각을 살펴보세요.",ok);if(ok)answer("a3_exterior_sum",{value:360})}
if(k==="reason-interior"){const ok=norm($("#reasonInterior").value).replaceAll("*","")==="180(n-2)";fb("reasonInteriorMsg",ok?"내각의 합을 정확히 나타냈습니다. 이제 주황색 외각을 모두 클릭하세요.":"활동 1의 식을 떠올려 보세요.",ok);if(ok){reasonInteriorConfirmed=true;$("#reasonClickMsg").textContent="이제 주황색 외각 조각을 모두 클릭하세요.";$("#reasonClickMsg").className="feedback ok";}}
if(k==="derive"){const ok=$$("#deriveCard .drop-zone").every(z=>z.dataset.value===z.dataset.answer);fb("deriveMsg",ok?"외각의 합은 360°입니다.":"빈칸을 다시 확인하세요.",ok);if(ok)answer("a4_derivation",{completed:true})}
if(k==="exterior-x"){const ok=norm($("#exteriorX").value)==="110";fb("exteriorXMsg",ok?"정답입니다. x=110°입니다.":"왼쪽 아래 외각은 90°입니다.",ok);if(ok)answer("a5_exterior_x",{value:110})}
if(k==="regular"){const ok=$$("#regularBox .drop-zone").every(z=>z.dataset.value===z.dataset.answer);fb("regularMsg",ok?"정확히 정리했습니다.":"조각을 다시 확인하세요.",ok);if(ok)answer("a6_regular",{completed:true})}
if(k==="heptagon"){
  const a=parseDegreeValue($("#heptInterior").value),b=parseDegreeValue($("#heptExterior").value);
  const ok=Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-900/7)<0.03&&Math.abs(b-360/7)<0.03;
  fb("heptagonMsg",ok?"정답입니다. 한 내각은 900/7°(약 128.57°), 한 외각은 360/7°(약 51.43°)입니다.":"정칠각형은 n=7입니다. 한 내각과 한 외각 공식을 각각 적용해 보세요.",ok);
  if(ok)answer("a6_heptagon",{interior:"900/7",exterior:"360/7"});
}});
function extAngles(p){const r=[];for(let i=0;i<p.length;i++){const a=p[(i-1+p.length)%p.length],b=p[i],c=p[(i+1)%p.length],u={x:b.x-a.x,y:b.y-a.y},v={x:c.x-b.x,y:c.y-b.y};let t=Math.atan2(u.x*v.y-u.y*v.x,u.x*v.x+u.y*v.y)*180/Math.PI;if(t<0)t+=360;if(t>180)t=360-t;r.push(t)}const s=r.reduce((a,b)=>a+b,0);return r.map(x=>x*360/s)}
function wedge(cx,cy,r,a0,a1){const p0={x:cx+r*Math.cos(a0),y:cy+r*Math.sin(a0)},p1={x:cx+r*Math.cos(a1),y:cy+r*Math.sin(a1)};let d=a1-a0;while(d<0)d+=Math.PI*2;while(d>=Math.PI*2)d-=Math.PI*2;return`M ${cx} ${cy} L ${p0.x} ${p0.y} A ${r} ${r} 0 ${d>Math.PI?1:0} 1 ${p1.x} ${p1.y} Z`}
function smallWedge(cx,cy,r,a,b){let d=b-a;while(d<0)d+=Math.PI*2;while(d>=Math.PI*2)d-=Math.PI*2;if(d<=Math.PI)return wedge(cx,cy,r,a,a+d);return wedge(cx,cy,r,b,b+(Math.PI*2-d))}

const rad=d=>d*Math.PI/180;
const deg=r=>r*180/Math.PI;
function angleDiffDeg(a,b){let d=((a-b+180)%360+360)%360-180;return Math.abs(d)}
function parseDegreeValue(v){
  const s=norm(v).replaceAll("−","-");
  if(/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  const m=s.match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/);
  if(m && Number(m[2])!==0) return Number(m[1])/Number(m[2]);
  return NaN;
}
function experiment(root){
  const n=+root.dataset.n,svg=$(".exterior-svg",root),ringWrap=$(".angle-ring",root),ring=$(".angle-ring svg",root);
  let p=points(n,210,150,n===4?92:102,-Math.PI/2-.12),extended=false,dragVertex=null,raf=0,pendingPoint=null;
  const colors=[160,22,205,48,330,90];
  const pieces=new Map(); // i -> {x,y,rot,centered}
  let assemblyActive=null; // {i,mode, pointerId, dx,dy}

  function exteriorGeometry(i){
    const prev=p[(i-1+n)%n],cur=p[i],next=p[(i+1)%n];
    const inDx=cur.x-prev.x,inDy=cur.y-prev.y,inLen=Math.hypot(inDx,inDy)||1;
    const ext={x:cur.x+inDx/inLen*68,y:cur.y+inDy/inLen*68};
    const extA=Math.atan2(ext.y-cur.y,ext.x-cur.x),outA=Math.atan2(next.y-cur.y,next.x-cur.x);
    return {prev,cur,next,ext,extA,outA};
  }
  function getAngles(){return extAngles(p)}
  function targetRotations(){
    const A=getAngles();const targets=[];let t=-90;
    for(let i=0;i<n;i++){targets.push(t);t+=A[i]}
    return targets;
  }
  function pieceSectorPath(degVal){
    return wedge(0,0,64,0,rad(degVal));
  }
  function ensurePiece(i, clientX, clientY){
    if(pieces.has(i)) return pieces.get(i);
    const rect=ring.getBoundingClientRect();
    const x=(clientX-rect.left)*300/rect.width, y=(clientY-rect.top)*260/rect.height;
    const obj={x:Math.max(40,Math.min(260,x)),y:Math.max(40,Math.min(220,y)),rot:-35+i*24,centered:false};
    pieces.set(i,obj);return obj;
  }
  function assemblyStatus(){
    const A=getAngles(),targets=targetRotations(),cx=150,cy=125;
    let centered=0,oriented=0;
    for(let i=0;i<n;i++){
      const q=pieces.get(i); if(!q) continue;
      if(Math.hypot(q.x-cx,q.y-cy)<=14) centered++;
      if(Math.hypot(q.x-cx,q.y-cy)<=14 && angleDiffDeg(q.rot,targets[i])<=9) oriented++;
    }
    return {centered,oriented,complete:centered===n&&oriented===n};
  }
  function renderRing(){
    const A=getAngles(),targets=targetRotations();
    let h=`<circle cx="150" cy="125" r="88" class="assembly-guide"></circle>
           <line x1="150" y1="30" x2="150" y2="220" class="assembly-axis"></line>
           <line x1="55" y1="125" x2="245" y2="125" class="assembly-axis"></line>
           <circle cx="150" cy="125" r="7" class="assembly-center"></circle>`;
    for(const [i,q] of pieces){
      const centered=Math.hypot(q.x-150,q.y-125)<=14;
      h+=`<g class="assembly-piece ${centered?"centered":""}" data-i="${i}" transform="translate(${q.x} ${q.y}) rotate(${q.rot})">
          <path class="piece-sector" d="${pieceSectorPath(A[i])}" fill="hsl(${colors[i%colors.length]} 65% 76%)"></path>
          <circle class="pivot-dot" cx="0" cy="0" r="6"></circle>
          <line x1="70" y1="0" x2="82" y2="0" stroke="#b67a13" stroke-width="2"></line>
          <circle class="rotate-handle" cx="88" cy="0" r="8"></circle>
          <text x="${35*Math.cos(rad(A[i]/2))}" y="${35*Math.sin(rad(A[i]/2))+5}" text-anchor="middle" font-size="12" font-weight="900">${i+1}</text>
        </g>`;
    }
    const st=assemblyStatus();
    h+=`<text x="150" y="252" text-anchor="middle" font-size="12" font-weight="800" fill="#667">중심 맞춤 ${st.centered}/${n} · 방향 맞춤 ${st.oriented}/${n}</text>`;
    ring.innerHTML=h;

    $$(".assembly-piece",ring).forEach(g=>{
      const i=+g.dataset.i;
      g.addEventListener("pointerdown",ev=>{
        const q=pieces.get(i); if(!q)return;
        const rect=ring.getBoundingClientRect(), px=(ev.clientX-rect.left)*300/rect.width,py=(ev.clientY-rect.top)*260/rect.height;
        const onHandle=ev.target.classList.contains("rotate-handle");
        assemblyActive={i,mode:onHandle?"rotate":"move",pointerId:ev.pointerId,dx:px-q.x,dy:py-q.y};
        ring.setPointerCapture?.(ev.pointerId);
        g.classList.add("active");
        ev.preventDefault();
      });
    });
    ring.onpointermove=ev=>{
      if(!assemblyActive)return;
      const q=pieces.get(assemblyActive.i);if(!q)return;
      const rect=ring.getBoundingClientRect(),px=(ev.clientX-rect.left)*300/rect.width,py=(ev.clientY-rect.top)*260/rect.height;
      if(assemblyActive.mode==="move"){
        q.x=Math.max(20,Math.min(280,px-assemblyActive.dx));q.y=Math.max(20,Math.min(235,py-assemblyActive.dy));
        if(Math.hypot(q.x-150,q.y-125)<13){q.x=150;q.y=125;q.centered=true}else q.centered=false;
      }else{
        q.rot=deg(Math.atan2(py-q.y,px-q.x));
      }
      renderRing();
    };
    const finish=()=>{if(!assemblyActive)return;assemblyActive=null;renderRing()};
    ring.onpointerup=finish;ring.onpointercancel=finish;
  }
  function placeFromSource(ev,i){
    if(!extended)return;
    const rect=ringWrap.getBoundingClientRect();
    const inside=ev.clientX>=rect.left&&ev.clientX<=rect.right&&ev.clientY>=rect.top&&ev.clientY<=rect.bottom;
    if(!inside)return;
    ensurePiece(i,ev.clientX,ev.clientY);
    renderRing();
    $(".mini-status",root).textContent=`외각 조각 ${pieces.size} / ${n}개 가져옴`;
    event("exterior_piece_brought",{n,index:i});
  }
  function startSourceDrag(e,i,path){
    e.preventDefault();e.stopPropagation();
    const ghost=document.createElement("div");ghost.className="angle-ghost";
    const A=getAngles(),a0=-Math.PI/2,a1=a0+rad(A[i]);
    ghost.innerHTML=`<svg viewBox="0 0 90 90"><path d="${wedge(45,45,36,a0,a1)}" fill="hsl(${colors[i%colors.length]} 65% 75%)"></path></svg>`;
    document.body.appendChild(ghost);
    const move=ev=>{ghost.style.left=ev.clientX+"px";ghost.style.top=ev.clientY+"px";ringWrap.classList.add("drag-target")};
    const up=ev=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up);ghost.remove();ringWrap.classList.remove("drag-target");placeFromSource(ev,i)};
    move(e);window.addEventListener("pointermove",move,{passive:true});window.addEventListener("pointerup",up,{once:true});
  }
  function render(){
    let h=`<polygon points="${p.map(q=>q.x+","+q.y).join(" ")}" fill="#fff" stroke="#222" stroke-width="3"/>`;
    if(extended)for(let i=0;i<n;i++){
      const g=exteriorGeometry(i);
      h+=`<line x1="${g.cur.x}" y1="${g.cur.y}" x2="${g.ext.x}" y2="${g.ext.y}" class="extension"/>`;
      h+=`<path class="ext-wedge" data-i="${i}" fill="hsl(${colors[i%colors.length]} 65% 78%)" d="${smallWedge(g.cur.x,g.cur.y,38,g.outA,g.extA)}"/>`;
    }
    p.forEach((q,i)=>h+=`<circle class="drag-vertex" data-i="${i}" cx="${q.x}" cy="${q.y}" r="9"/><text x="${q.x+11}" y="${q.y-10}" font-weight="900">${String.fromCharCode(65+i)}</text>`);
    svg.innerHTML=h;
    $$(".ext-wedge",svg).forEach(path=>path.addEventListener("pointerdown",e=>startSourceDrag(e,+path.dataset.i,path)));
    $$(".drag-vertex",svg).forEach(v=>{
      v.addEventListener("pointerdown",e=>{
        if(extended)return;dragVertex=+v.dataset.i;v.setPointerCapture?.(e.pointerId);root.classList.add("dragging-polygon");e.preventDefault();
      });
      v.addEventListener("pointermove",e=>{
        if(dragVertex===null||extended)return;
        const r=svg.getBoundingClientRect();
        pendingPoint={x:Math.max(45,Math.min(375,(e.clientX-r.left)*420/r.width)),y:Math.max(35,Math.min(265,(e.clientY-r.top)*300/r.height))};
        if(!raf)raf=requestAnimationFrame(()=>{if(dragVertex!==null&&pendingPoint)p[dragVertex]=pendingPoint;pendingPoint=null;raf=0;render()});
      });
      const end=()=>{dragVertex=null;root.classList.remove("dragging-polygon");if(raf){cancelAnimationFrame(raf);raf=0}render()};
      v.addEventListener("pointerup",end);v.addEventListener("pointercancel",end);
    });
  }
  $(".extend-btn",root).onclick=()=>{extended=true;pieces.clear();$(".mini-status",root).textContent=`외각 조각 0 / ${n}개 가져옴`;render();renderRing();event("extension_created",{n})};
  $(".reset-assembly",root).onclick=()=>{pieces.clear();$(".assembly-msg",root).textContent="조각을 다시 가져와 중심과 방향을 직접 맞춰 보세요.";renderRing()};
  $(".check-assembly",root).onclick=()=>{
    const st=assemblyStatus(),m=$(".assembly-msg",root);
    if(pieces.size<n){m.textContent=`아직 ${n-pieces.size}개의 외각 조각을 더 가져와야 합니다.`;m.className="assembly-msg feedback bad";return}
    if(st.centered<n){m.textContent="각 조각의 꼭짓점(작은 원)을 가운데 초록 점에 맞춰 보세요.";m.className="assembly-msg feedback bad";return}
    if(st.oriented<n){m.textContent="중심은 맞았습니다. 노란 회전 손잡이를 움직여 조각들의 경계선이 이어지도록 회전해 보세요.";m.className="assembly-msg feedback bad";return}
    m.textContent="완성! 외각 조각들이 빈틈없이 한 바퀴를 이루므로 합은 360°입니다.";m.className="assembly-msg feedback ok";
    state.experimentsDone.add(n);
    if(state.experimentsDone.has(4)&&state.experimentsDone.has(5))$("#exteriorConclusion").classList.remove("disabled-box");
    answer(`a3_polygon_${n}`,{completed:true,manual_rotation:true});
  };
  render();renderRing();
}$$('.experiment').forEach(experiment);
const rn=6,rp=points(6,260,210,145,-Math.PI/2);let ri=new Set(),re=new Set(),sd=new Set(),reasonInteriorConfirmed=false;
function renderReason(){
  let h=`<polygon class="reason-poly" points="${rp.map(p=>p.x+","+p.y).join(" ")}"/>`;
  rp.forEach((cur,i)=>{
    const prev=rp[(i-1+rn)%rn],next=rp[(i+1)%rn];
    const aPrev=Math.atan2(prev.y-cur.y,prev.x-cur.x),aNext=Math.atan2(next.y-cur.y,next.x-cur.x);
    const dx=cur.x-prev.x,dy=cur.y-prev.y,l=Math.hypot(dx,dy)||1,ext={x:cur.x+dx/l*72,y:cur.y+dy/l*72},aExt=Math.atan2(ext.y-cur.y,ext.x-cur.x);
    h+=`<path data-kind="int" data-i="${i}" class="reason-int ${ri.has(i)?"chosen":""}" d="${smallWedge(cur.x,cur.y,38,aPrev,aNext)}"/>`;
    h+=`<line x1="${cur.x}" y1="${cur.y}" x2="${ext.x}" y2="${ext.y}" class="extension"/>`;
    h+=`<path data-kind="ext" data-i="${i}" class="reason-ext ${re.has(i)?"chosen":""}" d="${smallWedge(cur.x,cur.y,38,aNext,aExt)}"/>`;
    h+=`<circle data-kind="int" data-i="${i}" class="reason-hit" cx="${cur.x}" cy="${cur.y}" r="28"></circle>`;
    h+=`<text x="${cur.x+14}" y="${cur.y-14}" font-weight="900">${String.fromCharCode(65+i)}</text>`;
  });
  $("#reasonSvg").innerHTML=h;
}
$("#reasonSvg").addEventListener("click",e=>{
  const t=e.target.closest("[data-kind]");if(!t)return;
  const i=+t.dataset.i,kind=t.dataset.kind;
  if(kind==="int"){
    ri.add(i);renderReason();
    $("#reasonClickMsg").textContent=`내각 ${ri.size}/${rn}개 선택`;
    $("#reasonClickMsg").className="feedback "+(ri.size===rn?"ok":"");
    if(ri.size===rn){
      $("#interiorFormulaCard").classList.remove("disabled-box");
      $("#reasonClickMsg").textContent="모든 내각을 선택했습니다. 오른쪽에 내각의 합을 입력하세요.";
    }
  }else if(kind==="ext"){
    if(!reasonInteriorConfirmed){
      $("#reasonClickMsg").textContent="먼저 모든 내각을 선택하고 내각의 합 180(n-2)를 정확히 입력해 주세요.";
      $("#reasonClickMsg").className="feedback bad";return;
    }
    re.add(i);renderReason();straight();
    $("#reasonClickMsg").textContent=`외각 ${re.size}/${rn}개 선택`;
    $("#reasonClickMsg").className="feedback "+(re.size===rn?"ok":"");
  }
});
renderReason();
function straight(){if(ri.size<rn||re.size<rn||!reasonInteriorConfirmed)return;$("#straightCard").classList.remove("disabled-box");const b=$("#straightButtons");b.innerHTML="";for(let i=0;i<rn;i++){const x=document.createElement("button");x.textContent=String.fromCharCode(65+i)+"의 내각+외각"+(sd.has(i)?" = 180°":"");if(sd.has(i))x.classList.add("done");x.onclick=()=>{sd.add(i);straight();if(sd.size===rn){$("#straightResult").textContent="모든 꼭짓점의 평각의 합 = 180° × n";$("#straightResult").classList.remove("muted");$("#deriveCard").classList.remove("disabled-box")}};b.appendChild(x)}}renderReason();
function dnd(bankSel,zonesSel,tokens){const bank=$(bankSel);tokens.forEach((t,i)=>{const b=document.createElement("button");b.className="drag-token";b.type="button";b.draggable=true;b.textContent=t[0];b.dataset.value=t[1];b.dataset.id=bankSel+i;b.ondragstart=e=>e.dataTransfer.setData("text/plain",b.dataset.id);b.onclick=()=>{$$(".drag-token.selected").forEach(x=>x.classList.remove("selected"));b.classList.add("selected")};bank.appendChild(b)});$$(zonesSel).forEach(z=>{z.ondragover=e=>e.preventDefault();z.ondrop=e=>{e.preventDefault();fill(z,$(`.drag-token[data-id="${e.dataTransfer.getData("text/plain")}"]`))};z.onclick=()=>fill(z,$(".drag-token.selected:not(.used)"))});function fill(z,t){if(!t)return;z.textContent=t.textContent;z.dataset.value=t.dataset.value;z.classList.add("filled");t.classList.add("used");t.classList.remove("selected")}}
dnd("#deriveTokens","#deriveCard .drop-zone",[["내각의 합","180(n-2)"],["외각의 합","외각의합"],["180n","180n"],["180(n-2)","180(n-2)"],["360","360"],["180n","180n"]]);dnd("#regularTokens","#regularBox .drop-zone",[["같다","같다"],["같다","같다"],["n-2","n-2"],["n","n"],["360","360"],["n","n"]]);

function arcPath(cx,cy,r,a0,a1){
  let d=a1-a0;while(d<0)d+=Math.PI*2;while(d>=Math.PI*2)d-=Math.PI*2;
  const p0={x:cx+r*Math.cos(a0),y:cy+r*Math.sin(a0)},p1={x:cx+r*Math.cos(a1),y:cy+r*Math.sin(a1)};
  return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${d>Math.PI?1:0} 1 ${p1.x} ${p1.y}`;
}
function renderExteriorProblem(){
  const svg=$("#exteriorProblemSvg"); if(!svg)return;
  // A(110°), B(30°), C(70°), D(60°), E(90°), traversed counterclockwise.
  const exterior=[110,30,70,60,90];
  const edgeDirs=[-80,-50,20,80,170].map(rad);
  const lens=[78,62,56,85,122];
  let raw=[{x:0,y:0}];
  for(let i=0;i<5;i++)raw.push({x:raw[i].x+lens[i]*Math.cos(edgeDirs[i]),y:raw[i].y+lens[i]*Math.sin(edgeDirs[i])});
  const xs=raw.slice(0,5).map(q=>q.x),ys=raw.slice(0,5).map(q=>q.y);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),scale=Math.min(270/(maxX-minX),220/(maxY-minY));
  const pts=raw.slice(0,5).map(q=>({x:85+(q.x-minX)*scale,y:55+(maxY-q.y)*scale}));
  const labels=["x","30°","70°","60°","90°"];
  let h=`<polygon class="exterior-problem-edge" points="${pts.map(q=>`${q.x},${q.y}`).join(" ")}"/>`;
  for(let i=0;i<5;i++){
    const prev=pts[(i-1+5)%5],cur=pts[i],next=pts[(i+1)%5];
    const dx=cur.x-prev.x,dy=cur.y-prev.y,l=Math.hypot(dx,dy)||1,ext={x:cur.x+dx/l*48,y:cur.y+dy/l*48};
    const aNext=Math.atan2(next.y-cur.y,next.x-cur.x),aExt=Math.atan2(ext.y-cur.y,ext.x-cur.x);
    h+=`<line class="exterior-problem-extension" x1="${cur.x}" y1="${cur.y}" x2="${ext.x}" y2="${ext.y}"/>`;
    // exact exterior arc from outgoing side to extension of incoming side
    h+=`<path class="exterior-problem-arc" d="${arcPath(cur.x,cur.y,28,aNext,aNext+rad(exterior[i]))}"/>`;
    const mid=aNext+rad(exterior[i]/2),lx=cur.x+44*Math.cos(mid),ly=cur.y+44*Math.sin(mid);
    h+=`<text class="exterior-problem-label" x="${lx}" y="${ly}" text-anchor="middle">${labels[i]}</text><circle class="exterior-problem-vertex" cx="${cur.x}" cy="${cur.y}" r="5"/>`;
  }
  svg.innerHTML=h;
}
function renderHeptagon(){
  const svg=$("#heptagonSvg");if(!svg)return;const p=points(7,150,130,92,-Math.PI/2);
  let h=`<polygon class="heptagon-poly" points="${p.map(q=>`${q.x},${q.y}`).join(" ")}"/>`;
  const cur=p[0],prev=p[6],next=p[1],aPrev=Math.atan2(prev.y-cur.y,prev.x-cur.x),aNext=Math.atan2(next.y-cur.y,next.x-cur.x);
  h+=`<path class="heptagon-angle" d="${smallWedge(cur.x,cur.y,34,aPrev,aNext)}"/>`;
  const dx=cur.x-prev.x,dy=cur.y-prev.y,l=Math.hypot(dx,dy),ext={x:cur.x+dx/l*55,y:cur.y+dy/l*55},aExt=Math.atan2(ext.y-cur.y,ext.x-cur.x);
  h+=`<line class="extension" x1="${cur.x}" y1="${cur.y}" x2="${ext.x}" y2="${ext.y}"/><path class="heptagon-ext" d="${smallWedge(cur.x,cur.y,34,aNext,aExt)}"/>`;
  p.forEach((q,i)=>h+=`<text x="${q.x+8}" y="${q.y-8}" font-weight="900">${String.fromCharCode(65+i)}</text>`);
  svg.innerHTML=h;
}
renderExteriorProblem();renderHeptagon();

$("#submitReflection").onclick=async()=>{const t=$("#reflection").value.trim();if(t.length<10){fb("reflectionMsg","조금 더 구체적으로 적어 주세요.");return}await answer("a7_reflection",{text:t},true);await rpc("poly_student_submit",{p_session_id:state.sessionId});fb("reflectionMsg","답안이 제출되었습니다.",true);$("#saveBadge").textContent="제출 완료"};
const obs=new IntersectionObserver(es=>{const v=es.filter(x=>x.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(v)state.currentActivity=+v.target.dataset.activity},{threshold:[.25,.5,.75]});$$(".activity").forEach(x=>obs.observe(x));
