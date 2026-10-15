# Workspace 읽기 전용 원격 Agent

새 기본 경로는 운영자의 Web OAuth/MCP 서버를 사용하는 읽기 전용 Agent입니다. 사용자는 Cloud 프로젝트, OAuth JSON 또는 client secret을 준비하지 않습니다. 기존 `edu-workspace` 등록과 Google 토큰은 유지하며 `edu-workspace-agent`를 별도로 등록합니다.

요청 범위는 다음 다섯 개입니다. Classroom·Drive·쓰기·openid·email·profile 권한을 추가하지 않습니다. 실제 Google 승인 범위의 누락과 초과를 모두 거절합니다.

- `documents.readonly`
- `forms.body.readonly`
- `forms.responses.readonly`
- `spreadsheets.readonly`
- `presentations.readonly`

## 일반 사용자 연결

정식 공개가 확인된 정확한 버전으로 실행합니다. Node.js 22+가 필요합니다. 공개 전에는 아래 후보를 이전 로그인 방식으로 대체하지 않습니다.

```sh
npm view edu-workspace-mcp@1.1.2 version
npx -y edu-workspace-mcp@1.1.2 setup
npx -y edu-workspace-mcp@1.1.2 setup codex
npx -y edu-workspace-mcp@1.1.2 login
npx -y edu-workspace-mcp@1.1.2 doctor
```

`setup codex`는 사용할 앱 이름으로 바꿀 수 있습니다. 지원 앱은 `codex`, `claude`, `claude-desktop`, `cursor`이며 `setup all`은 사용자가 선택한 경우에만 감지된 앱에 적용합니다. Google 계정 선택과 읽기 권한 동의는 사용자가 직접 진행합니다. 등록·doctor 성공과 지정한 문서의 실제 읽기는 각각 확인해야 합니다.

로컬 `~/.edu-workspace-mcp-agent/remote/default.json`에는 별도 MCP 자격증명만 권한 600으로 저장합니다. Google 갱신 토큰은 서버에 암호화해 보관하며 Google 액세스 토큰과 요청한 문서 본문은 서버에 저장하지 않습니다. 다른 앱의 동시 갱신은 파일 lock으로 보호합니다.

```sh
npx -y edu-workspace-mcp@1.1.2 disconnect
```

이 명령은 해당 Agent 서버 연결과 로컬 MCP 자격증명을 제거합니다. 같은 Google 프로젝트의 기존 일반 앱을 보호하기 위해 Google 프로젝트 전체 동의는 자동 철회하지 않습니다. 서버 철회를 확인하지 못하면 완료로 표시하지 않습니다.

## 무료 운영과 자료 처리

서버는 확인한 Cloudflare Free와 현재 Google 표준 무료 사용 조건 안에서만 운영합니다. 한도 초과 또는 요금 검토 만료 시 요청을 중단하고 유료로 자동 전환하지 않습니다. 변경된 무료 조건을 확인할 수 없으면 운영을 중단하고 재검토합니다. 연결한 AI 앱의 이용 조건은 별도로 적용됩니다. Google 원본·파생 자료를 범용 AI 학습에 사용하는 서비스로 보내지 않습니다.

자료 처리·보관·철회·D1 복구 이력은 [개인정보처리방침](https://edu.jeld.kr/privacy.html), 무료 운영 조건은 [이용약관](https://edu.jeld.kr/terms.html)에 설명합니다.

## 운영자 제한 시험

정식 공개 전 운영자는 검토한 로컬 후보의 `npm run pilot:live`를 직접 실행합니다. 서로 다른 Google 계정 두 개와 첫 계정만 접근할 수 있는 민감정보 없는 Docs 시험 문서가 필요합니다. 검사 결과에는 상태와 시각만 기록하며 비밀값·토큰·문서 본문은 기록하지 않습니다. 실제 검증과 무료 CPU, 만료 정리, 실제 앱 연결이 모두 확인되기 전에는 공개 guard를 통과한 것으로 기록하지 않습니다.

## 기존 고급 경로

기존 웹과 명시적인 `--legacy` 경로는 유지합니다. 별도의 private credentials 환경변수를 직접 지정한 고급 경로는 기존 비공개 OAuth 설정을 사용합니다. 일반 사용자 설치에서 이 경로를 자동 선택하거나 운영자 JSON을 배포하지 않습니다. 1.1.1 이하에는 `--workspace-readonly`를 전달하지 않습니다. 새 버전은 `agent` 태그와 정확한 버전 번호로 제공해 기존 `latest` 사용자를 자동 전환하지 않습니다.
