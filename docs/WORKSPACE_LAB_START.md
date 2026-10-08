# Workspace Lab — 직접 해야 할 설정

Google 도구로 배우고 일하고 일상을 준비하는 독립 웹앱입니다. Google이 운영하거나 보증하는 서비스는 아닙니다.

**[API 키 상세 설정·비용 안내로 바로 이동](#api-keys)**

## 먼저 구분하세요

| 원하는 일 | 필요한 준비 |
| --- | --- |
| 완성 예시 12개 보기·HWPX/Markdown/JSON 다운로드 | 앱 실행만. 로그인·AI 키 불필요 |
| 개인용에서 예시 수정·한글 문서 변환 | 앱 실행만. AI 키 불필요 |
| 내 Google 계정에 Docs·Slides·Sheets·Forms 만들기 | Google 계정 연결 |
| Gemini로 새로운 초안 만들기 | 운영자의 Gemini API 키 |
| GPT로 개선안 비교·적용 | 선택적으로 OpenAI API 키 |
| 여러 사람이 각자 로그인해서 쓰는 웹앱 | HTTPS 서버, PostgreSQL, Google Web OAuth |

배포용에서도 **kordoc 한글 문서 기능을 사용할 수 있습니다.** 배포용의 사용자 파일 변환·생성은 Google 로그인 후 서버에서 실행됩니다. 공개 갤러리의 준비된 파일은 로그인 없이 받을 수 있습니다. 기존 MCP도 별도로 계속 사용할 수 있습니다.

## A. 내 컴퓨터에서 사용하기

### 1. 프로젝트 폴더를 엽니다

Codex의 이 프로젝트 터미널을 사용하면 이미 올바른 폴더입니다. 다른 터미널이면 Finder에서 `edu-workspace-mcp` 폴더를 터미널로 끌어온 뒤 `cd`로 이동하세요. `package.json`이 보이는 폴더가 맞습니다.

처음 설치하는 컴퓨터는 Node.js 22 이상을 설치하고 아래 명령을 실행합니다. 현재 개발 컴퓨터는 이미 의존성이 설치되어 있습니다.

```sh
npm ci
```

### 2. 학습에 사용하지 않는 AI API를 준비합니다

기존 `.env`는 덮어쓰지 않습니다. 파일이 없을 때만 `.env.example`을 복사합니다. Google Workspace 자료를 보내려면 공급자의 학습 비활성 정책과 설정을 먼저 확인합니다.

- OpenAI API: API 키를 `OPENAI_API_KEY`에 넣고 조직 Data controls → Sharing의 피드백·평가·입출력 공유를 모두 Disabled로 확인한 후 `OPENAI_NO_TRAINING_CONFIRMED=true`를 설정합니다. ChatGPT 구독과 별도인 API 사용량 과금이 발생합니다.
- Gemini: 무료 서비스는 차단됩니다. 학습에 사용하지 않는 Paid Service 적용을 확인한 경우에만 `GEMINI_API_KEY`와 `GEMINI_NO_TRAINING_CONFIRMED=true`를 설정합니다. 앱은 자동으로 결제 연결이나 유료 전환을 하지 않습니다.
- API를 연결하지 않아도 예시 편집과 문서 변환은 계속 사용할 수 있습니다.

[OpenAI API 데이터 정책](https://developers.openai.com/api/docs/guides/your-data) · [Gemini 데이터 조건](https://ai.google.dev/gemini-api/terms)

### 3. 앱을 실행합니다

```sh
npm run web:dev
```

[개인용 앱 열기](http://127.0.0.1:3210/) → 왼쪽 **연결 및 이용 안내**에서 사용할 AI의 정책 확인 및 키 설정 상태를 확인합니다. `.env` 변경은 서버를 다시 시작해야 적용됩니다. 터미널에서 실행 중인 서버를 `Control + C`로 종료한 다음 `npm run web:start`를 실행하세요. 한 번에 하나의 서버만 3210 포트에서 실행합니다.

### 4. Google을 연결합니다

설정 화면이 `Google 연결됨`이면 바로 사용할 수 있습니다. 연결이 필요할 때 별도 터미널에서:

```sh
npm run cli -- login
```

브라우저에서 본인 계정으로 연결한 뒤 앱을 새로고침합니다. 기존 MCP 로그인 토큰을 재사용합니다. 이 명령이 OAuth 클라이언트 설정을 요구하면 저장소 README의 Google Cloud 초기 설정을 먼저 완료하세요.

### 5. 첫 결과물을 확인합니다

1. **예시 갤러리 → 작은 독서 모임, 함께 시작하기**를 엽니다.
2. 오른쪽 **이 예시로 시작**을 누릅니다.
3. 제목과 본문을 바꾸고 **미리보기**를 확인합니다.
4. **Google에 저장 → 새 파일 만들기**를 눌러 본인 Drive에 생성합니다. 또는 HWPX로 내려받습니다.
5. 새 AI 초안을 시험하려면 요청을 적고 개인정보 확인 후 **AI 초안 만들기**를 누릅니다.

GPT는 필요할 때만 `.env`의 `OPENAI_API_KEY`에 본인 API 키를 입력하고 서버를 다시 시작합니다. 연결 후 **GPT로 초안 다듬기**에서 기존 초안과 개선안을 비교하고 적용할 수 있습니다. API 비용과 이용 한도는 해당 API 계정에 적용됩니다.

## B. 다른 사람들에게 웹앱 공개하기

이 단계는 운영자가 한 번 합니다. 일반 이용자는 API 키나 프로그램 설치 없이 앱 주소에서 Google 로그인으로 사용합니다. 아래 경로는 제공된 Cloud Run 배포 스크립트를 기준으로 합니다. 서버·DB 요금은 AI 무료 등급과 별개입니다.

### 1. 운영용 Google Cloud 프로젝트와 계정을 정합니다

[Google Cloud 콘솔](https://console.cloud.google.com/)에서 프로젝트를 만들거나 선택하고 **프로젝트 ID**를 기록합니다. 결제 계정을 연결하고 예산 알림을 설정합니다. 프로젝트 이름과 ID는 다를 수 있습니다.

콘솔의 **API 및 서비스 → 라이브러리**에서 다음 API를 활성화합니다.

- Cloud Run Admin API, Cloud Build API, Artifact Registry API, Secret Manager API
- Google Drive API, Google Docs API, Google Sheets API, Google Slides API, Google Forms API
- Classroom 기능을 공개할 경우 Google Classroom API

**IAM 및 관리자 → 서비스 계정 → 서비스 계정 만들기**에서 `workspace-lab-runtime`을 만듭니다. 역할은 다음 시크릿 단계에서 필요한 권한만 부여합니다. 계정 이메일을 기록합니다.

### 2. PostgreSQL을 준비합니다

사용할 관리형 PostgreSQL 서비스에서 전용 데이터베이스와 사용자를 생성합니다. 연결 안내 화면의 PostgreSQL 연결 문자열을 복사합니다.

```text
postgresql://사용자:암호@호스트:5432/데이터베이스?sslmode=require
```

Cloud Run에서 연결 가능한 주소와 TLS 설정을 사용해야 합니다. 위 형태는 예시이며 제공자가 발급한 실제 연결 문자열을 사용하세요. 특수문자가 있는 암호는 URL 인코딩된 연결 문자열을 사용합니다. 사용자는 이 앱의 `edu_web_state` 테이블·인덱스를 생성하고 읽고 쓸 권한이 필요합니다. 앱이 첫 연결 때 테이블을 준비하므로 별도 수동 마이그레이션은 필요하지 않습니다.

현재 배포 스크립트는 직접 연결 가능한 DB 주소를 전제로 합니다. Cloud SQL의 비공개 IP를 선택하면 별도의 VPC/Cloud SQL 연결 설정이 필요합니다. DB의 지역, 백업 보관과 삭제 정책도 운영 기록에 남깁니다.

### 3. Google 로그인용 웹 클라이언트를 만듭니다

1. 콘솔 **Google Auth Platform → Branding**에서 앱 이름을 `Workspace Lab`, 지원 이메일을 본인 문의처로 입력합니다.
2. **Audience**는 학교 밖 사람도 사용할 수 있도록 `External`로 준비합니다. 처음에는 테스트 상태로 두고 시험할 Google 계정을 Test users에 등록합니다.
3. **Clients → Create client → Web application**을 선택합니다. 기존 MCP의 Desktop 클라이언트와 별개로 만듭니다.
4. 고정 도메인이 이미 있으면 승인된 리디렉션 URI에 `https://앱주소/auth/callback`을 등록합니다. Cloud Run 주소를 처음 발급받는다면 일단 클라이언트를 만든 뒤 6단계에서 실제 URI를 추가합니다.
5. **클라이언트 ID**와 **클라이언트 보안 비밀번호**를 기록합니다.

기본 로그인은 `openid`, `email`, `drive.file`을 요청합니다. Classroom 연결 시에만 `classroom.courses.readonly`, `classroom.coursework.students`를 추가 요청합니다. **Data Access**에 요청 범위를 등록하고 공개 전 필요한 검증 절차를 진행합니다. 홈페이지는 실제 앱 주소, 개인정보 안내는 `https://앱주소/privacy`입니다. [Google 웹 OAuth 공식 안내](https://developers.google.com/identity/protocols/oauth2/web-server).

### 4. 비밀값을 Secret Manager에 넣습니다

콘솔 **보안 → Secret Manager → 보안 비밀 만들기**에서 아래 이름을 정확히 사용해 각각 저장합니다. 앱 키는 다음 명령으로 한 번 생성하고 안전하게 보관합니다.

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

| 보안 비밀 이름 | 넣을 값 |
| --- | --- |
| `edu-app-secret` | 위 명령의 난수 문자열 |
| `edu-database-url` | 2단계 PostgreSQL 연결 문자열 |
| `edu-google-client-id` | Web OAuth 클라이언트 ID |
| `edu-google-client-secret` | Web OAuth 클라이언트 보안 비밀번호 |
| `edu-gemini-key` | Gemini API 키 |
| `edu-openai-key` | 선택: GPT API 키 |

각 보안 비밀의 **권한 → 액세스 권한 부여**에서 1단계 런타임 서비스 계정 이메일에 **Secret Manager Secret Accessor** 역할을 부여합니다. 비밀값은 `.env`와 별도로 관리하며 배포 파일이나 브라우저 코드에 입력하지 않습니다.

### 5. 첫 배포를 실행합니다

프로젝트 터미널에서 `gcloud auth login`으로 운영 계정에 로그인합니다. 아래 따옴표 안을 본인 값으로 바꾸어 실행하세요. 시험 사용자 이메일은 쉼표로 구분합니다.

```sh
export GOOGLE_CLOUD_PROJECT='본인-프로젝트-ID'
export WEB_SERVICE_ACCOUNT='workspace-lab-runtime@본인-프로젝트-ID.iam.gserviceaccount.com'
export WEB_SERVICE='workspace-lab'
export WEB_APP_ORIGIN='https://setup.invalid'
export WEB_ALLOWED_EMAILS='본인이메일@example.com'
export WEB_OPERATOR='운영자 이름 또는 기관명'
export WEB_SUPPORT_EMAIL='문의용이메일@example.com'
bash scripts/deploy-web.sh
```

`https://setup.invalid`는 **최초 주소 발급용 임시 설정**입니다. 이 상태에서 로그인이나 앱 사용을 시도하지 말고 바로 다음 단계를 완료하세요. 최종 연결된 도메인이 있으면 처음부터 그 HTTPS 주소를 사용해도 됩니다.

배포 계정에는 Cloud Run 소스 배포·빌드와 서비스 계정 사용 권한이 필요합니다. 권한 오류가 나면 오류에 명시된 계정과 권한을 프로젝트 관리자에게 전달하세요. [공식 소스 배포 안내](https://docs.cloud.google.com/run/docs/deploying-source-code).

### 6. 실제 주소를 연결합니다

배포 결과의 `Service URL`을 복사합니다. 또는:

```sh
gcloud run services describe workspace-lab --project "$GOOGLE_CLOUD_PROJECT" --region asia-northeast3 --format='value(status.url)'
```

1. 아래 `실제주소`를 복사한 URL로 바꾸고 다시 배포합니다. URL 끝에 `/`를 붙이지 않습니다.

```sh
export WEB_APP_ORIGIN='https://실제주소'
bash scripts/deploy-web.sh
```

2. Google Auth Platform의 Web 클라이언트에서 승인된 리디렉션 URI를 `https://실제주소/auth/callback`으로 등록합니다. `APP_ORIGIN`과 같은 호스트여야 합니다.
3. Branding의 홈페이지와 개인정보 안내 주소를 실제 주소와 `/privacy`로 갱신합니다.
4. 앱 주소를 열어 시험 계정으로 로그인하고 Docs/Slides/Sheets/Forms 저장과 HWPX 업로드·다운로드를 각각 시험합니다.
5. 공개 전 `src/web/privacy.ts`의 안내에 운영자의 실제 호스팅/DB 지역과 백업 정책을 반영하고 재배포합니다.

GPT까지 제공하려면 `edu-openai-key`를 만든 뒤 `export WEB_ENABLE_GPT=1`을 추가하고 같은 스크립트를 실행합니다. 비밀값을 바꾸었을 때에도 새 버전을 저장한 후 재배포합니다.

### 7. 모든 이용자에게 공개합니다

시험을 마치고 Google OAuth의 공개·검증 요건을 충족한 뒤 Audience에서 프로덕션으로 전환합니다. 학교·회사 관리 계정은 해당 조직의 앱 허용 정책을 따릅니다.

앱의 시험 이메일 제한도 해제해야 합니다. 이 명령은 Google OAuth의 테스트 제한을 대신 해제하지 않습니다.

```sh
export WEB_PUBLIC_ACCESS=1
export WEB_ALLOWED_EMAILS=''
bash scripts/deploy-web.sh
```

이제 앱 주소를 공유합니다. 공개 예시 갤러리는 로그인 없이 접근하고, 각 이용자는 자기 Google 계정으로 자료를 저장합니다. AI 비용은 운영자가 설정한 API 계정에 합산됩니다. 사용자당 AI 20회/일과 서버 최대 3개 인스턴스가 기본 설정입니다. 운영 계정의 사용량과 예산 알림도 확인하세요.

## 막히면 확인할 곳

| 증상 | 확인·조치 |
| --- | --- |
| Gemini 연결 필요 | `.env` 키 저장 후 서버 재시작. 배포는 Secret Manager와 새 리비전 확인 |
| AI 429 오류 | 제공자 무료 사용량·속도 한도 확인. 잠시 후 시도하거나 예시 직접 편집 |
| `redirect_uri_mismatch` | Web 클라이언트의 승인 URI가 앱 주소 + `/auth/callback`과 정확히 같은지 확인 |
| Google 로그인이 제한됨 | OAuth Test users와 앱의 ALLOWED_EMAILS 양쪽 확인 |
| DB 연결 실패 | 연결 문자열·비밀번호·TLS·방화벽·테이블 생성 권한 확인 |
| `허용되지 않은 앱 주소` | APP_ORIGIN을 실제 접속 주소로 맞춰 재배포 |
| 포트 3210 사용 중 | 이미 실행 중인 개인용 앱이 있는지 확인. 기존 서버 종료 후 재실행 |
| 한글 파일 배치가 달라짐 | 본문·표 재구성 방식의 한계. 원본 서식 유지 수정 또는 한글에서 최종 편집 |

설치·배포 설정을 입력하는 것은 운영자 작업입니다. 일반 사용자는 **예시 선택 → 내용 편집 → 저장**만 하면 됩니다.


## C. 결과물 디자인과 Forms 양식 연결

### 디자인 선택

예시 갤러리 또는 작성 화면의 **결과물 디자인**에서 클래식 리포트·모던 워크스페이스·웜 에디토리얼을 고릅니다. 미리보기로 확인한 뒤 Google 저장 또는 HWPX 다운로드를 실행합니다. 갤러리의 바로 다운로드 파일은 클래식 리포트로 준비되어 있습니다.

- Docs: 제목 위계, 강조 상자, 음영 표, 인쇄 여백과 반복 머리행.
- Sheets: 대시보드·실행 보드, 자동 집계와 도넛 차트, 상태 선택·조건부 색상·필터.
- Slides: 표지와 내용 카드, 일관된 색상·글꼴·쪽 번호. 긴 본문은 여러 장으로 분리.
- Forms: 구역과 문항 번호, 정답·배점·오답 해설. 색상·글꼴은 Forms 테마 또는 원본 양식을 사용.
- HWPX: kordoc 보고서 서식, 표 음영·테두리·열 너비·글꼴, 제목 띠와 쪽 설정. Google Docs와 한글은 조판 방식이 달라 줄바꿈·쪽 배치가 같지는 않습니다. 한글에서 배포 전 확인하세요.

### Forms를 예쁜 원본 양식으로 반복 생성하기

Google Forms API는 테마 색상·글꼴·머리글을 직접 지정하는 기능을 제공하지 않습니다. 한 번 원본을 꾸며 두면 이후 복제해서 사용할 수 있도록 연결 기능을 넣었습니다.

1. 본인 Google Drive에서 빈 Google 설문지를 하나 만들고 `Workspace Lab 디자인 원본`으로 이름을 정합니다.
2. 우측 상단 팔레트 아이콘 **테마 맞춤설정**을 엽니다.
3. 앱의 퀴즈 편집 화면에서 **Forms 머리글 이미지 받기**를 눌러 받은 PNG를 Forms의 **머리글 → 이미지 선택 → 업로드**에 넣습니다.
4. 테마 색상과 배경·글꼴을 정합니다. 클래식 리포트는 남색 `#18324F`와 옅은 배경을 권장합니다.
5. 원본 설문지의 편집 주소 `https://docs.google.com/forms/d/여기가ID/edit`에서 ID만 복사합니다.
6. 개인용 `.env`에 다음 줄을 추가하고 서버를 다시 시작합니다.

```dotenv
GOOGLE_FORMS_TEMPLATE_ID=여기에원본설문지ID
```

7. 앱에서 퀴즈를 Google에 저장합니다. 원본 테마를 가진 **새 복사본**에 현재 문항을 넣습니다. 원본 설문지는 바꾸지 않습니다. 복사본의 응답 설정과 공개 상태는 공유 전에 확인하세요.

배포 스크립트를 쓰면 `export WEB_FORMS_TEMPLATE_ID=여기에원본설문지ID`를 추가하고 배포합니다. 다만 각 로그인 사용자가 해당 원본에 접근하고 앱이 이를 복사할 권한이 있어야 합니다. 기본 `drive.file` 권한에서는 링크를 알고 있다는 이유만으로 임의 파일에 접근하지 못합니다. 먼저 운영 계정으로 검증하고 권한이 없는 공개 사용자에게는 원본 연결 없이 기본 Forms 생성 방식을 사용하세요. 여러 사용자 운영 시 공통 원본 권한 구성은 별도 검증이 필요합니다.

테마가 없는 경우에도 문항·배점·해설은 생성됩니다. 위 설정을 생략하면 앱이 지원하지 않는 색상 자동 적용을 했다고 표시하지 않습니다.

## D. API 키 상세 설정과 비용

2026-09-27 공식 문서 확인 기준입니다. 화면 이름과 가격·무료 한도는 공급자가 변경할 수 있습니다.

### 어디에 넣나요?

현재 프로젝트에서 **package.json과 같은 폴더의 `.env` 파일**에 넣습니다. `.env.example`은 설명용 견본입니다. 현재 컴퓨터에는 `.env`가 이미 있으므로 복사하거나 덮어쓰지 말고 필요한 줄만 수정합니다.

1. Codex에서 이 프로젝트의 터미널을 엽니다.
2. 아래 명령으로 macOS 텍스트 편집기에서 엽니다.

```sh
open -e .env
```

Finder에서는 프로젝트 폴더를 연 뒤 **Command + Shift + .**를 눌러 숨김 파일을 표시하면 `.env`가 보입니다. 파일 이름은 `.env.txt`가 아닌 `.env`여야 합니다. 키를 앱의 요청 입력란이나 채팅에 붙여 넣지 마세요.

### Gemini: 학습 없는 Paid Service만 허용

무료 서비스의 원본·집계·파생 데이터가 모델 학습·개선에 사용될 수 있어 Workspace Lab에서는 무료 Gemini 호출을 차단합니다. `GEMINI_FREE_TIER_CONFIRMED=true`는 과거 설정이며 활성화 조건이 아닙니다.

Paid Service 적용과 학습 비사용 정책을 운영자가 확인한 경우에만 아래 설정을 사용합니다. 확인 값은 실제 결제 상태를 변경하지 않습니다. 사용료가 발생할 수 있으며 결제·모델·사용량은 운영자가 확인합니다. 현재 개인용 웹 배포에서는 Gemini를 비활성화합니다.

```dotenv
GEMINI_API_KEY=확인된_Paid_Service_키
GEMINI_MODEL=gemini-flash-latest
GEMINI_NO_TRAINING_CONFIRMED=true
AI_DAILY_LIMIT=20
```

[공식 데이터 이용 조건](https://ai.google.dev/gemini-api/terms) · [현재 요금표](https://ai.google.dev/gemini-api/docs/pricing)

### OpenAI: 선택적으로 유료 작성 기능 연결하기

1. [OpenAI API Platform](https://platform.openai.com/)에 로그인합니다. ChatGPT 앱 설정의 입력란이 아니라 API 개발자 대시보드를 사용합니다.
2. 프로젝트 메뉴에서 `Workspace Lab` 전용 프로젝트를 만들거나 사용할 프로젝트를 선택합니다.
3. **Settings → Organization → Billing**에서 결제 수단을 등록합니다. 선불 방식이 표시되면 화면에서 요구하는 최소 충전액을 확인하고 작은 금액으로 시작합니다. 자동 충전이 필요 없으면 Auto recharge를 끕니다. 비용은 API 계정의 사용량에 따라 청구됩니다.
4. [API keys](https://platform.openai.com/api-keys)에서 **Create new secret key**를 누릅니다. 이름은 `workspace-lab-local`, 프로젝트는 위에서 선택한 것으로 지정합니다. 권한을 제한한다면 Responses 생성 요청을 허용해야 합니다.
5. 표시된 비밀 키를 복사해 `.env`의 `OPENAI_API_KEY=` 뒤에 붙여 넣습니다. 비밀 키를 다시 볼 수 없으면 새 키를 발급합니다.
6. API 조직의 Data controls → Sharing에서 피드백·평가·입출력 공유가 모두 Disabled인지 확인한 후 아래처럼 설정합니다. `store=false`만으로 학습 비활성이나 Zero Data Retention을 보장하지 않습니다.

```dotenv
OPENAI_API_KEY=여기에_발급받은_실제_키
OPENAI_MODEL=gpt-6-luna
OPENAI_NO_TRAINING_CONFIRMED=true
```

앱은 비용을 우선해 `gpt-6-luna`를 기본으로 사용합니다. 결과 품질을 비교한 뒤 `OPENAI_MODEL=gpt-6-sol`로 바꿀 수 있습니다. Gemini만 쓸 때는 `OPENAI_API_KEY=`를 비워 둡니다. Gemini 실패 때문에 GPT가 자동 호출되는 일은 없습니다. 사용자가 GPT를 선택해 생성하거나 **GPT로 초안 다듬기**를 눌렀을 때 호출됩니다.

### OpenAI 비용은 얼마나 드나요?

표준 텍스트 API의 **100만 토큰당 달러 요금**, 캐시 할인 없이 계산한 예입니다. 토큰은 글자 수와 같지 않으며 한국어·JSON·지시문·이전 초안·교육과정 자료도 입력량에 포함됩니다.

2026-09-27 확인한 Standard 짧은 컨텍스트 요금입니다.

| 모델 | 입력 100만 토큰 | 출력 100만 토큰 | 입력 3,000 + 과금 출력 2,000 토큰, 1회 | $10 예산 예상 횟수 |
| --- | ---: | ---: | ---: | ---: |
| GPT-6 Luna — 앱 기본값 | $0.10 | $0.50 | $0.0013 | 약 7,692회 |
| GPT-6 Sol — 품질 비교 후 선택 | $2.00 | $10.00 | $0.026 | 약 384회 |
| GPT-6 Astra | $10.00 | $50.00 | $0.13 | 약 76회 |

계산식은 `(입력 토큰 × 입력 단가 + 출력 토큰 × 출력 단가) ÷ 1,000,000`입니다. 출력에는 내부 추론 토큰도 포함됩니다. 위 분량은 설명용 가정이며 문서 한 건의 확정 가격이 아닙니다. 긴 수업 패키지·여러 번 다듬기·재시도는 사용량을 늘립니다. 캐시·별도 도구 비용·세금·환율·카드 수수료는 계산에서 제외했습니다. $10 한도는 충전 잔액과 별개입니다.

[공식 요금](https://developers.openai.com/api/docs/pricing) · [모델 선택](https://developers.openai.com/api/docs/models) · [추론 토큰](https://developers.openai.com/api/docs/guides/reasoning).

**지출 제한:** Project settings → Limits → Spend → Edit spend limit에서 월 한도를 설정하고, 실제 요청 중단을 원하면 **Enforce a hard limit**을 켭니다. Spend alerts만 설정하면 알림만 보내고 호출은 계속됩니다. 한도 반영 지연으로 소액 초과가 가능하므로 [공식 지출 제한 안내](https://developers.openai.com/api/docs/guides/spend-limits)를 함께 확인하세요. 사용량은 [Usage](https://platform.openai.com/usage)에서 확인합니다.

### 저장한 다음 적용하는 순서

1. `.env`를 저장합니다.
2. 직접 서버를 실행 중인 터미널에서 **Control + C**로 종료합니다.
3. 같은 프로젝트 폴더에서 아래 명령을 실행합니다.

```sh
npm run web:start
```

4. [연결 및 이용 안내](http://127.0.0.1:3210/#settings)를 새로고침합니다. **키 설정됨**과 모델 이름을 확인합니다. 이 표시는 서버가 키를 읽었다는 뜻이며, 실제 인증·잔액·사용 가능 여부까지 검증했다는 뜻은 아닙니다.
5. [분수 학습지](http://127.0.0.1:3210/#create/worksheet)를 열고 정책 설정이 확인된 AI를 선택합니다. 요청을 짧게 적고 개인정보 확인 및 AI 전송 동의 후 **AI 초안 만들기**를 누릅니다. 실제 초안이 나오면 호출까지 성공한 것입니다.
6. 필요할 때만 GPT로 개선을 실행하고 기존 초안과 비교합니다.

`EADDRINUSE`가 나오면 기존 서버가 3210 포트에서 실행 중입니다. 두 번째 서버를 계속 실행하지 말고 원래 서버를 종료해야 합니다. Codex가 백그라운드에서 실행해 둔 서버라 터미널을 찾기 어렵다면, 키를 저장한 뒤 Codex에 “키 값은 읽지 말고 로컬 앱 서버만 다시 시작해 줘”라고 요청하면 됩니다.

429 오류는 무료/계정 한도·잔액·지출 제한 등을 공급자 화면에서 확인하세요. 400·401·403·404는 키 오타, 키 권한, 모델 접근·지원 여부를 확인합니다. 앱은 키 값을 화면이나 오류 로그에 출력하지 않습니다.

### 초등 학습 지도 사용하기

[예시 갤러리](http://127.0.0.1:3210/#examples)의 초등 자료는 여섯 학년의 서로 다른 주제로 준비했습니다. **예시로 시작 → 초등 수업 설정**에서 해당 학년·교과·성취기준이 함께 불러와집니다. 직접 생성할 때는 학년·교과를 고르고 성취기준을 검색해 선택하세요.

[korean-elementary-learning-map-mcp](https://github.com/taehyeonglim/korean-elementary-learning-map-mcp) 0.5.1의 성취기준 620개에 더해, 학습 주제 1,956개·선수관계 1,894개를 로컬 데이터로 연동했습니다. 연결된 관찰 증거·평가 발문·선수 학습이 AI의 수업 설계 참고 자료로 전달됩니다. 별도 MCP 서버를 띄우거나 추가 API 키를 발급할 필요가 없습니다. 세부 주제와 학습 순서는 원천 데이터 제작자의 참고 설계이며 공식 수업 순서가 아닙니다.
