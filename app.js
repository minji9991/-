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
if(k==="reason-interior"){const ok=norm($("#reasonInterior").value).replaceAll("*","")==="180(n-2)";fb("reasonInteriorMsg",ok?"내각의 합을 정확히 나타냈습니다.":"활동 1의 식을 떠올려 보세요.",ok);if(ok)$("#straightCard").classList.remove("disabled-box")}
if(k==="derive"){const ok=$$("#deriveCard .drop-zone").every(z=>z.dataset.value===z.dataset.answer);fb("deriveMsg",ok?"외각의 합은 360°입니다.":"빈칸을 다시 확인하세요.",ok);if(ok)answer("a4_derivation",{completed:true})}
if(k==="exterior-x"){const ok=norm($("#exteriorX").value)==="110";fb("exteriorXMsg",ok?"정답입니다. x=110°입니다.":"왼쪽 아래 외각은 90°입니다.",ok);if(ok)answer("a5_exterior_x",{value:110})}
if(k==="regular"){const ok=$$("#regularBox .drop-zone").every(z=>z.dataset.value===z.dataset.answer);fb("regularMsg",ok?"정확히 정리했습니다.":"조각을 다시 확인하세요.",ok);if(ok)answer("a6_regular",{completed:true})}});
function extAngles(p){const r=[];for(let i=0;i<p.length;i++){const a=p[(i-1+p.length)%p.length],b=p[i],c=p[(i+1)%p.length],u={x:b.x-a.x,y:b.y-a.y},v={x:c.x-b.x,y:c.y-b.y};let t=Math.atan2(u.x*v.y-u.y*v.x,u.x*v.x+u.y*v.y)*180/Math.PI;if(t<0)t+=360;if(t>180)t=360-t;r.push(t)}const s=r.reduce((a,b)=>a+b,0);return r.map(x=>x*360/s)}
function wedge(cx,cy,r,a0,a1){const p0={x:cx+r*Math.cos(a0),y:cy+r*Math.sin(a0)},p1={x:cx+r*Math.cos(a1),y:cy+r*Math.sin(a1)};let d=a1-a0;while(d<0)d+=Math.PI*2;while(d>=Math.PI*2)d-=Math.PI*2;return`M ${cx} ${cy} L ${p0.x} ${p0.y} A ${r} ${r} 0 ${d>Math.PI?1:0} 1 ${p1.x} ${p1.y} Z`}
function smallWedge(cx,cy,r,a,b){let d=b-a;while(d<0)d+=Math.PI*2;while(d>=Math.PI*2)d-=Math.PI*2;if(d<=Math.PI)return wedge(cx,cy,r,a,a+d);return wedge(cx,cy,r,b,b+(Math.PI*2-d))}
function experiment(root){
  const n=+root.dataset.n,svg=$(".exterior-svg",root),ringWrap=$(".angle-ring",root),ring=$(".angle-ring svg",root);
  let p=points(n,210,150,n===4?92:102,-Math.PI/2-.12),extended=false,placed=new Set(),dragVertex=null,raf=0,pendingPoint=null,angleDrag=null;
  const colors=[160,22,205,48,330,90];

  function exteriorGeometry(i){
    const prev=p[(i-1+n)%n],cur=p[i],next=p[(i+1)%n];
    const inDx=cur.x-prev.x,inDy=cur.y-prev.y,inLen=Math.hypot(inDx,inDy)||1;
    const ext={x:cur.x+inDx/inLen*68,y:cur.y+inDy/inLen*68};
    const extA=Math.atan2(ext.y-cur.y,ext.x-cur.x),outA=Math.atan2(next.y-cur.y,next.x-cur.x);
    return {prev,cur,next,ext,extA,outA};
  }
  function renderRing(){
    ring.innerHTML=`<circle cx="120" cy="120" r="84" class="ring-circle"></circle>`;
    const A=extAngles(p);let start=-Math.PI/2;
    [...placed].sort((a,b)=>a-b).forEach(i=>{
      const deg=A[i],end=start+deg*Math.PI/180;
      ring.insertAdjacentHTML("beforeend",`<path d="${wedge(120,120,82,start,end)}" class="ring-sector" fill="hsl(${colors[i%colors.length]} 58% 72%)"></path>`);
      start=end;
    });
    ring.insertAdjacentHTML("beforeend",`<text class="placed-count" x="120" y="225" text-anchor="middle">${placed.size} / ${n} 조각</text>`);
    if(placed.size===n){
      ring.insertAdjacentHTML("beforeend",`<text x="120" y="126" text-anchor="middle" font-size="28" font-weight="900">360°</text>`);
      state.experimentsDone.add(n);if(state.experimentsDone.has(4)&&state.experimentsDone.has(5))$("#exteriorConclusion").classList.remove("disabled-box");
      answer(`a3_polygon_${n}`,{completed:true});
    }
  }
  function makeGhost(i,x,y){
    const A=extAngles(p),deg=A[i];
    const g=document.createElement("div");g.className="angle-ghost";g.dataset.i=i;
    const a0=-Math.PI/2,a1=a0+deg*Math.PI/180;
    g.innerHTML=`<svg viewBox="0 0 90 90"><path d="${wedge(45,45,36,a0,a1)}" fill="hsl(${colors[i%colors.length]} 65% 75%)"></path></svg>`;
    document.body.appendChild(g);moveGhost(g,x,y);return g;
  }
  function moveGhost(g,x,y){g.style.left=x+"px";g.style.top=y+"px"}
  function insideRing(x,y){const r=ringWrap.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom}
  function startAngleDrag(e,i,path){
    e.preventDefault();e.stopPropagation();
    if(placed.has(i))return;
    const ghost=makeGhost(i,e.clientX,e.clientY);path.classList.add("dragging");ringWrap.classList.add("drag-target");
    angleDrag={i,ghost,path};
    const move=ev=>{moveGhost(ghost,ev.clientX,ev.clientY);ringWrap.classList.toggle("drag-target",insideRing(ev.clientX,ev.clientY))};
    const up=ev=>{
      window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up);window.removeEventListener("pointercancel",up);
      const ok=insideRing(ev.clientX,ev.clientY);ghost.remove();path.classList.remove("dragging");ringWrap.classList.remove("drag-target");
      if(ok){placed.add(i);$(".mini-status",root).textContent=`외각 조각 ${placed.size} / ${n}개 모음`;render();renderRing();event("exterior_piece_dropped",{n,index:i})}
      angleDrag=null;
    };
    window.addEventListener("pointermove",move,{passive:true});window.addEventListener("pointerup",up,{once:false});window.addEventListener("pointercancel",up,{once:false});
  }
  function render(){
    let h=`<polygon points="${p.map(q=>q.x+","+q.y).join(" ")}" fill="#fff" stroke="#222" stroke-width="3"/>`;
    if(extended) for(let i=0;i<n;i++){
      const g=exteriorGeometry(i);
      h+=`<line x1="${g.cur.x}" y1="${g.cur.y}" x2="${g.ext.x}" y2="${g.ext.y}" class="extension"/>`;
      h+=`<path class="ext-wedge ${placed.has(i)?"chosen":""}" data-i="${i}" fill="hsl(${colors[i%colors.length]} 65% 78%)" d="${smallWedge(g.cur.x,g.cur.y,38,g.outA,g.extA)}"/>`;
    }
    p.forEach((q,i)=>h+=`<circle class="drag-vertex" data-i="${i}" cx="${q.x}" cy="${q.y}" r="9"/><text x="${q.x+11}" y="${q.y-10}" font-weight="900">${String.fromCharCode(65+i)}</text>`);
    svg.innerHTML=h;
    $$(".ext-wedge",svg).forEach(path=>path.addEventListener("pointerdown",e=>startAngleDrag(e,+path.dataset.i,path)));
    $$(".drag-vertex",svg).forEach(v=>{
      v.addEventListener("pointerdown",e=>{if(extended)return;dragVertex=+v.dataset.i;v.setPointerCapture(e.pointerId)});
      v.addEventListener("pointermove",e=>{
        if(dragVertex===null||extended)return;const r=svg.getBoundingClientRect();
        pendingPoint={x:Math.max(45,Math.min(375,(e.clientX-r.left)*420/r.width)),y:Math.max(35,Math.min(265,(e.clientY-r.top)*300/r.height))};
        if(!raf)raf=requestAnimationFrame(()=>{p[dragVertex]=pendingPoint;pendingPoint=null;raf=0;render()});
      });
      const end=()=>{dragVertex=null;if(raf){cancelAnimationFrame(raf);raf=0}render()};v.addEventListener("pointerup",end);v.addEventListener("pointercancel",end);
    });
  }
  $(".extend-btn",root).onclick=()=>{extended=true;placed.clear();$(".mini-status",root).textContent=`외각 조각 0 / ${n}개 모음`;render();renderRing();event("extension_created",{n})};
  render();renderRing();
}$$('.experiment').forEach(experiment);
const rn=6,rp=points(rn,260,210,145,-Math.PI/2);let ri=new Set(),re=new Set(),sd=new Set();function renderReason(){
  let h=`<polygon class="reason-poly" points="${rp.map(p=>p.x+","+p.y).join(" ")}"/>`;
  rp.forEach((cur,i)=>{
    const prev=rp[(i-1+rn)%rn],next=rp[(i+1)%rn];
    const aPrev=Math.atan2(prev.y-cur.y,prev.x-cur.x),aNext=Math.atan2(next.y-cur.y,next.x-cur.x);
    // 내각: 두 변 사이의 작은 각
    h+=`<path data-i="${i}" class="reason-int ${ri.has(i)?"chosen":""}" d="${smallWedge(cur.x,cur.y,31,aPrev,aNext)}"/>`;
    // 이전 변을 꼭짓점 너머로 연장
    const dx=cur.x-prev.x,dy=cur.y-prev.y,l=Math.hypot(dx,dy)||1,ext={x:cur.x+dx/l*65,y:cur.y+dy/l*65};
    h+=`<line x1="${cur.x}" y1="${cur.y}" x2="${ext.x}" y2="${ext.y}" class="extension"/>`;
    const aExt=Math.atan2(ext.y-cur.y,ext.x-cur.x);
    h+=`<path data-i="${i}" class="reason-ext ${re.has(i)?"chosen":""}" d="${smallWedge(cur.x,cur.y,31,aNext,aExt)}"/>`;
    h+=`<text x="${cur.x+12}" y="${cur.y-12}" font-weight="900">${String.fromCharCode(65+i)}</text>`;
  });
  $("#reasonSvg").innerHTML=h;
  $$(".reason-int").forEach(x=>x.onclick=()=>{ri.add(+x.dataset.i);renderReason();if(ri.size===rn)$("#interiorFormulaCard").classList.remove("disabled-box")});
  $$(".reason-ext").forEach(x=>x.onclick=()=>{re.add(+x.dataset.i);renderReason();straight()});
}
function straight(){if(ri.size<rn||re.size<rn)return;$("#straightCard").classList.remove("disabled-box");const b=$("#straightButtons");b.innerHTML="";for(let i=0;i<rn;i++){const x=document.createElement("button");x.textContent=String.fromCharCode(65+i)+"의 내각+외각"+(sd.has(i)?" = 180°":"");if(sd.has(i))x.classList.add("done");x.onclick=()=>{sd.add(i);straight();if(sd.size===rn){$("#straightResult").textContent="모든 꼭짓점의 평각의 합 = 180° × n";$("#straightResult").classList.remove("muted");$("#deriveCard").classList.remove("disabled-box")}};b.appendChild(x)}}renderReason();
function dnd(bankSel,zonesSel,tokens){const bank=$(bankSel);tokens.forEach((t,i)=>{const b=document.createElement("button");b.className="drag-token";b.type="button";b.draggable=true;b.textContent=t[0];b.dataset.value=t[1];b.dataset.id=bankSel+i;b.ondragstart=e=>e.dataTransfer.setData("text/plain",b.dataset.id);b.onclick=()=>{$$(".drag-token.selected").forEach(x=>x.classList.remove("selected"));b.classList.add("selected")};bank.appendChild(b)});$$(zonesSel).forEach(z=>{z.ondragover=e=>e.preventDefault();z.ondrop=e=>{e.preventDefault();fill(z,$(`.drag-token[data-id="${e.dataTransfer.getData("text/plain")}"]`))};z.onclick=()=>fill(z,$(".drag-token.selected:not(.used)"))});function fill(z,t){if(!t)return;z.textContent=t.textContent;z.dataset.value=t.dataset.value;z.classList.add("filled");t.classList.add("used");t.classList.remove("selected")}}
dnd("#deriveTokens","#deriveCard .drop-zone",[["내각의 합","180(n-2)"],["외각의 합","외각의합"],["180n","180n"],["180(n-2)","180(n-2)"],["360","360"],["180n","180n"]]);dnd("#regularTokens","#regularBox .drop-zone",[["같다","같다"],["같다","같다"],["n-2","n-2"],["n","n"],["360","360"],["n","n"]]);
$("#submitReflection").onclick=async()=>{const t=$("#reflection").value.trim();if(t.length<10){fb("reflectionMsg","조금 더 구체적으로 적어 주세요.");return}await answer("a7_reflection",{text:t},true);await rpc("poly_student_submit",{p_session_id:state.sessionId});fb("reflectionMsg","답안이 제출되었습니다.",true);$("#saveBadge").textContent="제출 완료"};
const obs=new IntersectionObserver(es=>{const v=es.filter(x=>x.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(v)state.currentActivity=+v.target.dataset.activity},{threshold:[.25,.5,.75]});$$(".activity").forEach(x=>obs.observe(x));
