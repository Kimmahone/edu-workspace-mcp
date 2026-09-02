# edu-workspace-mcp 구현 계획

## 1. 목표와 첫 번째 성공 기준

이 프로젝트의 목적은 Apps Script를 대체하는 범용 자동화 엔진이자, 누구나 AI 클라이언트에서 설치해 쓸 수 있는 **공개 Google Workspace for Education MCP**를 만드는 것이다. 우선은 교육 자료를 만들고 Google Classroom에 안전하게 게시하는 반복 작업을 가장 잘 해결한다.

일반 Google Workspace 도구(Drive, Docs, Sheets, Slides, Forms)를 폭넓게 지원하되, Classroom 수업·학습지·퀴즈·루브릭·과제 게시처럼 교육자에게 중요한 작업에는 더 높은 수준의 목적형 도구와 안내를 제공한다.

### MVP 사용자 시나리오

교사가 MCP 클라이언트에 다음처럼 요청한다.

> `소화와 순환` 단원의 5문항 퀴즈, 한 장짜리 학습지, 6장 분량의 수업 슬라이드를 만들고 `2학년 과학` 수업에 금요일 18시 마감 과제로 게시해 줘.

서버는 다음 작업을 수행한다.

1. 교사가 접근할 수 있는 Classroom 수업을 찾아 선택한다.
2. Drive에 Forms·Docs·Slides 파일을 생성한다.
3. Forms를 퀴즈로 전환하고 문항, 정답, 배점을 입력한다.
4. Classroom 과제의 초안을 생성하고 파일을 첨부한다.
5. 게시 직전 제목, 수업, 마감, 첨부 파일, 공유 설정을 미리 보여 준 뒤 사용자 승인을 받아 게시한다.

### MVP 완료 조건

- 개인 Google 계정과 Google Workspace for Education 계정에서 OAuth 로그인이 된다.
- Docs, Sheets, Slides, Forms 중 최소 3개를 생성할 수 있다.
- 교사 권한 계정으로 수업 목록을 읽고 과제를 **초안 상태**로 만들 수 있다.
- 별도 승인 없이는 `PUBLISHED` 상태의 과제, 파일 공유 권한 변경, 이메일 발송을 하지 않는다.
- 각 변경 작업이 만든 파일 ID/URL과 실행 결과를 구조화된 JSON으로 반환한다.

## 2. 범위 결정

### v0.1에 포함

| 영역 | 기능 |
| --- | --- |
| 인증 | 로컬 OAuth 2.0, 암호화 가능한 토큰 저장, 필요 시 재인증 |
| Drive | 폴더 조회·생성, 생성 파일의 URL·ID 반환 |
| Docs | 빈 문서 생성, 제목·본문·표 삽입 |
| Sheets | 시트 생성, 범위 값 입력, 기본 서식·수식 적용 |
| Slides | 프레젠테이션 생성, 슬라이드·텍스트 상자 생성 |
| Forms | 폼 생성, 퀴즈 전환, 객관식·단답형 문항 생성 |
| Classroom | 수업 검색, 과제 초안 생성, Drive 자료 첨부, 게시 |
| 안전성 | 읽기/쓰기 분리, 게시·공유 전 명시적 확인 |

### v0.1에서 제외

- 학생 명단 수정, 성적 입력, 보호자 정보 및 제출물 원문 처리
- Gmail 발송, Calendar 등록, 자동 트리거·예약 실행
- 도메인 전체 위임(Service Account domain-wide delegation)
- 웹 대시보드와 멀티테넌트 SaaS 배포
- 복잡한 디자인 자동화, 이미지 생성, 완전한 Google Slides 편집기

이 기능들은 개인정보와 되돌리기 어려운 변경 범위가 훨씬 크므로, 안정적인 생성·과제 게시 흐름을 검증한 뒤에 추가한다.

## 3. 권장 아키텍처

제품은 하나의 도구 계약과 Google API 어댑터를 공유하고, 두 가지 전송 방식을 제공한다.

- **로컬 stdio 패키지**: Claude Desktop, Codex, ChatGPT Desktop, Cursor 등 로컬 MCP 클라이언트용. `npx`로 실행되며 사용자의 토큰은 해당 컴퓨터에만 보관한다.
- **호스팅된 Streamable HTTP 서비스**: ChatGPT 웹과 향후 조직 배포용. MCP 서버 로그인과 Google 계정 연결을 각각 OAuth로 처리하고, 토큰은 암호화해 서버에 보관한다.

