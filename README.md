# 🎓 edu-workspace-mcp

자연어로 Google Docs, Sheets, Slides, Forms, Drive와 Classroom을 사용하는 교육 특화 Model Context Protocol(MCP) 서버입니다. Apps Script 없이 Google 공식 API를 직접 호출합니다.

> 현재 버전은 로컬 stdio MCP 베타입니다. 정식 배포판은 공용 Google OAuth 앱을 포함하므로 최종 사용자가 Google Cloud 프로젝트를 만들 필요가 없습니다. 공용 OAuth 검증 전에는 개발용 자격 증명과 테스트 사용자가 필요합니다.

## 할 수 있는 일

- 수업 자료용 Google Docs 문서 생성
- 학생 명단·루브릭·성적표 형태의 Google Sheets 생성
- 차시별 Google Slides 프레젠테이션 생성
- 정답·배점이 포함된 Google Forms 퀴즈 생성
- Google Drive 파일 검색, 폴더 생성, 승인 후 공유
- 교사가 담당하는 Google Classroom 수업 조회
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

> v0.1은 새 파일 생성과 Classroom 초안·게시 흐름에 집중합니다. 기존 문서의 부분 편집, Sheets 차트·드롭다운·조건부 서식, Forms 응답과 학생 제출물 분석은 아직 지원하지 않습니다. 자세한 지원 범위는 [활용 예시 문서](docs/EDUCATOR_USE_CASES.md#현재-버전에서-가능한-범위)를 확인하세요.

## MCP 도구

| 도구 | 동작 | 성격 |
| --- | --- | --- |
| `workspace_get_auth_status` | Google 연결 상태와 범위 확인 | 읽기 |
| `classroom_list_courses` | 교사가 담당하는 활성 수업 조회 | 읽기 |
| `drive_search_files` | 이름·유형·폴더로 Drive 검색 | 읽기 |
| `drive_create_folder` | Drive 폴더 생성 | 생성 |
| `docs_create_document` | Docs 문서 생성 | 생성 |
| `sheets_create_workbook` | 여러 탭과 초기 데이터가 있는 Sheets 생성 | 생성 |
| `slides_create_presentation` | 제목·본문 슬라이드 생성 | 생성 |
| `forms_create_quiz` | 문항·정답·배점이 있는 퀴즈 생성 | 생성 |
| `classroom_create_assignment_draft` | 학생에게 보이지 않는 과제 초안 생성 | 생성 |
| `classroom_publish_assignment` | 승인된 과제 초안을 학생에게 게시 | 외부 변경 |
| `drive_prepare_share` | 공유 대상·권한 승인 준비 | 승인 준비 |
| `drive_share_file` | 승인된 Drive 권한 변경 | 외부 변경 |

게시와 공유 도구에는 MCP 안전 메타데이터가 포함되어 있습니다. 승인 ID는 15분 동안 유효하고 한 번만 사용할 수 있습니다.

## 요구 사항

- Node.js 20 이상
- MCP를 지원하는 데스크톱 클라이언트
- Google 계정

## 빠른 설치 — 최종 사용자

정식 npm 배포 후 macOS, Windows, Linux에서 다음 두 단계만 진행합니다. Google Cloud Console 설정은 필요하지 않습니다.

```bash
npx -y edu-workspace-mcp setup
npx -y edu-workspace-mcp login
```

브라우저에서 Google 로그인과 권한 승인을 마치고 MCP 클라이언트에 연결하면 됩니다. 학교 계정에서 기관 관리자가 제3자 앱을 차단한 경우에는 관리자에게 앱 허용을 요청해야 합니다.

```bash
npx -y edu-workspace-mcp doctor
```

Google 토큰은 `~/.edu-workspace-mcp/token.json`에 사용자 전용 권한으로 저장됩니다. 연결을 해제하려면 다음을 실행합니다.

```bash
npx -y edu-workspace-mcp disconnect
```

## MCP 클라이언트 연결

Claude Desktop과 Cursor 계열 JSON 설정:

```json
{
  "mcpServers": {
    "edu-workspace": {
      "command": "npx",
      "args": ["-y", "edu-workspace-mcp"]
    }
  }
}
```

Codex·ChatGPT Desktop 계열 TOML 설정:

```toml
[mcp_servers.edu_workspace]
command = "npx"
args = ["-y", "edu-workspace-mcp"]
default_tools_approval_mode = "writes"
```

ChatGPT 웹은 사용자 컴퓨터의 stdio 프로세스를 실행하지 않습니다. 웹 지원은 향후 호스팅형 Streamable HTTP 서버로 제공할 계획입니다.

## 소스에서 실행

현재 공개 저장소에는 아직 프로덕션 OAuth client ID가 들어 있지 않습니다. 기여자와 베타 테스터는 [배포자용 공용 OAuth 설정](docs/BUNDLED_OAUTH_SETUP.md)을 진행하거나, 개인 Desktop OAuth JSON을 `~/.edu-workspace-mcp/credentials.json`에 둡니다. 최종 사용자는 이 작업을 하지 않습니다.

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
- OAuth 자격 증명과 토큰은 Git에 포함되지 않습니다.
- 검색·조회 도구에는 `readOnlyHint`를 표시합니다.
- Classroom 게시와 Drive 공유에는 `destructiveHint`를 표시합니다.
- Classroom 과제는 먼저 `DRAFT`로 만들고 별도 게시 도구에서 일회성 승인을 검증합니다.
- Drive 공유도 준비와 확정 단계를 분리합니다.
- 실제 학생 데이터가 아닌 별도 테스트 수업에서 먼저 검증하세요.

공개 배포 전에는 Google OAuth 앱 검증과 개인정보처리방침이 필요하며, Google Workspace for Education 관리자가 제3자 앱을 허용해야 할 수 있습니다.

요청 범위의 상세 설명은 [OAuth 범위 문서](docs/OAUTH_SCOPES.md), 데이터 처리 방식은 [개인정보 처리 안내 초안](docs/PRIVACY.md)을 참고하세요.

## 테스트

```bash
npm run check       # TypeScript 정적 검사
npm test            # 단위·MCP 인메모리 통합 테스트
npm run test:mcp    # 실제 stdio 프로세스 연결 테스트
npm audit --omit=dev
```

Google API 실계정 테스트에는 별도 OAuth 자격 증명과 테스트 계정이 필요합니다. CI에서는 외부 계정을 사용하지 않고 Google API 어댑터를 주입한 계약 테스트를 실행합니다.

## 개발 현황

- [x] OAuth 로그인·토큰 저장·연결 해제
- [x] Drive 검색·폴더 생성·승인 공유
- [x] Docs·Sheets·Slides·Forms 생성
- [x] Classroom 수업 조회·과제 초안·승인 게시
- [x] macOS·Windows·Linux 공통 npm 실행 구조
- [x] 단위·MCP 통합·stdio 스모크 테스트
- [ ] 실계정 E2E 테스트
- [ ] Google OAuth 공개 앱 검증
- [ ] 호스팅형 Streamable HTTP MCP
- [ ] Calendar·Gmail·Tasks 확장

전체 제품 계획은 [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)를 참고하세요.

## 라이선스

[MIT](LICENSE)
