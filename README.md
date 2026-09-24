# 🎓 edu-workspace-mcp

자연어로 Google Docs, Sheets, Slides, Forms, Drive와 Classroom을 사용하는 교육 특화 Model Context Protocol(MCP) 서버입니다. Apps Script 없이 Google 공식 API를 직접 호출합니다.

[공식 홈페이지](https://edu.jeld.kr/) · [복사 가능한 예시 프롬프트](https://edu.jeld.kr/#prompts) · [개인정보처리방침](https://edu.jeld.kr/privacy.html) · [이용약관](https://edu.jeld.kr/terms.html)

> `1.0.0`은 로컬 stdio MCP 정식 안정 버전입니다. 공용 Google 데스크톱 OAuth 클라이언트가 포함되어 있어 최종 사용자가 Google Cloud 프로젝트를 만들 필요가 없습니다. 기본 모드는 앱이 다루는 파일에 한정된 `drive.file`을 사용하며, 기존 자료 읽기는 사용자가 `--read`로 선택합니다.

## 할 수 있는 일

- 학교 서식 같은 교수·학습 과정안(기본 정보표·단계별 과정표·평가 계획표)과 표·글머리·참고 상자가 있는 A4 Google Docs 문서 생성
- 학생 명단·평가계획·평가기록·제출현황·관찰기록·대시보드가 연결된 Google Sheets 생성
- 셀 값과 수식 본문을 노출하지 않는 기존 Sheets 구조·수식 오류 진단
- Classroom 명단·제출 상태를 개인정보 최소화 시트로 변환
- 차시별 Google Slides 프레젠테이션 생성
- 정답·배점이 포함된 Google Forms 퀴즈 생성
- 기존 Docs·Sheets·Slides·Forms 내용과 Forms 응답 읽기
- Google Drive 파일 검색, 폴더 생성, 승인 후 공유
- 교사가 담당하는 Classroom 수업·과제·학생 명단·제출 현황 조회
- Classroom 과제 초안 생성, 사용자 승인 후 게시
- 초등 2022 개정 교육과정 성취기준 620개 찾기(인터넷·Google 로그인 불필요), 수업안·퀴즈·과제·평가계획에 원문과 출처 넣기

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

> 5학년 과학 ‘소화와 순환’ 40분 수업 패키지를 만들어줘. Drive에 전용 폴더를 만들고, 교사용 수업안과 학생용 학습지는 제목·소제목·본문의 위계와 충분한 답안 공간이 보이게 Docs로 만들어줘. Slides는 한 장에 핵심 메시지 하나씩 7장으로, Forms는 정답·배점을 포함한 5문항으로 구성해줘. 모든 자료에서 학습 목표와 용어를 동일하게 쓰고 정보량을 점검해줘. ‘5학년 3반 과학’ Classroom에는 학생용 자료만 과제 초안으로 연결하고 수업·마감·배점·첨부를 보여준 뒤 게시 전에 확인받아줘.

| 교육 업무 | 만들어지는 결과 | 사용하는 도구 |
| --- | --- | --- |
| 한 차시 수업 패키지 | 수업안, 학습지, 슬라이드, 퀴즈, Classroom 초안 | Drive + Docs + Slides + Forms + Classroom |
| 과정중심평가 관리 | 9개 연결 탭, 드롭다운, 체크박스, 조건부 서식, 차트 | Sheets |
| Classroom 제출 관리 | 명단·제출 상태·점수·대시보드 스냅샷 | Classroom + Sheets |
| 복잡한 업무 시트 점검 | 탭·수식 함수·의존성·오류·차트 구조 진단 | Sheets |
| 수행평가 설계 | 4수준 루브릭 문서와 학생 자기평가지 | Docs + Forms |
| 형성평가 배포 | 정답·배점이 있는 퀴즈와 과제 초안 | Forms + Classroom |
| 학기 자료 정리 | 검색 결과와 교과·단원별 Drive 폴더 | Drive |
| 동료 교사 협업 | 확인 절차를 거친 댓글·읽기·편집 권한 | Drive 공유 |

- [서비스별로 복사 가능한 예시 프롬프트](https://edu.jeld.kr/#prompts)
- [교육자를 위한 실제 활용 예시와 도구 흐름](docs/EDUCATOR_USE_CASES.md)
- [예제 모음과 추천 첫 데모](examples/README.md)
- [실제로 실행되는 수업 패키지 통합 테스트](src/tests/education-demo.test.ts)

> 읽기 확장 모드에서는 기존 자료를 조회·분석할 수 있습니다. 교육용 평가·제출 템플릿에는 차트·드롭다운·조건부 서식이 포함됩니다. 기존 문서나 임의 범위의 범용 부분 편집은 아직 지원하지 않습니다. 자세한 지원 범위는 [활용 예시 문서](docs/EDUCATOR_USE_CASES.md#현재-버전에서-가능한-범위)를 확인하세요.

## 보기 좋은 문서 양식

글자만 이어 붙인 문서가 아니라, 학교에서 쓰는 한글 문서처럼 표와 서식이 잡힌 A4 문서를 만듭니다.

- **교수·학습 과정안** (`docs_create_lesson_plan`): 제목 상자 → 기본 정보표(교과·단원·차시·교과서·성취기준·학습 목표·학습 자료) → 핵심 용어 → 차시별 흐름표 → 차시마다 학습 문제와 단계별 과정표(단계·학습 과정·교수·학습 활동·시간·자료·유의점) → 평가 계획표(상·중·하) → 지도상 유의점. 같은 단계(도입·전개·정리)는 한 칸으로 합치고 시간을 더해 적습니다. 차시가 여럿이면 차시마다 새 쪽에서 시작합니다.
- **일반 문서** (`docs_create_document`): 제목 상자와 절 제목에, 본문(`text`)에서 간단한 서식을 씁니다.

  | 쓰는 법 | 결과 |
  | --- | --- |
  | `## 도입(5분)` | 소제목 |
  | `- 항목`, 두 칸 들여쓴 `- 하위 항목` | 진짜 글머리 목록(둘째 줄도 들여쓰기) |
  | `1. 항목` | 번호 목록 |
  | `\| 칸 \| 칸 \|` 다음 줄 `\|---\|---\|` | 머리행이 있는 표 |
  | `> 내용` | 회색 참고 상자 |
  | `**굵게**` | 굵은 글씨 |

- **인쇄 설정:** A4·여백, 한글 글꼴(Noto Sans KR, 굵게가 한글에도 적용), 표 머리행은 쪽마다 반복, 표의 한 행이 두 쪽으로 쪼개지지 않게, 제목은 다음 내용과 같은 쪽에.
- **만드는 방법:** 서식을 HTML로 그린 뒤 Drive가 Google Docs로 변환하고, 변환이 살리지 못하는 글꼴·쪽 나눔·머리행 반복은 만든 문서에 Docs API로 한 번 더 입힙니다. 새 OAuth 범위는 필요 없습니다(`drive.file`, 이 앱이 만든 파일만). 인쇄 설정만 실패하면 문서는 그대로 두고 경고를 돌려줘 같은 문서가 두 번 만들어지지 않게 합니다.

## 초등 교육과정 성취기준 연결

AI가 성취기준을 기억으로 적으면 코드와 문장이 조금씩 틀리기 쉽습니다. 이 서버는 성취기준을 **코드로만 받고**, 원문과 출처는 서버가 붙입니다.

```text
curriculum_search_standards  →  교사가 성취기준 고르기  →  생성 도구에 standardCodes 전달
                                                          ├ docs_create_lesson_plan               과정안 기본 정보표의 성취기준 칸
                                                          ├ docs_create_document                  제목 아래 성취기준 표
                                                          ├ education_create_assessment_tracker   평가계획 탭에 교과·영역·원문
                                                          ├ forms_create_quiz                     퀴즈 설명 끝에 관련 성취기준
                                                          └ classroom_create_assignment_draft     과제 설명 끝에 관련 성취기준
```

- **한 번에 시작하기:** MCP 프롬프트 `lesson_package_with_standards`(학년·교과·주제 입력)를 고르면 성취기준 선택 → 폴더 → 교사용 수업안 → 학생용 학습지 → 슬라이드 → 형성평가 → Classroom 초안 순서로 진행합니다. 게시는 교사 확인 뒤에만 합니다.
- **모르는 코드는 만들기 전에 멈춥니다.** 비슷한 코드를 제안하고 Google 파일은 만들지 않습니다.
- **데이터:** [korean-elementary-learning-map-mcp](https://github.com/taehyeonglim/korean-elementary-learning-map-mcp) 0.5.1(MIT)의 11개 교과 성취기준 620개. 원문은 NCIC 공개 PDF에서 자동 추출된 것이라 이 저장소에서 한 번 더 정리했습니다.

  | 상태 | 수 | 뜻 |
  | --- | ---: | --- |
  | `extracted` | 494 | 추출된 문장을 그대로 씀 |
  | `cleaned` | 113 | 뒤에 붙은 다음 단원 제목·쪽 번호·탐구 활동을 자르거나, 줄바꿈으로 깨진 띄어쓰기 36곳을 고침 |
  | `unavailable` | 13 | 표 내용이 섞였거나 해설 문단이 들어가 싣지 않음. 문서에는 「원문 확인 필요」와 요지만 들어갑니다 |

  자동 추출 문장이므로 공식 문서로 쓰기 전에는 NCIC 원문과 대조하세요. 정리 규칙은 [scripts/build-curriculum-data.mjs](scripts/build-curriculum-data.mjs), 원천 라이선스는 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)에 있습니다.
- **선수관계·세부 학습 주제까지 보려면** 원본 교육과정 MCP를 함께 등록하세요. 두 서버는 도구 이름이 겹치지 않습니다.

  ```bash
  claude mcp add curriculum-kr -- npx -y korean-elementary-learning-map-mcp
  ```

```
curriculum_search_standards { "subject": "사회", "grade": 5, "query": "유적 유물" }
docs_create_lesson_plan { "subject": "사회", "grade": 5, "unit": "…", "standardCodes": ["[6사04-01]"], "objectives": ["…"], "sessions": [{ "title": "…", "steps": [{ "stage": "도입", "process": "…", "activities": ["…"], "minutes": 5 }] }] }
docs_create_document { "title": "고조선 사람들의 생활", "standardCodes": ["[6사04-01]"], "blocks": [{ "heading": "학습 목표", "text": "- …" }] }
education_create_assessment_tracker { "title": "2학기 평가", "className": "5학년 3반", "schoolYear": 2026, "semester": "2학기", "standardCodes": ["[6사04-01]", "[6사04-02]", "[6실03-04]"] }
```

## MCP 도구

| 도구 | 동작 | 성격 |
| --- | --- | --- |
| `workspace_get_auth_status` | Google 연결 상태와 범위 확인 | 읽기 |
| `curriculum_search_standards` | 초등 성취기준을 교과·학년·낱말로 찾기 (로그인·인터넷 불필요) | 읽기 (로컬) |
| `curriculum_get_standards` | 성취기준 코드로 원문·영역·출처·정리 내역 확인 | 읽기 (로컬) |
| `classroom_list_courses` | 교사가 담당하는 활성 수업 조회 | 읽기 |
| `classroom_list_coursework` | 수업의 과제·자료·마감·배점 조회 | 읽기 |
| `classroom_list_students` | 수업 학생 명단 조회 | 읽기 |
| `classroom_list_student_submissions` | 과제별 제출 상태·점수·답변 조회 | 읽기 |
| `drive_search_files` | 앱이 접근 가능한 파일을 이름·유형·폴더로 검색 | 읽기 |
| `drive_get_file_metadata` | Drive 파일 정보와 권한 상태 조회 | 읽기 |
| `drive_create_folder` | Drive 폴더 생성 | 생성 |
| `docs_create_document` | 제목 상자·절 제목·글머리·표·참고 상자가 있는 A4 Docs 문서 생성 | 생성 |
| `docs_create_lesson_plan` | 교수·학습 과정안(기본 정보표·차시별 흐름·단계별 과정표·평가 계획표) 생성 | 생성 |
| `docs_read_document` | Docs 본문·표·모든 문서 탭 읽기 | 읽기 |
| `sheets_create_workbook` | 여러 탭과 초기 데이터가 있는 Sheets 생성 | 생성 |
| `sheets_list_sheets` | 스프레드시트의 탭 목록과 크기 확인 | 읽기 |
| `sheets_read_values` | 스프레드시트 값 읽기 (범위 지정, 행 수 제한) | 읽기 |
| `sheets_inspect_workbook` | 셀 값을 반환하지 않고 구조·수식·오류·의존성 진단 | 읽기 |
| `education_create_assessment_tracker` | 9개 탭이 연결된 과정중심평가 시스템 생성 | 생성 |
| `education_create_classroom_submission_tracker` | Classroom 과제 제출 현황 대시보드 시트 생성 | 생성 |
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
sheets_inspect_workbook { "spreadsheet": "<ID>", "includeHidden": true }
education_create_assessment_tracker { "title": "5학년 평가 관리", "className": "5학년 3반", "schoolYear": 2026, "semester": "2학기", "students": [{ "number": 1, "name": "학생01" }] }
docs_read_document  { "document": "https://docs.google.com/document/d/<ID>/edit" }
forms_list_responses { "form": "https://docs.google.com/forms/d/<ID>/edit", "maxResponses": 100 }
```

- `spreadsheet` 는 ID 와 전체 URL 을 모두 받습니다.
- `range` 를 비우면 첫 시트를 읽습니다.
- 값은 화면에 보이는 대로 읽으므로 수식과 `IMPORTRANGE` 결과도 그대로 들어옵니다. 원본 값이 필요하면 `raw: true`.
- 기본 200행까지만 돌려주고(`maxRows` 로 최대 2,000), 잘렸으면 `truncated: true` 로 알려 줍니다.
- 개인정보가 있는 복잡한 시트의 설계만 점검할 때는 `sheets_inspect_workbook`을 사용하세요. 셀 값과 수식 본문은 반환하지 않고 함수명 통계·시트 의존성·오류 위치만 알려 줍니다.

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
- 교육과정 도구는 패키지에 들어 있는 정리본만 읽고 네트워크를 쓰지 않습니다(`openWorldHint: false`).
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
- [x] 과정중심평가·Classroom 제출 대시보드 교육 템플릿
- [x] 개인정보 비노출 Sheets 구조·수식 오류 진단
- [x] Classroom 수업 조회·과제 초안·승인 게시
- [x] macOS·Windows·Linux 공통 npm 실행 구조
- [x] 단위·MCP 통합·stdio 스모크 테스트
- [x] 실계정 OAuth·Classroom 조회·Sheets 생성 E2E 테스트
- [x] Google OAuth 브랜딩 검증·프로덕션 게시·비민감 범위 판정
- [x] PKCE·state·토큰 파일 보호·할당량 재시도 정책
- [x] Codex·Claude Code·Claude Desktop·Cursor 전역 자동 설치
- [x] 초등 2022 개정 교육과정 성취기준 연결(정리본·`standardCodes`·수업 패키지 프롬프트)
- [ ] 호스팅형 Streamable HTTP MCP
- [ ] Calendar·Gmail·Tasks 확장

전체 제품 계획은 [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)를 참고하세요.
정식판 출시 기준과 운영 정책은 [정식 배포 운영 기준](docs/PRODUCTION_READINESS.md), 버전별 변경 사항은 [CHANGELOG](CHANGELOG.md)를 참고하세요.

## 라이선스

[MIT](LICENSE). 포함된 교육과정 데이터의 원천과 라이선스는 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)를 참고하세요.