이중 구조는 “모든 OS에서 간단히 설치”와 “브라우저 기반 AI에서도 사용”을 동시에 만족한다. 웹 AI는 사용자 컴퓨터의 stdio 프로세스를 실행할 수 없으므로, 원격 MCP 엔드포인트가 별도로 필요하다.

```text
MCP 클라이언트
    │ stdio (로컬) 또는 Streamable HTTP (원격)
    ▼
TypeScript MCP 서버 코어
    ├── Tool registry / 입력 검증 (Zod)
    ├── 승인 대기 작업 저장소 (SQLite / 원격은 Postgres)
    ├── Google OAuth 및 토큰 저장소 (로컬 키체인 / 원격 암호화 저장)
    ├── Google API 어댑터
    │   ├── Drive / Docs / Sheets / Slides / Forms
    │   └── Classroom
    └── 감사 로그 (민감 데이터 제외)
```

### 기술 선택

| 구분 | 선택 | 이유 |
| --- | --- | --- |
| 언어 | TypeScript, Node.js 20+ | MCP SDK·Google API 클라이언트와 자연스럽게 통합 |
| MCP | `@modelcontextprotocol/sdk` | 표준 도구 등록과 stdio 전송 지원 |
| Google API | `googleapis` | 공식 Node.js 클라이언트 |
| 검증 | Zod | 도구 입력을 명확한 스키마로 제한 |
| 로컬 저장소 | SQLite | 승인 대기 작업·감사 기록을 간단히 관리 |
| 원격 저장소 | PostgreSQL + KMS | 사용자별 OAuth 토큰·승인 기록을 암호화해 분리 보관 |
| 테스트 | Vitest + API 어댑터 mock | Google 계정 없이도 도구 규약 검증 |

## 4. 도구 설계 원칙

### 4.1 작고 예측 가능한 도구

도구 하나가 너무 많은 일을 하지 않도록 한다. 예를 들어 `prepare_lesson` 같은 거대한 도구보다 생성 도구와 연결 도구를 분리한다. LLM은 중간 결과의 파일 ID를 다음 도구에 전달할 수 있으므로 실패를 재시도하거나 일부만 고치기 쉽다.

### 4.2 읽기·초안·변경의 세 단계

| 단계 | 예시 | 기본 정책 |
| --- | --- | --- |
| 읽기 | `classroom_list_courses`, `drive_search_files` | 즉시 실행 |
| 초안/생성 | `forms_create_quiz`, `docs_create_document`, `classroom_create_assignment_draft` | 즉시 실행, 결과 URL 반환 |
| 외부 영향 변경 | `classroom_publish_assignment`, `drive_share_file`, 향후 `gmail_send` | 요약 확인 토큰 필요 |

`classroom_publish_assignment`는 이전 단계가 반환한 `approvalId`와 사용자가 확인한 요약을 받아야 실행한다. 이를 통해 단순히 “만들어줘”라는 요청이 바로 학생에게 게시되는 일을 막는다.

### 4.3 도구 목록

#### 탐색 도구

| 도구 | 핵심 입력 | 출력 |
| --- | --- | --- |
| `workspace_get_auth_status` | 없음 | 로그인 계정, 허용 스코프, 만료 여부 |
| `classroom_list_courses` | `query?`, `state?` | 수업 ID, 이름, 역할 |
| `drive_search_files` | `query`, `mimeType?`, `parentId?` | 파일 ID, 이름, URL |
| `drive_list_folders` | `parentId?` | 폴더 ID, 이름 |

#### 생성 도구

| 도구 | 핵심 입력 | 출력 |
| --- | --- | --- |
| `docs_create_document` | `title`, `blocks`, `parentFolderId?` | `documentId`, `url` |
| `sheets_create_workbook` | `title`, `sheets[]`, `parentFolderId?` | `spreadsheetId`, `url` |
| `slides_create_presentation` | `title`, `slides[]`, `theme?` | `presentationId`, `url` |
| `forms_create_quiz` | `title`, `questions[]`, `collectEmail?` | `formId`, `responderUrl`, `editUrl` |
| `classroom_create_assignment_draft` | `courseId`, `title`, `materials[]`, `dueAt?` | `courseWorkId`, `state: DRAFT`, `approvalId` |

