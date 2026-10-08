# 새로 만든 웹학습지: 다각형의 내각, 외각의 크기의 합

이번 버전은 이전 실험용 테이블과 코드를 사용하지 않습니다.
Supabase에는 `poly_*` 이름의 새 테이블/함수만 만들고, 학생 저장은 전용 RPC 함수로 처리합니다.

## 1. Supabase
1. SQL Editor > New query
2. `supabase-fresh.sql` 전체 붙여넣기 > Run
3. Authentication > Users에서 교사 계정 UUID 복사
4. 아래만 새 query에서 실행

```sql
insert into public.poly_teacher_profiles(user_id,display_name)
values ('교사-UUID','교사')
on conflict (user_id) do update set display_name=excluded.display_name;
```

## 2. 설정 파일
기존에 정상 작동하던 `supabase-config.js`의 URL과 publishable key를 새 프로젝트에 복사하세요.

```js
export const SUPABASE_URL = 'https://...supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_...';
```

## 3. 새 GitHub 저장소 권장
이전 저장소를 덮어쓰지 말고 새 repository를 만드세요.
예: `polygon-angle-sum-2026`

## 4. Vercel
새 GitHub 저장소를 Import해서 새 Vercel 프로젝트로 배포하세요.
- 학생: `https://새주소.vercel.app`
- 교사: `https://새주소.vercel.app/teacher.html`

## 설계상 달라진 점
- 학생 페이지는 Supabase 로그인 세션을 저장하지 않아 교사 로그인과 충돌하지 않음
- 학생 접속/heartbeat/답안 저장은 RPC 함수로 처리하여 RLS 충돌을 줄임
- 교사는 `poly_teacher_profiles`에 등록된 Auth 계정만 조회/잠금 변경 가능
