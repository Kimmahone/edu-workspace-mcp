# GitHub 주소로 읽기 전용 Agent 설치하기

이 문서는 정확한 npm `1.1.2` 설치 버전의 검토된 공개 절차입니다. 현재 후보의 실제 공개 여부는 npm registry에서 확인하며, 미게시 상태이면 설치를 중단합니다. 기존 `latest` 1.1.1과 기존 앱 등록은 유지하고 새 읽기 전용 Agent는 별도 `agent` 태그로 배포합니다.

AI 코딩 도구에 다음처럼 요청할 수 있습니다.

> https://github.com/Kimmahone/edu-workspace-mcp 를 현재 사용하는 앱에 설치해 주세요. Node.js 22+와 정확한 공개 버전을 확인하고, 읽기 권한 5개만 사용하는 edu-workspace-agent를 등록해 주세요. 기존 앱 등록을 유지하고 Google 로그인·동의는 제가 직접 진행하겠습니다.

설치 담당 AI는 루트 `AGENTS.md`를 따릅니다. 계정 선택과 Google 동의는 사용자가 직접 진행합니다. 일반 사용자에게 Cloud 프로젝트·OAuth JSON·client secret을 요구하지 않습니다.

```sh
npm view edu-workspace-mcp@1.1.2 version
npx -y edu-workspace-mcp@1.1.2 setup
npx -y edu-workspace-mcp@1.1.2 setup codex
npx -y edu-workspace-mcp@1.1.2 login
npx -y edu-workspace-mcp@1.1.2 doctor
```

앱은 `codex`, `claude`, `claude-desktop`, `cursor` 중 선택합니다. 반복 설치는 `edu-workspace-agent`만 갱신하며 기존 `edu-workspace`, 다른 MCP 서버, 기존 Google 토큰과 웹 경로를 유지합니다. 충돌하거나 잘못된 설정 파일은 변경하지 않고 중단합니다.

권한은 Docs·Forms 본문·Forms 응답·Sheets·Slides 읽기 다섯 개이며 쓰기·Drive 검색·Classroom·이메일 신원 조회는 없습니다. 서버에서 Google 토큰을 처리하고 별도 MCP 자격증명을 로컬에 저장합니다. 등록, 원격 인증 상태, 실제 지정 문서 읽기를 각각 확인합니다. 자세한 보관·철회 설명은 [사용자 안내](WORKSPACE_READONLY_AGENT.md)와 [공개 개인정보처리방침](https://edu.jeld.kr/privacy.html)을 확인합니다.

## 운영자 공개 검사

정책 PR #20은 병합·게시됐습니다. 기존 AI Web OAuth client·KV·D1·인증 테이블을 재사용하며 운영자 비밀값은 사용자가 직접 등록합니다. 실제 Google 교환·읽기·fresh refresh·MCP 갱신 회전·사용자 분리·철회·Free CPU·만료 정리·실제 호스트 연결이 확인돼야 정식 공개할 수 있습니다.

`npm publish --tag agent`는 `prepublishOnly`의 `release:guard`를 실행합니다. `.release-readiness.local.json`에는 실제 확인한 상태와 시각만 기록하고 비밀값·토큰·자료 본문은 넣지 않습니다. fixture 결과를 live 성공으로 기록하지 않습니다. 이 기록은 Git과 npm에 포함하지 않습니다.

현재 요금 검토와 15분 이내 Free 계정 확인이 필요합니다. 무료 조건이 확인되지 않거나 검토가 만료되면 배포·인증·자료 접근을 중단하고 유료로 전환하지 않습니다. Google 결제 연결 해제는 이번 작업의 조건이 아니며 이전 해제 요청은 철회됐습니다. 향후 표준 한도 초과 과금 기준은 확인된 것으로 표시하지 않습니다.

## 기존 버전 보호

기존 1.1.1 이하에 새 옵션을 전달하거나 이전 실패한 공개 ID-only 로그인을 반복하지 않습니다. 기존 버전·기존 토큰을 유지한 채 검증된 새 Agent를 별도로 연결합니다. 고급 private/legacy/web 경로는 명시적으로 선택한 경우에만 사용합니다.

GitHub의 기존 npm 신뢰 게시 경로는 릴리스 첨부 `agent-release-readiness.json`을 받아 같은 공개 guard를 실행합니다. 운영자는 모든 실제 검사를 마친 뒤 `scripts/export-release-evidence.mjs`로 상태·시각·권한·공개 정책 해시만 허용 목록으로 내보냅니다. 이 첨부에는 로컬 상세 기록·계정 목록·문서·자격증명이 없고 정확한 릴리스 commit에 묶입니다. 원본 로컬 검증 파일은 계속 Git과 npm에서 제외합니다. 기존 OIDC 게시 권한을 사용하며 새 npm 토큰을 만들지 않습니다.