#### 확정 도구

| 도구 | 핵심 입력 | 보호 장치 |
| --- | --- | --- |
| `classroom_publish_assignment` | `courseId`, `courseWorkId`, `approvalId` | 대상 수업·마감·첨부 목록을 다시 검증 |
| `drive_share_file` | `fileId`, `role`, `type`, `approvalId` | 공유 대상과 권한을 다시 검증 |

## 5. 인증과 권한 범위

### 5.1 인증 전략

1. 로컬 제품은 Google Cloud의 **Desktop OAuth client**를 사용한다.
2. 원격 제품은 HTTPS redirect URI를 가진 **Web OAuth client**를 사용한다. 이때 MCP 서버 로그인과 Google 계정 연결은 별도 세션으로 관리한다.
3. 최초 연결 시 동의를 받고, 갱신 토큰은 로컬에서는 OS 키체인 또는 암호화된 로컬 저장소에, 원격에서는 KMS로 암호화한 사용자별 저장소에 보관한다.
4. 토큰이 없거나 필요한 권한이 추가되면 incremental OAuth로 필요한 범위만 추가 요청한다.
5. `workspace_disconnect` 도구로 Google 연결을 끊고 토큰을 폐기할 수 있게 한다.

### 5.2 초기 요청 범위

MVP에서는 문서 생성과 교사가 자기 수업에 과제를 만드는 데 필요한 범위만 요청한다. 제출물·성적·학생 프로필·명단 읽기 권한은 요청하지 않는다.

| 목적 | 권장 범위 예시 |
| --- | --- |
| Drive 파일 생성·정리 | `https://www.googleapis.com/auth/drive.file` |
| Docs | `https://www.googleapis.com/auth/documents` |
| Sheets | `https://www.googleapis.com/auth/spreadsheets` |
| Slides | `https://www.googleapis.com/auth/presentations` |
| Forms 생성·수정 | `https://www.googleapis.com/auth/forms.body` |
| 수업 목록 조회 | `https://www.googleapis.com/auth/classroom.courses.readonly` |
| 교사 과제 생성·수정 | `https://www.googleapis.com/auth/classroom.coursework.me` |

> 실제 필요 범위는 각 API 호출과 계정 역할에 따라 재검증한다. Classroom API의 민감 범위와 교육기관의 제3자 앱 접근 제어 때문에, 학교 계정에서는 관리자 승인이 필요할 수 있다.

## 6. 프로젝트 구조

```text
src/
├── index.ts                       # 서버 시작·전송 방식 선택
├── server.ts                      # MCP 도구 등록
├── config.ts                      # 환경 변수·경로 검증
├── auth/
│   ├── oauth.ts                   # 로그인·토큰 갱신
│   ├── token-store.ts             # 키체인/암호화 저장소
│   └── scopes.ts                  # 기능별 권한 범위
├── google/
│   ├── client.ts                  # 인증된 googleapis client factory
│   ├── drive.ts
│   ├── docs.ts
│   ├── sheets.ts
│   ├── slides.ts
│   ├── forms.ts
│   └── classroom.ts
├── tools/
│   ├── schemas.ts                 # 모든 Zod 입력·출력 스키마
│   ├── discovery.ts
│   ├── content.ts
│   ├── classroom.ts
│   └── approvals.ts
├── approvals/
│   ├── service.ts
│   └── repository.ts
├── audit/
│   └── logger.ts
└── tests/
    ├── unit/
    └── integration/
```

Google API 호출은 `google/` 어댑터에만 둔다. `tools/`는 입력 검증, 권한 확인, 승인 흐름과 사용자 친화적 결과만 담당한다. 이 경계를 지키면 Google API의 요청 형식이 바뀌어도 MCP 도구 계약을 유지하기 쉽다.

## 7. 구현 단계와 일정

### 0단계 — 검증 환경 준비 (1~2일)

- Node.js, TypeScript, lint, 테스트 환경, `.gitignore` 설정
- Google Cloud **개발용** 프로젝트 생성
- 테스트용 Google Workspace for Education 도메인 또는 비실사용 테스트 수업 준비
- Docs·Sheets·Slides·Forms·Drive·Classroom API 활성화
- OAuth 동의 화면, 테스트 사용자, Desktop OAuth client 설정

