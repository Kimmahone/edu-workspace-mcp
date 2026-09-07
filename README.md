# 🎓 edu-workspace-mcp

자연어로 Google Docs, Sheets, Slides, Forms, Drive와 Classroom을 사용하는 교육 특화 Model Context Protocol(MCP) 서버입니다. Apps Script 없이 Google 공식 API를 직접 호출합니다.

[공식 홈페이지](https://edu.jeld.kr/) · [개인정보처리방침](https://edu.jeld.kr/privacy.html) · [이용약관](https://edu.jeld.kr/terms.html)

> `1.0.0`은 로컬 stdio MCP 정식 안정 버전입니다. 공용 Google 데스크톱 OAuth 클라이언트가 포함되어 있어 최종 사용자가 Google Cloud 프로젝트를 만들 필요가 없습니다. 기본 모드는 앱이 다루는 파일에 한정된 `drive.file`을 사용하며, 기존 자료 읽기는 사용자가 `--read`로 선택합니다.

## 할 수 있는 일

- 수업 자료용 Google Docs 문서 생성
- 학생 명단·루브릭·성적표 형태의 Google Sheets 생성
- 차시별 Google Slides 프레젠테이션 생성
- 정답·배점이 포함된 Google Forms 퀴즈 생성
- 기존 Docs·Sheets·Slides·Forms 내용과 Forms 응답 읽기
- Google Drive 파일 검색, 폴더 생성, 승인 후 공유
- 교사가 담당하는 Classroom 수업·과제·학생 명단·제출 현황 조회
- Classroom 과제 초안 생성, 사용자 승인 후 게시

예시 요청:

> “`소화와 순환` 단원의 5문항 퀴즈와 학습지, 6장짜리 수업 슬라이드를 만들고 `2학년 과학` 클래스룸에 금요일 오후 6시 마감 과제 초안으로 등록해줘.”

## 실제 교육 활용 데모

한 번의 자연어 요청으로 여러 Google 교육 도구를 연결할 수 있습니다.

```text
교사 요청
  → Drive 수업 폴더 생성
  → Docs 교사용 수업안·학생용 학습지 생성
  → Slides 수업 자료 생성
  → Forms 정답·배점 포함 퀴즈 생성
  → Classroom 과제 초안 생성
  → 교사가 대상·마감·첨부를 확인한 뒤 게시
```

대표 데모 프롬프트:

> 5학년 과학 ‘소화와 순환’ 수업 패키지를 만들어줘. Drive에 전용 폴더를 만들고, 교사용 수업안과 학생용 학습지는 Docs로, 6장 수업 자료는 Slides로, 5문항 형성평가는 Forms 퀴즈로 만들어줘. ‘5학년 3반 과학’ Classroom에는 과제 초안까지만 만들고 게시 전에 나에게 확인받아줘.

| 교육 업무 | 만들어지는 결과 | 사용하는 도구 |
| --- | --- | --- |
| 한 차시 수업 패키지 | 수업안, 학습지, 슬라이드, 퀴즈, Classroom 초안 | Drive + Docs + Slides + Forms + Classroom |
| 과정중심평가 관리 | 평가입력·학생별현황·항목별현황 시트 | Sheets |
| 수행평가 설계 | 4수준 루브릭 문서와 학생 자기평가지 | Docs + Forms |
| 형성평가 배포 | 정답·배점이 있는 퀴즈와 과제 초안 | Forms + Classroom |
| 학기 자료 정리 | 검색 결과와 교과·단원별 Drive 폴더 | Drive |
| 동료 교사 협업 | 확인 절차를 거친 댓글·읽기·편집 권한 | Drive 공유 |

- [교육자를 위한 실제 활용 예시와 복사 가능한 프롬프트](docs/EDUCATOR_USE_CASES.md)
- [예제 모음과 추천 첫 데모](examples/README.md)
- [실제로 실행되는 수업 패키지 통합 테스트](src/tests/education-demo.test.ts)

> 읽기 확장 모드에서는 기존 자료를 조회·분석할 수 있습니다. 기존 문서의 부분 편집, Sheets 차트·드롭다운·조건부 서식 생성은 아직 지원하지 않습니다. 자세한 지원 범위는 [활용 예시 문서](docs/EDUCATOR_USE_CASES.md#현재-버전에서-가능한-범위)를 확인하세요.

## MCP 도구

| 도구 | 동작 | 성격 |
| --- | --- | --- |
| `workspace_get_auth_status` | Google 연결 상태와 범위 확인 | 읽기 |
| `classroom_list_courses` | 교사가 담당하는 활성 수업 조회 | 읽기 |
| `classroom_list_coursework` | 수업의 과제·자료·마감·배점 조회 | 읽기 |
| `classroom_list_students` | 수업 학생 명단 조회 | 읽기 |
| `classroom_list_student_submissions` | 과제별 제출 상태·점수·답변 조회 | 읽기 |
| `drive_search_files` | 앱이 접근 가능한 파일을 이름·유형·폴더로 검색 | 읽기 |
| `drive_get_file_metadata` | Drive 파일 정보와 권한 상태 조회 | 읽기 |
| `drive_create_folder` | Drive 폴더 생성 | 생성 |
| `docs_create_document` | Docs 문서 생성 | 생성 |
| `docs_read_document` | Docs 본문·표·모든 문서 탭 읽기 | 읽기 |
| `sheets_create_workbook` | 여러 탭과 초기 데이터가 있는 Sheets 생성 | 생성 |
| `sheets_list_sheets` | 스프레드시트의 탭 목록과 크기 확인 | 읽기 |
| `sheets_read_values` | 스프레드시트 값 읽기 (범위 지정, 행 수 제한) | 읽기 |
| `slides_create_presentation` | 제목·본문 슬라이드 생성 | 생성 |
| `slides_read_presentation` | 슬라이드별 텍스트·표·발표자 노트 읽기 | 읽기 |
| `forms_create_quiz` | 문항·정답·배점이 있는 퀴즈 생성 | 생성 |
| `forms_read_form` | 설문 구조·문항·선택지·정답 읽기 | 읽기 |
| `forms_list_responses` | 제출된 설문 응답·점수 읽기 | 읽기 |
| `classroom_create_assignment_draft` | 학생에게 보이지 않는 과제 초안 생성 | 생성 |
| `classroom_publish_assignment` | 승인된 과제 초안을 학생에게 게시 | 외부 변경 |
| `drive_prepare_share` | 공유 대상·권한 승인 준비 | 승인 준비 |
| `drive_share_file` | 승인된 Drive 권한 변경 | 외부 변경 |

게시와 공유 도구에는 MCP 안전 메타데이터가 포함되어 있습니다. 승인 ID는 15분 동안 유효하고 한 번만 사용할 수 있습니다.

### 기존 Google 자료를 읽으려면 (선택)

기본 범위인 `drive.file` 은 **이 앱이 만들었거나 사용자가 이 앱으로 연 파일만** 다룹니다.
그래서 예전부터 쓰던 Docs·Sheets·Slides·Forms는 기본 설정으로는 읽히지 않을 수 있습니다.

기존 자료와 Classroom 학생 정보를 읽으려면 설치와 로그인에 `--read`를 붙이세요. 서비스별 읽기 전용 범위는 Google에서 민감 범위로 분류하므로 기본으로 요청하지 않습니다.

```bash
npx -y edu-workspace-mcp@1.0.0 install claude --read
npx -y edu-workspace-mcp@1.0.0 login --read
```

MCP 클라이언트 설정에 넣을 때는 `env` 에 적습니다.

```json
{
  "mcpServers": {
    "edu-workspace": {
      "command": "npx",
      "args": ["-y", "edu-workspace-mcp"],
      "env": { "EDU_WORKSPACE_READ_ACCESS": "1" }
    }
  }
}
```

껐다 켰다 하면 요청 범위가 달라지므로, 바꾼 뒤에는 **반드시 다시 로그인**해야 합니다.
`workspace_get_auth_status` 로 지금 허용된 범위를 확인할 수 있습니다.

`claude`는 Claude Code의 사용자 범위에 등록되어 모든 프로젝트에서 동작합니다. Claude Desktop은 `install claude-desktop --read`를 사용하세요. 사용 예:

```
sheets_list_sheets  { "spreadsheet": "https://docs.google.com/spreadsheets/d/<ID>/edit" }
sheets_read_values  { "spreadsheet": "<ID>", "range": "'AI 피드백'!A1:J40", "maxRows": 40 }
docs_read_document  { "document": "https://docs.google.com/document/d/<ID>/edit" }
forms_list_responses { "form": "https://docs.google.com/forms/d/<ID>/edit", "maxResponses": 100 }
```

- `spreadsheet` 는 ID 와 전체 URL 을 모두 받습니다.
- `range` 를 비우면 첫 시트를 읽습니다.
- 값은 화면에 보이는 대로 읽으므로 수식과 `IMPORTRANGE` 결과도 그대로 들어옵니다. 원본 값이 필요하면 `raw: true`.
- 기본 200행까지만 돌려주고(`maxRows` 로 최대 2,000), 잘렸으면 `truncated: true` 로 알려 줍니다.

## 요구 사항

- Node.js 20 이상
- MCP를 지원하는 데스크톱 클라이언트
- Google 계정

## 빠른 설치 — 최종 사용자

macOS, Windows, Linux에서 사용할 AI 클라이언트를 한 번만 전체 프로젝트 설정에 등록합니다. Google Cloud Console 설정은 필요하지 않습니다.

```bash
# 하나만 선택
npx -y edu-workspace-mcp@1.0.0 install codex
npx -y edu-workspace-mcp@1.0.0 install claude          # Claude Code, 사용자 범위
npx -y edu-workspace-mcp@1.0.0 install claude-desktop
npx -y edu-workspace-mcp@1.0.0 install cursor

# 사용자별·컴퓨터별 최초 1회 Google 연결
npx -y edu-workspace-mcp@1.0.0 login
```

기존 Google 자료까지 읽을 사용자는 두 명령 모두에 `--read`를 붙입니다.

AI 클라이언트를 재시작한 뒤 새 프로젝트에서도 같은 MCP를 사용할 수 있습니다. 브라우저에서 Google 로그인과 권한 승인을 마치면 됩니다. 학교 계정에서 기관 관리자가 제3자 앱을 차단한 경우에는 관리자에게 앱 허용을 요청해야 합니다.

- [학교 Google Workspace 관리자 허용 안내](docs/ADMIN_GUIDE.md)

```bash
npx -y edu-workspace-mcp@1.0.0 doctor
```

Google 토큰은 `~/.edu-workspace-mcp/token.json`에 사용자 전용 권한으로 저장됩니다. 연결을 해제하면 Google 측 권한 철회와 로컬 토큰 삭제를 함께 수행합니다.

```bash
npx -y edu-workspace-mcp@1.0.0 disconnect
```

## MCP 클라이언트 연결

Claude Desktop과 Cursor 계열 JSON 설정:

```json
{
  "mcpServers": {
    "edu-workspace": {
      "command": "npx",
      "args": ["-y", "edu-workspace-mcp@1.0.0"]
    }
  }
}
```

Codex·ChatGPT Desktop 계열 TOML 설정:

```toml
[mcp_servers.edu-workspace]
command = "npx"
args = ["-y", "edu-workspace-mcp@1.0.0"]
default_tools_approval_mode = "writes"
```

ChatGPT 웹은 사용자 컴퓨터의 stdio 프로세스를 실행하지 않습니다. 웹 지원은 향후 호스팅형 Streamable HTTP 서버로 제공할 계획입니다.

## 소스에서 실행

공개 저장소에는 설치형 앱용 공용 OAuth client ID가 포함되어 있습니다. 최종 사용자는 별도 Google Cloud 프로젝트나 `credentials.json` 없이 `login`만 실행합니다.

```bash
npm install
npm run check
npm test
npm run test:mcp
node dist/cli.js setup
node dist/cli.js login
```

개발 중 MCP 설정에서는 `command`에 `node`, `args`에 프로젝트의 절대 경로인 `dist/cli.js`를 지정할 수 있습니다.

## 보안 모델

- 필요한 Google OAuth 범위만 요청합니다.
- OAuth 로그인에 PKCE(S256), 무작위 `state`, 5분 만료와 loopback 콜백 검증을 적용합니다.
- 사용자의 OAuth 액세스·갱신 토큰은 Git에 포함되지 않고 로컬 사용자 폴더에만 저장됩니다.
- 설치형 앱은 비밀을 유지할 수 없는 공개 클라이언트이므로 배포용 데스크톱 client ID와 client secret은 앱에 포함됩니다.
- 기존 자료 읽기 범위는 기본으로 요청하지 않고 `--read` 또는 `EDU_WORKSPACE_READ_ACCESS=1`로 켠 사람에게만 추가합니다.
- 검색·조회 도구에는 `readOnlyHint`를 표시합니다.
- Classroom 게시와 Drive 공유에는 `destructiveHint`를 표시합니다.
- Classroom 과제는 먼저 `DRAFT`로 만들고 별도 게시 도구에서 일회성 승인을 검증합니다.
- Drive 공유도 준비와 확정 단계를 분리합니다.
- 실제 학생 데이터가 아닌 별도 테스트 수업에서 먼저 검증하세요.
- Google API 할당량 오류에는 제한적 지수 백오프를 적용하고, 중복 생성 위험이 있는 모호한 오류는 자동 재시도하지 않습니다.

Google OAuth 브랜딩과 개인정보처리방침을 공개해야 하며, Google Workspace for Education 관리자가 제3자 앱을 허용해야 할 수 있습니다.

요청 범위의 상세 설명은 [OAuth 범위 문서](docs/OAUTH_SCOPES.md), 공개 데이터 처리 방침은 [개인정보처리방침](https://edu.jeld.kr/privacy.html)을 참고하세요. 공개 배포를 위한 범위별 사용 사유와 데모 영상 시나리오는 [OAuth 검수 제출 가이드](docs/OAUTH_VERIFICATION_GUIDE.md)에 정리되어 있습니다.

## 테스트

```bash
npm run check       # TypeScript 정적 검사
npm test            # 단위·MCP 인메모리 통합 테스트
npm run test:mcp    # 실제 stdio 프로세스 연결 테스트
npm audit --omit=dev
```

Google API 실계정 테스트에는 별도 테스트 계정을 사용하세요. CI에서는 외부 계정을 사용하지 않고 Google API 어댑터를 주입한 계약 테스트를 실행합니다.

## 개발 현황

- [x] OAuth 로그인·토큰 저장·연결 해제
- [x] Drive 검색·폴더 생성·승인 공유
- [x] Docs·Sheets·Slides·Forms 생성 및 내용 읽기
- [x] Classroom 수업 조회·과제 초안·승인 게시
- [x] macOS·Windows·Linux 공통 npm 실행 구조
- [x] 단위·MCP 통합·stdio 스모크 테스트
- [x] 실계정 OAuth·Classroom 조회·Sheets 생성 E2E 테스트
- [x] Google OAuth 브랜딩 검증·프로덕션 게시·비민감 범위 판정
- [x] PKCE·state·토큰 파일 보호·할당량 재시도 정책
- [x] Codex·Claude Code·Claude Desktop·Cursor 전역 자동 설치
- [ ] 호스팅형 Streamable HTTP MCP
- [ ] Calendar·Gmail·Tasks 확장

전체 제품 계획은 [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)를 참고하세요.
정식판 출시 기준과 운영 정책은 [정식 배포 운영 기준](docs/PRODUCTION_READINESS.md), 버전별 변경 사항은 [CHANGELOG](CHANGELOG.md)를 참고하세요.

## 라이선스

[MIT](LICENSE)
