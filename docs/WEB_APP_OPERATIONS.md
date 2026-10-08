# Workspace Lab — 실행과 배포

> **개인용 무료 웹 배포는 [Cloudflare 개인용 가이드](CLOUDFLARE_PERSONAL.md)를 사용하세요.** Cloud Run·PostgreSQL은 아래의 기존 다중 사용자 서버 배포 방식이며 Cloudflare 개인용에는 필요하지 않습니다.

처음 설정하는 운영자는 [직접 해야 할 설정](WORKSPACE_LAB_START.md)의 단계별 안내부터 읽으세요.

## 완성된 기능

- 같은 코드로 개인용 로컬 앱과 다중 사용자 배포용 웹앱 실행. 기존 MCP 진입점은 유지.
- 수업 꾸러미, 수업안, 학습지, 퀴즈, 슬라이드, 가정통신문, 회의록, 행사 계획, 프로젝트 시트, 기획서, 스터디 노트, 여행 계획 총 12종 예시 및 편집.
- Gemini 구조화 초안 생성, GPT 선택형 개선. API 키 없이 예시 편집 가능.
- Google Docs·Slides·Forms·Sheets 생성, 생성 전 검토, 파일별 결과 기록.
- kordoc 4.15.4: HWP/HWPX/DOCX 읽기, Markdown 편집·미리보기, 새 HWPX 생성, HWP/HWPX 원본 서식 유지 수정, 두 문서 비교.
- HWP/HWPX → Google Docs, Google Docs → HWPX. 배포 모드에서도 지원.
- Classroom 담당 수업 조회, 비공개 과제 초안, 별도 확인 후 게시.
- 초등 성취기준 검색, 편집본 JSON 보관·복원, 최근 저장 파일 링크.

## 1. 개인용 실행

npm 배포 버전은 Node.js 22 이상에서 `npx -y edu-workspace-mcp@1.1.0 web`으로 실행합니다. 현재 터미널 폴더의 `.env`를 읽으며 키 없이 예시·문서 변환부터 사용할 수 있습니다. Google 연결은 `npx -y edu-workspace-mcp@1.1.0 login`으로 진행합니다. 기존 MCP v1.0.0은 `npx -y edu-workspace-mcp@1.0.0`으로 계속 사용할 수 있습니다.


Node.js 22 이상 권장. 프로젝트 폴더에서:

```sh
npm ci
cp .env.example .env
# .env의 GEMINI_API_KEY를 입력. OPENAI_API_KEY는 선택.
npm run web:dev
```

브라우저에서 `http://127.0.0.1:3210` 접속. 이후 코드 변경이 없으면 `npm run web:start`로 실행.

Google 연결이 없으면 별도 터미널에서 `npm run cli -- login` 실행. 기존 MCP 로그인과 토큰 파일을 재사용한다. 이 앱은 127.0.0.1에서만 수신하므로 외부에 공개되지 않는다. 환경변수의 origin도 loopback만 허용한다. Gemini/GPT 키를 설정하지 않아도 예시, 한글 문서 읽기·수정·변환·비교는 작동한다.

현재 초안과 업로드 원본은 브라우저 메모리에만 남는다. 다른 자료를 열기 전 ‘편집본 보관’으로 내려받는다. 로컬 최근 작업 기록은 프로세스를 종료하면 사라지며, 만들어진 Google 파일은 유지된다.

## 2. 배포 전 운영자 설정

### Google 프로젝트와 Web OAuth

1. 운영용 Google Cloud 프로젝트에서 Drive, Docs, Sheets, Slides, Forms, Classroom API를 활성화한다.
2. OAuth 동의 화면에 운영자·서비스 이름·지원 이메일·홈페이지·개인정보 안내 주소를 넣는다. 처음에는 시험 사용자 이메일을 등록한다.
3. OAuth 클라이언트 유형은 **웹 애플리케이션**으로 생성한다. 기존 MCP 데스크톱 클라이언트와 분리한다.
4. 리디렉션 URI는 `https://실제주소/auth/callback`. `APP_ORIGIN`에는 끝 슬래시나 경로 없이 `https://실제주소`만 넣는다.
5. 기본 요청 권한은 `openid`, `email`, `drive.file`. Classroom 사용자가 별도 연결할 때 `classroom.courses.readonly`, `classroom.coursework.students`를 추가 요청한다. 공개 범위와 요청 권한에 따라 Google OAuth 검증 및 학교 Workspace 관리자 승인이 필요하다.

