# Workspace Lab · 개인용 무료 웹앱

맥을 켜둘 필요 없이 맥·윈도우의 Chrome/Edge에서 같은 HTTPS 주소를 열어 사용합니다.

## 1. 비용과 실행 구조

- 화면·예시: Cloudflare Static Assets.
- HWP/HWPX/DOCX 읽기, HWP/HWPX 서식 유지 수정, 비교, 새 HWPX: **접속한 컴퓨터의 브라우저 Web Worker에서 실제 Kordoc 4.15.4 실행**.
- 디자인·교육과정·학습 지도·AI 프롬프트 조립: 브라우저에서 실행. 기존 문서·발표·시트·퀴즈 디자인을 재사용합니다.
- 로그인, Google API 연결, AI API 키 보관: Cloudflare Workers.
- 로그인·짧은 작업 기록: Cloudflare D1. PostgreSQL, Cloud Run, 유료 컨테이너는 사용하지 않습니다.
- 기존 MCP, 로컬 웹앱, 기존 배포는 그대로 이용할 수 있습니다. 새 웹앱은 별도 Worker 이름으로 배포합니다.

**Workers Free 계정을 유지해야 인프라 비용 0원 조건이 성립합니다.** 도메인의 Free 요금제와 Workers 요금제는 별개입니다. Workers & Pages의 Plans에서 확인하세요. Paid로 전환하지 마세요. 무료 한도에 도달하면 요청이 실패하고, 다음 한도 갱신을 기다립니다. 앱이 유료 서비스를 자동으로 신청하거나 다른 AI로 전환하지 않습니다.

2026-09-27 공식 문서 기준: Workers Free 하루 동적 요청 100,000회·요청당 CPU 10ms. D1 Free 하루 읽기 500만 행·쓰기 10만 행·계정 저장 용량 5GB. 한도는 계정의 다른 앱과 공유합니다. 정적 파일 요청은 무료입니다. CPU 제한을 넘는 요청은 실패하므로 실제 배포에서 검증해야 합니다.