**완료 기준:** 테스트 계정으로 로그인해 `workspace_get_auth_status`가 계정·허용 범위를 반환한다.

### 1단계 — 서버 기반과 인증 (2~3일)

- stdio MCP 서버 초기화와 `tools/list`, `tools/call` 확인
- Zod 기반 요청·응답 스키마
- OAuth 로그인, 토큰 저장·갱신·해제
- 오류 모델 정의: 인증 필요, 권한 부족, 관리자 차단, 잘못된 ID, API 할당량 초과

**완료 기준:** 새 셸에서도 토큰을 안전하게 다시 불러오며, 권한 부족 오류가 다음 행동을 안내한다.

### 2단계 — Drive와 기본 생성 도구 (3~4일)

- Drive 폴더 탐색·생성·검색
- Docs 본문/표 삽입
- Sheets 시트 생성·값 입력·기본 수식
- 모든 생성 결과에 ID, URL, MIME type, 부모 폴더를 일관되게 반환

**완료 기준:** 테스트 폴더에 학습지와 성적표 템플릿을 만들고 링크를 반환한다.

### 3단계 — Forms와 Slides (3~4일)

- Forms 생성 → `batchUpdate`로 퀴즈 설정 → 문항·정답·배점 추가
- Forms 응답자 URL과 편집 URL을 분리하여 반환
- Slides 생성, 제목/본문/목차 레이아웃 구현
- 입력 길이·문항 수·텍스트 길이 제한과 부분 실패 복구

**완료 기준:** 5문항 퀴즈 폼과 6장 수업 자료를 생성하며, 각 산출물을 다시 조회해 구조를 검증한다.

### 4단계 — Classroom 초안과 승인 게시 (3~5일)

- `classroom_list_courses`에서 사용자의 교사 수업만 명확히 표시
- 과제 초안(DRAFT) 생성과 Drive 첨부
- 승인 대기 레코드 생성: 수업, 제목, 마감, 첨부 파일, 요청 시각, 만료 시각
- 확인 토큰을 받은 경우에만 게시(PUBLISHED) 실행

**완료 기준:** 의도하지 않은 수업에는 과제가 게시되지 않고, 초안→승인→게시 전환이 감사 로그로 남는다.

### 5단계 — 품질·배포 준비 (3~5일)

- Google API 어댑터 mock 단위 테스트
- 별도 테스트 계정에서 통합 테스트
- 할당량·재시도·네트워크 오류 처리
- 설치 문서, 최소 권한표, 개인정보 처리·토큰 삭제 안내
- npm 패키지 또는 GitHub 배포 방식 결정

**완료 기준:** 깨끗한 새 컴퓨터에서 README만 따라 설치·로그인·자료 생성·초안 작성까지 재현한다.

**예상 기간:** 이 문서의 로컬 MVP는 1인 기준 3~4주다. 공개 배포와 원격 MCP까지 포함하면 아래의 공개 배포 로드맵을 추가로 진행한다.

## 8. 테스트 계획

| 수준 | 검증 대상 | 방법 |
| --- | --- | --- |
| 단위 테스트 | Zod 스키마, 날짜 변환, 승인 토큰, 오류 매핑 | Google API mock |
| 계약 테스트 | MCP 도구 이름·입력·출력 형식 | 고정된 JSON fixture |
| 통합 테스트 | Docs/Forms/Slides 생성, Classroom 초안 | 분리된 테스트 계정·테스트 폴더·테스트 수업 |
| 수동 E2E | 자연어 요청 → 도구 연쇄 → 게시 승인 | Claude Desktop/Cursor에서 실행 |
| 보안 점검 | 최소 권한, 토큰 미노출, 게시 전 승인 | 로그·저장소·실패 경로 확인 |

실제 학생 수업에서 처음부터 테스트하지 않는다. 테스트 수업과 테스트 폴더를 명시적으로 구분하고, 통합 테스트가 만든 자료에는 `MCP TEST — 삭제 가능` 표기를 넣는다.

## 9. 주요 위험과 대응

