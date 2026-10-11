import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.58.0/+esm";
import { SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY } from "./supabase-config.js";

const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:"polygon-angle-teacher-auth"}
});
const $=s=>document.querySelector(s);
let poll=null, latestSessions=[];
const titles={1:"내각의 합 탐구",2:"개념 적용 · 내각",3:"외각의 합 실험",4:"외각의 합 이유",5:"개념 적용 · 외각",6:"정다각형",7:"생각 더 나아가기"};

function msg(t,ok=false){$("#teacherLoginMsg").textContent=t;$("#teacherLoginMsg").className="feedback "+(ok?"ok":"bad")}
function fmt(t){return t?new Intl.DateTimeFormat("ko-KR",{hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date(t)):"-"}
function stat(s){const a=(Date.now()-new Date(s.last_seen_at))/1000;if(a>45)return["","미응답"];if(s.visibility==="hidden")return["away","페이지 이탈"];return["live","접속 중"]}
function clean(v){return String(v||"").replace(/[<>&]/g,"")}
function parseStudentId(raw){
  const s=String(raw||"");
  const p=s.split("|");
  if(p.length>=4&&p[0]==="CLASS"){
    return {classNo:Number(p[1])||"",number:Number(p[2])||"",name:p.slice(3).join("|")||""};
  }
  return {classNo:"기존",number:s,name:""};
}
function displayStudent(raw){
  const x=parseStudentId(raw);
  return x.classNo==="기존"?raw:`${x.classNo}반 ${x.number}번 ${x.name}`;
}

async function login(){
  const{error}=await supabase.auth.signInWithPassword({email:$("#teacherEmail").value.trim(),password:$("#teacherPassword").value});
  if(error){msg(error.message);return}
  const{data,error:e}=await supabase.from("poly_teacher_profiles").select("user_id").limit(1);
  if(e||!data?.length){msg("로그인은 되었지만 교사로 등록되지 않은 계정입니다.");return}
  msg("로그인되었습니다.",true);refresh();startPoll()
}
$("#teacherLogin").onclick=login;

async function controls(){
  const{data,error}=await supabase.from("poly_lesson_control").select("*").order("activity_no");
  if(error)return console.error(error);
  const g=$("#controlGrid");g.innerHTML="";
  data.forEach(r=>{
    const d=document.createElement("div");d.className="control-item";
    d.innerHTML=`<div><b>활동 ${r.activity_no}</b><div>${titles[r.activity_no]}</div></div><button class="toggle ${r.is_open?"open":"locked"}">${r.is_open?"열림":"잠김"}</button>`;
    d.querySelector("button").onclick=async()=>{
      const{error}=await supabase.from("poly_lesson_control").update({is_open:!r.is_open,updated_at:new Date().toISOString()}).eq("activity_no",r.activity_no);
      if(error)alert(error.message);else controls()
    };
    g.appendChild(d)
  })
}
$("#lockAll").onclick=async()=>{
  const{error}=await supabase.from("poly_lesson_control").update({is_open:false}).gte("activity_no",1);
  if(error)alert(error.message);else controls()
};
$("#openNext").onclick=async()=>{
  const{data}=await supabase.from("poly_lesson_control").select("*").order("activity_no");
  const n=data?.find(x=>!x.is_open);
  if(n){await supabase.from("poly_lesson_control").update({is_open:true}).eq("activity_no",n.activity_no);controls()}
};

function rebuildClassFilter(){
  const sel=$("#classFilter"),current=sel.value||"all";
  const classes=[...new Set(latestSessions.map(s=>parseStudentId(s.student_id).classNo).filter(x=>x!==""&&x!=="기존"))].sort((a,b)=>a-b);
  sel.innerHTML='<option value="all">전체 반</option>'+classes.map(c=>`<option value="${c}">${c}반</option>`).join("");
  if([...sel.options].some(o=>o.value===current))sel.value=current;
}
function renderSessions(){
  const filter=$("#classFilter").value||"all";
  let rows=latestSessions.filter(s=>filter==="all"||String(parseStudentId(s.student_id).classNo)===filter);
  rows.sort((a,b)=>{
    const A=parseStudentId(a.student_id),B=parseStudentId(b.student_id);
    if(A.classNo==="기존"&&B.classNo!=="기존")return 1;
    if(B.classNo==="기존"&&A.classNo!=="기존")return -1;
    const c=(Number(A.classNo)||999)-(Number(B.classNo)||999);if(c)return c;
    const n=(Number(A.number)||999)-(Number(B.number)||999);if(n)return n;
    return String(A.name).localeCompare(String(B.name),"ko");
  });
  $("#sessionRows").innerHTML=rows.length?rows.map(s=>{
    const x=parseStudentId(s.student_id),[c,l]=stat(s);
    return `<tr>
      <td><b>${x.classNo==="기존"?"기존":x.classNo+"반"}</b></td>
      <td>${x.classNo==="기존"?x.number:x.number+"번"}</td>
      <td><b>${clean(x.name||"-")}</b></td>
      <td><span class="status-dot ${c}"></span>${l}</td>
      <td>${fmt(s.started_at)}</td><td>${fmt(s.last_seen_at)}</td>
      <td>${s.current_activity||"-"}</td><td>${s.away_count||0}</td><td>${s.submitted_at?"완료":"-"}</td>
    </tr>`
  }).join(""):`<tr><td colspan="9">이 반의 접속 기록이 없습니다.</td></tr>`
}
async function sessions(){
  const{data,error}=await supabase.from("poly_sessions").select("*").order("started_at",{ascending:false}).limit(500);
  if(error){$("#sessionRows").innerHTML=`<tr><td colspan="9">${error.message}</td></tr>`;return}
  const m=new Map();(data||[]).forEach(s=>{if(!m.has(s.student_id))m.set(s.student_id,s)});
  latestSessions=[...m.values()];
  rebuildClassFilter();renderSessions()
}

async function refs(){
  const[{data:refData,error:refErr},{data:challengeData,error:challengeErr}]=await Promise.all([
    supabase.from("poly_answers").select("student_id,answer,created_at").eq("activity_key","a7_reflection").order("created_at",{ascending:false}).limit(60),
    supabase.from("poly_answers").select("student_id,answer,created_at").eq("activity_key","a6_challenge").order("created_at",{ascending:false}).limit(60)
  ]);
  if(refErr)console.error(refErr);if(challengeErr)console.error(challengeErr);
  $("#reflectionList").innerHTML=refData?.length?refData.map(x=>`<div style="border-top:1px solid #e4e9e6;padding:10px 0"><b>${clean(displayStudent(x.student_id))}</b> ${fmt(x.created_at)}<div>${clean(x.answer?.text)}</div></div>`).join(""):"제출된 답안이 없습니다.";
  $("#challengeList").innerHTML=challengeData?.length?challengeData.map(x=>`<div style="border-top:1px solid #e4e9e6;padding:10px 0"><b>${clean(displayStudent(x.student_id))}</b> ${fmt(x.created_at)}<div>${clean(x.answer?.text)}</div></div>`).join(""):"제출된 도전 답안이 없습니다.";
}

async function refresh(){await Promise.all([controls(),sessions(),refs()])}
$("#refreshTeacher").onclick=refresh;
$("#classFilter").onchange=renderSessions;
function startPoll(){clearInterval(poll);poll=setInterval(()=>{sessions();refs()},5000)}

const{data:{session}}=await supabase.auth.getSession();
if(session){msg("기존 로그인 세션을 확인했습니다.",true);refresh();startPoll()}
