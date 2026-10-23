# GitHub 주소로 Workspace Agent 설치하기

2026-10-23 공개 Agent는 npm **1.2.0**이며 `agent` 태그로 게시했습니다. 기본 읽기와 별도 동의하는 Docs·Sheets 생성·편집을 지원합니다. 기존 `latest`1.1.1과 읽기1.1.2 설치·Google 연결은 보존합니다. 설치 시에도 정확한 npm 버전을 확인하고, 조회되지 않으면 중단합니다.

## AI에게 설치 요청하기

> https://github.com/Kimmahone/edu-workspace-mcp 의 공개 Agent1.2.0을 지금 사용하는 앱에 문서·시트 생성·편집용으로 설치해 주세요. Node.js22+와 정확한 npm 공개 버전을 확인하고 기존 MCP 설정을 보존해 주세요. Google 로그인과 편집 권한 동의는 제가 직접 하겠습니다.

읽기만 필요하면 요청문에서 “생성·편집용” 대신 “읽기 전용”이라고 적습니다. 설치 담당 AI는 루트 `AGENTS.md`를 따릅니다. 일반 사용자에게 Cloud 프로젝트·API 키·OAuth JSON·client secret을 요구하지 않습니다.

## 문서·시트 편집 연결

터미널에서 사용할 앱을 선택합니다. 아래 `codex`는 `claude`, `claude-desktop`, `cursor`로 바꿀 수 있습니다.

```sh
npm view edu-workspace-mcp@1.2.0 version
npx -y --prefer-online edu-workspace-mcp@1.2.0 setup
npx -y --prefer-online edu-workspace-mcp@1.2.0 setup codex --workspace-edit
```

설치 후 **본인이 직접** 다음 명령을 실행하고 Google 계정 선택·편집 권한에 동의합니다. AI가 동의 버튼을 대신 누르거나 인증 파일을 읽지 않습니다.

```sh
npx -y --prefer-online edu-workspace-mcp@1.2.0 login --workspace-edit
npx -y --prefer-online edu-workspace-mcp@1.2.0 doctor --workspace-edit
```

AI 앱을 재시작하고 “시험용 Google 문서와 시트를 각각 하나 만들고 값을 수정한 뒤 읽어서 확인해 줘”라고 요청할 수 있습니다. 기존 자료를 고칠 때는 본인이 편집할 수 있는 정확한 문서 주소·시트 범위와 원하는 변경을 줍니다. [수정 확인과 중복 방지](WORKSPACE_EDIT_AGENT.md)를 따릅니다.

## 읽기 전용 연결

편집 권한을 선택하지 않으면 기본 읽기 도구10개를 사용합니다. 다음 명령에는 `--workspace-edit`를 붙이지 않습니다.

```sh
npx -y --prefer-online edu-workspace-mcp@1.2.0 setup codex
npx -y --prefer-online edu-workspace-mcp@1.2.0 login
npx -y --prefer-online edu-workspace-mcp@1.2.0 doctor
```

Docs·Forms 본문·Forms 응답·Sheets·Slides 읽기 다섯 범위만 요청합니다. 기존1.1.2 읽기 설치는 그대로 사용해도 됩니다. 편집 연결은 Docs와 Sheets의 전체 서비스 권한이 각 읽기 범위를 대체하고 Forms·Slides는 계속 읽기 전용입니다. 읽기·편집 인증 저장소는 분리합니다.

## 기존 설정과 자료 보존

반복 설치는 `edu-workspace-agent`만 갱신하며 기존 `edu-workspace`, 다른 MCP 서버와 Google 자료를 보존합니다. 설정 충돌·잘못된 파일은 덮어쓰지 않고 중단합니다. 등록, 본인 로그인과 실제 Google 자료 읽기·편집 성공은 각각 확인합니다. 서버에서 암호화한 Google 갱신 토큰을 처리하고 기기에는 별도 MCP 자격증명을 저장합니다. [보관·철회 안내](WORKSPACE_READONLY_AGENT.md)와 [공개 개인정보처리방침](https://edu.jeld.kr/privacy.html)을 확인합니다. 파일 삭제·공유·Drive 검색·Classroom·이메일 신원 조회 도구는 추가하지 않습니다.

## 무료 한도 안에서 계속 사용하기

고정된 다음 날 종료 시각 없이 기존 Workers Free·KV·D1 안에서 운영합니다. 기존15분 정리 작업이 공식 요금8개를 차례로 확인하며 조건 변경·48시간 확인 실패 시 중단합니다. 유료로 전환하거나 검토 시각만 임의로 연장하지 않습니다.

읽기+쓰기 전체40회/분·600회/일, 연결별100회/일, 쓰기 연결별20회/일입니다. 일일 한도는 한국 시간 오전9시에 초기화됩니다. 초과하면 해당 제한이 풀릴 때까지 기다립니다. 현재 표준 API 조건과 Free 유지가 전제이며 영구 무료나 모든 부하의 성공을 보장하지 않습니다. 연결한 AI 앱의 별도 이용료·학습 공유 설정과 Google 저장공간 조건은 각 계정에 적용됩니다. 별도 모델 API·할당량 유료 확대는 추가하지 않습니다.

## 운영자 출시 검사

실제 Google 생성·수정·재조회, 갱신, 서로 다른 두 계정 격리, 읽기 토큰 쓰기 거부, 중복·한도 차단, 철회, 배포된 Free 성능, 실제 Cron 정리, 요금 검토 만료 차단과 설치 호스트를 검증한 버전만 공개합니다. 로컬 fixture를 실제 성공 근거로 대체하지 않습니다.

`npm publish --tag agent`의 `prepublishOnly`는 `release:guard`를 실행합니다. 현재 요금 검토와15분 이내 실제 Free 계정 확인이 필요합니다. 운영자는 상태·시각·정책 해시·권한·검사 결과만 `scripts/export-release-evidence.mjs`의 허용 목록으로 내보내 최종 릴리스 commit에 묶습니다. 기존 GitHub Actions OIDC가 이 첨부 근거로 같은 guard를 실행하며 새 npm 토큰은 만들지 않습니다. 원본 비공개 기록·계정 목록·문서 내용·인증값은 Git·npm·사이트에 넣지 않습니다.

1.1.1 이하에 새 Agent 옵션을 전달하거나 실패한 public ID-only 로그인을 반복하지 않습니다. 고급 legacy/web 경로는 명시적으로 요청한 경우에만 사용합니다.