[Workers 요금](https://developers.cloudflare.com/workers/platform/pricing/) · [D1 요금](https://developers.cloudflare.com/d1/platform/pricing/)

## 2. 배포 담당자가 한 번 실행할 작업

저장소에서 Node.js 22 이상으로 실행합니다. Mac과 Windows PowerShell에서 명령은 동일합니다.

```sh
npm ci
npx wrangler login
npm run cloud:setup
```

설치 도우미가 계정 ID, 본인 Google 이메일, Workers Free 여부를 묻습니다. Free를 확인해야 D1을 만들고 배포합니다. 계정 ID는 Cloudflare 계정 화면에서 복사합니다. 로그인·API 키 설정 전에도 예시 편집과 브라우저 문서실을 사용할 수 있습니다.

이후 코드 업데이트:

```sh
npm run cloud:deploy
```

`cloud/wrangler.personal.jsonc`는 이 컴퓨터의 개인 배포 설정이며 Git에 올라가지 않습니다. 기본 Worker 이름은 `workspace-lab-personal`입니다. 이전 사이트나 MCP 릴리스를 삭제하지 않습니다. 이 도우미는 Cloudflare 요금제를 변경하지 않습니다.

## 3. Google 연결 — 본인만 로그인

Google 문서를 내 계정에 저장하려면 이 설정은 한 번 필요합니다. 이는 서버 요금 결제가 아닌 **Google 계정 접근 동의 설정**입니다.

1. [Google Cloud 콘솔](https://console.cloud.google.com/)에서 프로젝트를 선택합니다. Cloud Run이나 결제 계정 연결은 필요하지 않습니다.
2. **API 및 서비스 → 라이브러리**에서 Google Drive API, Google Docs API, Google Sheets API, Google Slides API, Google Forms API를 사용 설정합니다. Classroom을 쓰면 Google Classroom API도 켭니다.
3. **Google Auth Platform → Branding / Audience**에서 앱 이름과 이메일을 설정합니다. 외부·테스트 상태라면 본인 Google 이메일을 테스트 사용자로 추가합니다. 학교 계정은 관리자의 접근 허용이 필요할 수 있습니다.
4. **Clients → Create client → Web application**을 선택합니다. 기존 MCP의 Desktop client는 그대로 둡니다.
5. Authorized JavaScript origins에 앱의 HTTPS 주소를 넣습니다. 예: `https://workspace-lab-personal.내주소.workers.dev`.
6. Authorized redirect URIs에 같은 주소 뒤 **`/auth/callback`**을 붙입니다. 예: `https://workspace-lab-personal.내주소.workers.dev/auth/callback`.
7. Cloudflare → Workers & Pages → `workspace-lab-personal` → **Settings → Variables and Secrets → Add**에서 다음 두 항목을 **Secret**으로 추가하고 Deploy합니다.
   - `GOOGLE_WEB_CLIENT_ID`: 웹 클라이언트 ID
   - `GOOGLE_WEB_CLIENT_SECRET`: 웹 클라이언트 시크릿
8. 앱의 **연결 및 이용 안내 → Google 계정으로 시작**을 누릅니다. `OWNER_EMAIL`과 일치하는 검증된 Google 이메일만 통과합니다. 다른 사람은 AI 호출이나 내 Google 계정 저장 기능을 사용할 수 없습니다.

테스트 상태의 OAuth는 재동의가 필요할 수 있습니다. 연결이 만료되면 다시 로그인합니다. Classroom은 별도의 ‘Classroom 권한 연결’을 누릅니다.

## 4. API 키 연결

Cloudflare Worker의 **Settings → Variables and Secrets**에 입력합니다. 웹앱 브라우저 소스·GitHub·일반 Variables에 키를 넣지 마세요. 키는 반드시 Secret으로 지정합니다. 로컬 `.env`에 있는 키는 자동으로 클라우드에 복사되지 않습니다.

### Gemini — 결제 미연결 Free Tier만

1. [Google AI Studio API Keys](https://aistudio.google.com/api-keys)에서 **결제가 연결되지 않은 Free Tier 프로젝트**로 키를 발급합니다.
2. `GEMINI_API_KEY`를 Secret으로 추가합니다.
3. 해당 프로젝트가 Free Tier임을 확인한 뒤 일반 Variable `GEMINI_FREE_TIER_CONFIRMED`를 문자열 `true`로 바꿉니다. 기본값 `false`에서는 키가 있어도 Gemini 호출을 차단합니다.
4. 기본 모델은 `gemini-flash-latest`입니다. Google이 변경하는 최신 Flash 별칭이므로 Free Tier 지원 여부도 달라질 수 있습니다. 미지원·할당량 오류가 나면 중단하며 GPT로 자동 전환하지 않습니다.

앱은 키만으로 Google 프로젝트의 결제 상태를 판별할 수 없습니다. 확인 스위치는 실제 결제 상태를 바꾸지 않습니다. 무료 한도 초과 시 멈추게 하려면 반드시 **결제 미연결 프로젝트**를 유지하세요. [Gemini 요금·무료 조건](https://ai.google.dev/gemini-api/docs/pricing)

### GPT — 선택할 때만 유료

1. [OpenAI API Keys](https://platform.openai.com/api-keys)에서 키를 발급합니다.
2. `OPENAI_API_KEY`를 Cloudflare Secret으로 추가합니다.
3. 기본 모델은 **`gpt-6-luna`**입니다. 브라우저가 다른 모델을 보내도 서버 설정을 적용합니다. AI 생성에서 GPT를 직접 선택했을 때만 호출합니다.
4. 앱의 AI 요청은 두 제공자를 합쳐 하루 20회, 한 번에 1건, 출력 최대 12,000토큰입니다. 이것은 횟수 제한이며 **월 10달러 하드 차단 기능은 아닙니다**. OpenAI 프로젝트 예산은 알림형일 수 있으므로 결제·잔액·사용량을 별도로 확인하세요. [API 요금](https://openai.com/api/pricing/) · [사용량](https://platform.openai.com/usage)

설정 후 페이지를 새로고침하면 키의 설정 여부만 표시됩니다. 키 값은 브라우저로 전달하지 않습니다. 실제 호출 성공은 별도의 생성 요청으로 확인합니다.

## 5. 바로 쓰는 순서

1. 예시 갤러리에서 양식을 선택하고 ‘이 예시로 시작’을 누릅니다.
2. 제목·내용·디자인을 바꿔 미리 봅니다. 여기까지 AI 비용이 없습니다.
3. ‘한글 내려받기’는 브라우저의 Kordoc으로 HWPX를 만듭니다. 서버나 AI에 문서 원본을 보내지 않습니다.
4. 새 AI 초안이 필요할 때만 Gemini 또는 GPT를 선택합니다. 해당 요청·초안은 선택한 AI 제공자에게 전송됩니다.
5. Google 저장은 미리 검토한 후 실행합니다. Google Docs·Sheets·Slides·Forms에 실제 편집 가능한 파일을 만듭니다.
6. 다른 컴퓨터에서는 같은 URL로 접속해 본인 Google 계정으로 로그인합니다. 작성 중인 초안은 자동 동기화되지 않으므로 ‘편집본 보관’ JSON 파일을 옮겨 이어서 작업합니다.

## 6. 알아둘 차이

- 예시와 문서 변환 화면은 공개 접근 가능합니다. Google 계정·API 키·작업 기록은 본인 로그인으로 보호됩니다.
- 브라우저 탭을 닫으면 진행 중인 변환·Google 저장이 중단될 수 있습니다. 저장 중 창을 닫지 마세요. 중단됐다면 최근 작업과 Google Drive에서 생성 여부를 먼저 확인합니다.
- 원본 문서는 20MB 이하, 압축 해제 크기와 처리 시간도 제한합니다. 브라우저 메모리가 부족하면 더 작은 문서를 사용합니다.
- 한글 서식 보존은 원본 구조에 따라 차이가 있습니다. PDF/OCR·운영체제의 한글 프로그램 자동화는 이 웹앱의 기능이 아닙니다.
- Google Forms의 테마 복사는 접근 가능한 설문 원본 ID를 `FORMS_TEMPLATE_ID`에 설정합니다.
- 로그인 세션은 8시간, 저장 작업 기록은 최대 7일 보관하며 만료 데이터는 정리합니다. 기록 삭제는 Google 파일 삭제를 의미하지 않습니다.
- D1에는 Google 토큰과 작업 내용을 AES-GCM으로 암호화해 저장합니다. 키 `APP_SECRET`은 설치 도우미가 생성합니다. 이를 변경하면 기존 세션·기록을 읽지 못하게 됩니다.

## 7. 개발 검증

```sh
npm run cloud:check
npm run test:cloud
npm run cloud:dev
# 별도 터미널
npm run test:cloud:browser
```

자동 테스트는 실제 Kordoc 브라우저 변환, Workers 인증·CSRF·D1 원자적 처리·무료 Gemini 차단·고정 GPT 모델을 검증합니다. 실제 AI 요청과 Google 저장은 모의 응답으로 검증하므로 실제 웹 OAuth 설정 후 본인 계정에서 연결을 확인해야 합니다.
