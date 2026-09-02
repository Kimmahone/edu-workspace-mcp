# 🎓 edu-workspace-mcp

자연어로 Google Docs, Sheets, Slides, Forms, Drive와 Classroom을 사용하는 교육 특화 Model Context Protocol(MCP) 서버입니다. Apps Script 없이 Google 공식 API를 직접 호출합니다.

> 현재 버전은 로컬 stdio MCP 베타입니다. Google OAuth 검증을 완료하기 전에는 OAuth 동의 화면에 등록한 테스트 사용자만 로그인할 수 있습니다.

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
- 직접 만든 Google Cloud Desktop OAuth 자격 증명

## 1. Google Cloud 준비

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트를 만듭니다.
2. 다음 API를 활성화합니다.
   - Google Drive API
   - Google Docs API
   - Google Sheets API
   - Google Slides API
   - Google Forms API
   - Google Classroom API
3. OAuth 동의 화면을 구성합니다.
4. 앱이 테스트 상태라면 사용할 Google 계정을 테스트 사용자로 추가합니다.
5. OAuth 클라이언트 ID를 만들고 애플리케이션 유형으로 **데스크톱 앱**을 선택합니다.
6. 내려받은 JSON 파일을 다음 위치에 `credentials.json`으로 저장합니다.

```text
~/.edu-workspace-mcp/credentials.json
```

Windows에서도 사용자 홈 폴더 아래의 `.edu-workspace-mcp` 폴더를 사용합니다. 다른 경로를 쓰려면 `EDU_WORKSPACE_CREDENTIALS_PATH` 환경 변수를 설정합니다.

## 2. 설치와 로그인

npm에 공개된 뒤에는 macOS, Windows, Linux에서 같은 명령을 사용합니다.

```bash
npx -y edu-workspace-mcp setup
npx -y edu-workspace-mcp login
npx -y edu-workspace-mcp doctor
```

Google 토큰은 `~/.edu-workspace-mcp/token.json`에 사용자 전용 권한으로 저장됩니다. 연결을 해제하려면 다음을 실행합니다.

```bash
npx -y edu-workspace-mcp disconnect
```

## 3. MCP 클라이언트 연결

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