`drive.file` 범위 때문에 URL을 안다고 모든 기존 Drive 파일을 읽을 수 있는 것은 아니다. 앱이 만들었거나 해당 앱에 접근 권한이 부여된 파일을 읽을 수 있다. 기존 Google Docs는 DOCX로 다운로드 후 업로드하는 경로도 제공한다. Drive 전체 파일 탐색 권한은 요청하지 않는다.

### 서버와 저장소

- Node 22 Docker 컨테이너를 실행할 수 있는 HTTPS 호스팅 사용. `Dockerfile` 제공.
- 관리형 PostgreSQL 데이터베이스 준비. `DATABASE_URL`은 운영 환경에 맞는 TLS 설정을 사용한다. 런타임은 `edu_web_state` 테이블과 만료 인덱스를 생성할 권한이 필요하다.
- `APP_SECRET`: 암호학적 난수 32바이트 이상 권장. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`로 생성할 수 있다. 이 키가 바뀌면 기존 암호화 세션과 작업 기록을 읽지 못하므로 사전 만료·삭제 후 교체한다.
- `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_WEB_CLIENT_SECRET`, `GEMINI_API_KEY`, 선택적으로 `OPENAI_API_KEY`를 서버의 Secret Manager에 저장한다. 브라우저·저장소·Docker 이미지에 넣지 않는다.
- `APP_OPERATOR`, `APP_SUPPORT_EMAIL`에 실제 운영자와 연락처를 설정한다. 공개 개인정보 안내는 `/privacy`에 제공한다. 실제 호스팅 지역과 백업 정책은 `src/web/privacy.ts` 안내에 반영한다.
- 첫 시범 운영은 `ALLOWED_EMAILS`에 테스트 교직원 이메일을 쉼표로 구분해 지정한다. 비어 있으면 모든 Google 계정 가입을 허용한다.

### Cloud Run 배포

새 웹 서비스 기본 이름은 `workspace-lab-v1-1`입니다. 기존 서비스·MCP 릴리스는 삭제하지 않습니다. GPT 기본 모델은 `gpt-6-luna`이며 `WEB_OPENAI_MODEL=gpt-6-sol`로 명시적으로 변경할 수 있습니다.

Cloud Run을 쓴다면 `scripts/deploy-web.sh`를 제공한다. 운영자는 먼저 다음을 준비한다.

1. 과금 프로젝트와 전용 런타임 서비스 계정.
2. PostgreSQL URL. Cloud SQL이면 네트워크 또는 Cloud SQL 연결을 별도로 구성한다. 제공 스크립트는 URL로 직접 연결 가능한 DB를 가정한다.
3. Secret Manager 이름: `edu-app-secret`, `edu-database-url`, `edu-google-client-id`, `edu-google-client-secret`, `edu-gemini-key`, 선택 `edu-openai-key`.
4. 런타임 서비스 계정에 해당 시크릿의 Secret Accessor 권한. 배포자에게 Cloud Run 소스 빌드·배포·서비스 계정 사용 권한.
5. 최종 HTTPS 주소, Google 리디렉션 URI. 처음에는 예약한 도메인을 사용하거나 최초 배포 후 발급된 Cloud Run 주소로 `APP_ORIGIN`과 OAuth URI를 맞춰 다시 배포한다.

```sh
export GOOGLE_CLOUD_PROJECT='프로젝트-ID'
export WEB_SERVICE_ACCOUNT='서비스계정@프로젝트-ID.iam.gserviceaccount.com'
export WEB_APP_ORIGIN='https://실제주소'
export WEB_ALLOWED_EMAILS='교직원1@학교도메인,교직원2@학교도메인'
export WEB_OPERATOR='운영자 이름 또는 기관명'
export WEB_SUPPORT_EMAIL='문의용 이메일'
# export WEB_ENABLE_GPT=1
bash scripts/deploy-web.sh
```

서비스는 HTTP 진입을 허용하되, 앱 안에서 사용자 로그인을 요구한다. HTTPS 종료 프록시는 원래 Host를 전달해야 한다. Cloud Run 자체 인증으로 막으면 일반 교직원이 앱의 Google 로그인 화면까지 접근하지 못할 수 있다. `/healthz` 상태 확인, 앱 화면, 예시 갤러리·탑재 파일 다운로드는 로그인 없이 접근 가능하다. 사용자별 문서 변환과 Google 저장은 로그인이 필요하다.

공개 도메인, Google OAuth 발급, API 키, DB·호스팅 계정은 사용자 소유 설정이므로 실제 값이 제공된 환경에서 최종 연결한다. 이 저장소에 배포 설정을 작성한 것만으로 공개 배포 완료를 뜻하지 않는다.

## 3. 운영 제한과 데이터 보관

- 한 문서 최대 20MB. ZIP 내부 파일 수·압축 해제 크기를 사전 검사. 문서 작업은 별도 worker에서 메모리 제한 384MB, 60초 제한, 인스턴스당 최대 2개.
- 2026-09-27 기준 Gemini 기본 모델은 Google이 갱신하는 `gemini-flash-latest` 별칭이며 Interactions API를 사용한다. `GEMINI_MODEL`로 변경 가능하다. 기존 2.5 모델은 신규 프로젝트 접근이 제한되어 기본값으로 사용하지 않는다. [현재 모델 정책](https://ai.google.dev/gemini-api/docs/deprecations) · [요금표](https://ai.google.dev/gemini-api/docs/pricing).
- 사용자당 하루 AI 20회 기본값(`AI_DAILY_LIMIT`), 계정당 AI 동시 1개. 문서 작업·저장 준비는 각각 하루 100회. 실패한 API 시도도 한도에 포함될 수 있다.
- 업로드 원본은 영구 저장하지 않으며 변환에 필요한 서버·worker 메모리에서 처리한다. 서버 생성 문서는 Google API에 전송된다. AI 버튼을 누른 경우에만 선택한 제공자에게 요청/초안 전송.
- 로그인 세션은 HttpOnly·SameSite cookie, 배포 시 Secure. 세션에는 암호화된 Google 토큰이 포함된다. OAuth state+PKCE 사용, 새 로그인 시 세션 회전, POST 요청은 Origin 및 CSRF 확인.
- 로그인은 기본 8시간, Google 사용으로 토큰을 갱신할 때 서버 세션 TTL도 갱신되지만 브라우저 쿠키 최대 수명은 8시간. 작업 준비 내용은 15분, 파일 링크·결과 기록은 7일. 만료 데이터는 조회할 수 없고 저장 작업 시 정리된다. 유휴 시에도 물리적으로 지우려면 DB에서 `DELETE FROM edu_web_state WHERE expires_at <= NOW()`를 정기 실행한다.
- 로그아웃은 해당 브라우저 세션을 삭제한다. Google 계정의 앱 연결 해제는 Google 계정 보안 설정에서 별도로 한다. 생성된 Drive 파일은 사용자가 관리한다.
- 초안 내용은 Google 저장 검토를 위한 15분 준비 데이터에 포함된다. 작업 결과에는 제목·파일 링크가 남는다. 개인정보 처리방침에는 실제 운영자·문의처·호스팅/DB·제공자·보관 정책을 정확히 반영해야 한다.
- 무료 Gemini 호출은 차단한다. 학습에 사용하지 않는 Paid Service 또는 학습 공유가 비활성화된 OpenAI API를 운영자가 확인한 경우에만 AI 전송 동의 후 호출한다. 학생 실명·성적·상담·비공개 문서는 AI 입력 금지. 유료 전환만으로 학교의 정보 처리 승인이 확보되지는 않는다.
- AI 키가 있으면 비용이 발생할 수 있다. GPT는 선택했을 때만 호출되며, 서비스 운영자가 공급자 예산과 경보를 설정한다. 현재 앱에 교직원 결제 기능은 없다.

## 4. 실패 시 대응

- Google 파일 생성은 외부 서비스와 DB 간 원자적 트랜잭션이 아니다. 응답이 중단되면 `running` 또는 실패로 남을 수 있다. Drive에서 파일을 확인한 후 빠진 항목만 생성한다. 동일한 저장 확인 ID를 재전송하면 새 파일을 중복 생성하지 않는다.
- 한글 원본 서식 유지 수정은 kordoc이 지원하는 변경만 적용한다. 건너뛴 수정과 잔여 차이를 표시한다. 새 HWPX와 Google Docs 변환은 본문·표 중심 재구성이며 원본 이미지·쪽 배치를 보장하지 않는다.
- 암호 문서, 손상 문서, 스캔 이미지 OCR은 현재 웹 화면의 지원 대상이 아니다. 문서 파서 자체가 더 많은 형식을 지원해도 이 웹앱은 HWP/HWPX/DOCX로 제한한다.
- Google Classroom 초안과 게시 작업도 요청 결과를 확인하지 못하면 Classroom에서 상태를 확인한다. 앱으로 만든 과제만 앱에서 게시할 수 있다.

## 5. 검증 명령

```sh
npm run check
npm test
npm run test:mcp
npm run test:web:ui
```

브라우저 검증은 설치된 Google Chrome을 사용한다. 다른 환경에서는 Chrome 설치 또는 Playwright 설정의 `channel` 변경이 필요하다. 단위 테스트는 외부 AI/Google 서비스 호출을 모의 처리하고, kordoc 변환과 브라우저 파일 왕복은 실제 라이브러리로 검증한다. 실제 AI·Web OAuth·학교 계정·공개 호스팅 연결은 해당 운영 설정 이후 검증한다.

### 이번 구현의 검증 기록 (2026-09-26)

- 기존 MCP 회귀 테스트와 31개 도구 smoke 통과. 웹 인증 격리·CSRF·중복 저장·Classroom 별도 게시 확인 등 웹 테스트 10개 통과.
- Chrome 브라우저 테스트 2개 통과: 예시 편집 → 미리보기 → HWPX 다운로드 → 재업로드, 모바일 레이아웃, GPT 개선안 비교·적용 및 JSON 편집본 복원.
- 실제 로컬 Google 계정에서 Docs 수업안·학습지, Slides, Forms, Sheets 총 5개 생성 및 검증 폴더 이동 성공.
- 실제 Google Docs → DOCX 다운로드 → kordoc → HWPX 생성 → 재파싱 성공. 파일은 `outputs/Google문서_왕복검증.hwpx`, 링크 기록은 `outputs/web-google-smoke.json`에 저장.
- 검증용 Google 예시는 운영자의 비공개 폴더에 보관했다. 외부 공유나 실제 Classroom 게시는 하지 않았다.
- Gemini/GPT API 키, Web OAuth 클라이언트, PostgreSQL 운영 연결이 없는 상태이므로 이들의 실제 배포 연결은 아직 검증하지 않았다. AI 응답과 Classroom 게시 테스트는 모의 API를 사용했다. 로컬 Docker가 설치되어 있지 않아 컨테이너 이미지 빌드는 실행하지 않았다.
- gcloud 로그인은 있으나 현재 프로젝트가 지정되지 않아 Cloud Run 배포를 실행하지 않았다. 운영자가 프로젝트·도메인·DB·시크릿을 지정한 다음 배포 스크립트를 실행해야 한다.

공식 참고: [kordoc](https://github.com/chrisryugj/kordoc), [Google 웹 OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [Classroom 권한](https://developers.google.com/workspace/classroom/guides/auth), [Gemini 구조화 출력](https://ai.google.dev/gemini-api/docs/structured-output), [Gemini 이용 조건](https://ai.google.dev/gemini-api/terms), [OpenAI 구조화 출력](https://developers.openai.com/api/docs/guides/structured-outputs).

### Workspace Lab 디자인·예시 개편 검증

- Google 제품별 아이콘, 독립 앱 로고, CSS 일러스트와 모션, 모바일 레이아웃 적용.
- 수업·업무·학습·일상 예시 12개, HWPX/Markdown/JSON 36개 파일 탑재.
- 웹 테스트 10개 및 Chrome UI 테스트 4개 통과. 예시 필터·검색, 실제 본문 미리보기, 다운로드, 예시 편집 진입, 홈 입력 전달과 동작 줄이기 설정을 추가 검증.
- API 키와 실제 공개 운영 설정은 이전 기록과 동일하게 운영자 연결이 필요합니다.