| 위험 | 영향 | 대응 |
| --- | --- | --- |
| 학교 관리자 정책이 OAuth 앱을 차단 | 로그인 또는 Classroom 접근 불가 | 개발 초기에 학교 관리자와 테스트 계정·허용 앱 정책 확인 |
| 과도한 OAuth 범위 | 사용자 신뢰 저하·검증 지연 | 기능별 incremental OAuth, 제출물/명단/성적 범위는 별도 버전까지 제외 |
| 잘못된 수업에 게시 | 학생에게 잘못된 과제 노출 | 수업명·ID·마감·첨부 목록을 포함한 승인 단계 |
| API 부분 실패 | 고아 파일·불완전 과제 | 단계별 산출물 ID 기록, 실패 결과 반환, 선택적 정리 도구 |
| LLM이 부정확한 내용을 생성 | 수업 자료 품질 저하 | 생성은 초안으로 취급하고 게시 전 링크·내용 검토 유도 |
| 공개 배포 시 OAuth 검증 지연 | 외부 사용자 배포 지연 | 테스트/프로덕션 Cloud 프로젝트를 분리하고 정책 문서를 조기 준비 |

## 10. 공개 제품·설치 배포 계획

### 제품 결정

- **대상 사용자**: 모든 Google Workspace 사용자. 교육자를 우선 설계 대상으로 삼되, 일반 문서·시트·슬라이드 자동화도 지원한다.
- **AI 사용 경험**: AI가 `tools/list`에서 도구의 설명과 JSON Schema를 읽고 적절한 도구를 선택하도록, 이름·설명·입출력을 목적 중심으로 설계한다. 서버의 `instructions`에는 교육 업무 흐름, 읽기 우선 원칙, 게시 전 확인 규칙을 짧고 명확하게 제공한다.
- **배포 형태**: npm 패키지 + MCP 레지스트리 배포를 기본으로 하고, ChatGPT 웹 등 원격 MCP가 필요한 사용자를 위해 호스팅형 엔드포인트를 병행한다.

### 배포 아키텍처

```text
                         ┌─ Claude Desktop / Cursor / Codex
사용자 컴퓨터 ─ npx ────┤  edu-workspace-mcp (stdio)
                         └─ ChatGPT Desktop
                                  │
                                  │ 동일한 tool contract
                                  ▼
                    edu-workspace MCP core
                                  ▲
                                  │ HTTPS + OAuth
                         ┌────────┴────────┐
                         │ hosted MCP API  │
                         └────────┬────────┘
                                  │
                           ChatGPT 웹 등
```

### 패키지 구성

| 패키지 | 역할 |
| --- | --- |
| `edu-workspace-mcp` | 플랫폼 독립 stdio 서버. `npx -y edu-workspace-mcp`로 실행 |
| `@edu-workspace/core` | MCP 도구 계약, Google API 어댑터 인터페이스, 승인 규칙 |
| `@edu-workspace/cli` | 설치 확인, 로그인, 클라이언트별 설정 안내, 진단 |
| `@edu-workspace/hosted` | 원격 Streamable HTTP 서버와 OAuth 웹 흐름 |

처음에는 모노레포로 시작하되, npm에는 사용자가 설치할 `edu-workspace-mcp` 하나만 먼저 공개한다.

### 사용자 설치 경험

Node.js 20 이상이 설치된 macOS·Windows·Linux에서는 같은 명령을 사용한다.

```bash
npx -y edu-workspace-mcp setup
```

`setup`은 운영체제별 설치 스크립트를 따로 유지하지 않고 다음만 수행한다.

1. Node.js 버전과 네트워크를 검사한다.
2. 사용할 AI 클라이언트(Claude Desktop, Codex/ChatGPT Desktop, Cursor, 기타)를 묻는다.
3. 해당 클라이언트의 MCP 설정 파일에 stdio 항목을 추가하기 전 설정 내용을 보여 준다.
4. `npx -y edu-workspace-mcp` 명령을 등록한다.
5. `login`을 열어 Google OAuth를 완료하고, `doctor`로 API·권한·Classroom 교사 역할을 진단한다.

설정 파일을 자동으로 바꾸는 단계는 반드시 대상 파일과 변경 내용을 보여 준 뒤 사용자 확인을 받는다. 자동 편집이 어려운 클라이언트에는 복사 가능한 설정 JSON/TOML을 출력한다.

### 클라이언트 지원 우선순위

| 단계 | 클라이언트 | 연결 방식 |
| --- | --- | --- |
| 1 | Claude Desktop, Cursor | npm stdio 설정 안내 |
| 1 | Codex CLI·IDE·ChatGPT Desktop | 같은 stdio 설정 또는 MCP 설정 화면 |
| 2 | ChatGPT 웹 | 호스팅된 Streamable HTTP MCP 또는 공개 플러그인 |
| 2 | 기타 MCP 호환 클라이언트 | 표준 stdio/HTTP 설정 예시 |

ChatGPT Desktop, Codex CLI, Codex IDE는 MCP 구성을 공유하며 stdio와 Streamable HTTP를 지원한다. 반면 ChatGPT 웹은 로컬 설정 파일이나 로컬 명령을 실행하지 않으므로, 웹에서 쓰려면 원격 MCP 또는 플러그인 배포가 필요하다. [공식 OpenAI MCP 문서](https://learn.chatgpt.com/docs/extend/mcp)에 따라 이 구분을 문서와 설치 화면에 명시한다.

### 공개 배포 전 필수 작업

1. **Google OAuth 검증 준비**: 앱 홈페이지, 개인정보처리방침, 서비스 약관, 데이터 삭제 방법, 최소 권한 근거를 준비한다.
2. **테스트/프로덕션 분리**: 서로 다른 Google Cloud 프로젝트와 OAuth client ID를 사용한다.
3. **교육기관 관리자 대응**: 관리자용 허용 범위표, 데이터 흐름도, 보안 FAQ를 제공한다.
4. **안전 메타데이터**: 읽기 도구에는 `readOnlyHint`, 외부 변경 도구에는 설명·승인 요구를 정확히 표시한다.
5. **업데이트 안전성**: npm 패키지 릴리스에 semver, changelog, 서명된 provenance, 취약점 스캔을 적용한다.

## 11. 공개 배포 로드맵

### A. 로컬 베타 — 4주

- 기존 0~5단계 MVP 구현
- npm 패키지와 `setup`, `login`, `doctor`, `disconnect` CLI 제공
- macOS, Windows, Ubuntu에서 CI 테스트
- Claude Desktop, Cursor, Codex/ChatGPT Desktop의 실제 연결 가이드와 샘플 설정 제공
- 10~20명의 교사 베타 그룹으로 설치 성공률·도구 선택 정확도·게시 오류를 측정

### B. 공개 로컬 릴리스 — 2~3주

- OAuth 동의 화면·공개 정책 문서·보안 검토 준비
- Microsoft Windows, macOS, Linux 설치 문서와 문제 해결 페이지 완성
- MCP 레지스트리·npm 공개, GitHub Releases, 예제 프롬프트 제공
- 익명화한 오류 보고와 사용자가 선택하는 진단 전송만 제공

### C. 호스팅형 원격 MCP 베타 — 4~6주

- Streamable HTTP, 서버 OAuth, 사용자별 Google 계정 연결 구현
- Postgres, KMS, 비밀 관리, 속도 제한, 감사 로그, 계정 연결 해제 구현
- ChatGPT 웹/플러그인 호환성 검증 및 해당 배포 절차 진행
- 교육기관 관리자용 조직 설치 안내와 데이터 처리 문서 제공

### D. 교육 특화 확장 — 이후

- 학습지·퀴즈·수업 슬라이드·수행평가 루브릭의 목적형 도구
- 클래스룸 과제 템플릿, 단원별 Drive 폴더 구조, 미제출 현황의 **읽기 전용** 보고
- 관리자 동의와 별도 버전이 준비된 뒤에만 명단·제출물·성적 기능 검토

## 참고한 공식 문서

- [Google Workspace 인증 및 권한 개요](https://developers.google.com/workspace/guides/auth-overview)
- [Google Classroom API 시작하기](https://developers.google.com/workspace/classroom/guides/get-started)
- [Google Classroom OAuth 범위](https://developers.google.com/workspace/classroom/guides/auth)
- [Google Forms 퀴즈 생성](https://developers.google.com/workspace/forms/api/guides/create-form-quiz)
- [MCP Authorization 사양](https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization)
