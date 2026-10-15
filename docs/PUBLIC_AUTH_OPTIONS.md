# 공개 MCP 인증·운영 상태

## 2026-10-15 현재 상태

별도 AI 전용 Web client와 Free 전용 인증 Worker·KV·D1을 준비해 실제 제한 시험에 사용했습니다. 사용자는 Google JSON을 준비하지 않습니다. Google 갱신 토큰은 서버에서 암호화하고 컴퓨터에는 별도 MCP 자격증명만 저장합니다.

서로 다른 Google 계정 두 개로 코드 교환·정확한 읽기 권한5개·비공개 Docs 읽기·새 Google 갱신·MCP 갱신 회전·계정 간 접근 차단·두 연결 해제를 실제 확인했습니다. 실제 Free CPU 지표와 한도 초과 요청 차단도 확인했습니다. 배포 후보 tarball을 임시 폴더에 npm 설치한 뒤 실제 Codex 호스트가 도구10개를 인식하는 것을 확인했습니다. 이 시험은 기존 사용자 등록을 변경하지 않습니다. 전용 Worker의15분 정리 Cron이 실제로 만료 암호문과 오래된 행을 제거하고 활성 시험 행을 보존한 것을 확인했습니다. 시험용 행은 모두 제거했습니다. 게시 준비에 필요한 실제 검증은 통과했으며, 정확한1.1.2 게시 여부는 npm registry에서 확인합니다. 기존 GitHub 신뢰 게시 경로에서도 같은 검증 guard를 실행하며 새 장기 npm 토큰은 만들지 않습니다.

현재 Google Docs·Forms·Sheets·Slides API의 표준 사용은 추가 비용이 없습니다. Cloudflare는 Free만 유지하며 별도 모델 API는 호출하지 않습니다. 향후 Google 초과 사용 과금의 기준·시행일은 검토한 문서에서 확정되지 않아 제한된 현재 요금 검토를 사용합니다. 검토 만료 시 OAuth와 문서 읽기를 중단하고 실제 조건을 재확인한 뒤에만 재개합니다. 검토를 자동 갱신하거나 유료로 전환하지 않습니다. Google 결제 연결 해제는 필요조건이 아니며 기존 앱의 설정을 바꾸지 않습니다.

일반 설치는 [공개 설치 절차](PUBLIC_MCP_INSTALL.md), 데이터 처리·보관·연결 해제는 [개인정보처리방침](https://edu.jeld.kr/privacy.html)을 확인하세요. 기존 latest1.1.1은 유지하고 새 Agent는 별도 agent태그를 사용합니다.

## 이하:2026-10-13~14 대안 검토의 보존 기록

아래의 “미구현·미배포·미검증”은 당시 상태를 뜻합니다. 현재 상태는 위의2026-10-15 기록을 기준으로 합니다. 같은 Desktop 공개ID 전용 로그인을 다시 시험하지 않습니다.

2026-10-13 현재 공개 배포는 보류합니다. 새 서버·계정·OAuth 클라이언트·권한·결제·자격증명 입력은 진행하지 않았습니다. 아래는 선택을 위한 제안이며 구현·성공 보장이 아닙니다.

## 현재 근거와 한계

사용자가 승인한 보완 검사에서 실제 browser callback 뒤 Google token endpoint가 **HTTP 400 / invalid_request / client_secret is missing.**를 반환했습니다. 코드 교환은 실패했고 토큰을 받지 못해 fresh refresh는 실행되지 않았습니다. 현재 Agent client의 secret 없는 코드 교환이 secret 누락으로 거절된 직접 근거이며, 모든 Desktop client의 공개 인증이 불가능하다는 증거는 아닙니다.

첫 검사의 `PUBLIC_CLIENT_SECRET_ERROR_AT_code_exchange`는 오류 설명에 client_secret 문자열이 있다는 것만 뜻했습니다. 첫 검사의 HTTP status·error 종류는 복원하지 않았고, 보완된 실제 검사에서 허용된 응답 필드만 새로 확인했습니다. 기존 결과와 보완 검사 결과는 별도로 보존했습니다.

lock의 `google-auth-library` 10.9.1로 code exchange와 새 OAuth2Client의 refresh 요청에 client_secret/Authorization 헤더가 없는 것을 mock 검사했습니다. 실제 검사는 JSON·secret·기존 토큰 파일을 읽지 않았습니다. [Google native-app 문서](https://developers.google.com/identity/protocols/oauth2/native-app)는 Desktop loopback과 PKCE를 설명하고 교환·갱신의 secret을 Optional로 표시합니다. 공식 문서의 Optional 표기와 현재 client의 실제 거절을 구분합니다. 모든 Desktop ID의 secret 없는 인증이 불가능하다거나 중계가 반드시 필요하다고 단정하지 않습니다.

## 선택 비교

| 제안 | 사용자 설치 단계 | 보안·운영 부담 | 필요한 추가 결정·승인 |
| --- | --- | --- | --- |
| 개인용 Agent JSON 임시안 | 현재 소유자가 이미 다운로드한 AI 전용 Desktop JSON을 기기의 전용 폴더에 직접 배치 → 명시적 private credentials 경로로 5개 읽기 로그인 → doctor → 선택 앱의 별도 Agent 등록 | secret·refresh token이 사용자 기기에 존재. 기존 일반 앱 토큰과 분리. 서버 운영은 없음. 실제 로그인·갱신 성공은 아직 검증 전 | 사용자가 private 파일을 직접 배치하고 로그인. 모델은 파일을 읽지 않음. 일반 사용자에게 운영자 JSON을 배포하지 않음 |
| 운영자 인증 중계 | 운영자가 승인된 인증 서비스를 준비한 후 사용자는 패키지 설치 → 브라우저 동의. 사용자에게 Cloud 프로젝트·JSON은 요구하지 않는 방향 | operator secret은 서버에, 사용자 code·verifier·토큰은 서버를 거쳐 처리. HTTPS, abuse 방지, 로그 정책, secret 회전·장애 대응, 비용 관리, 개인정보 안내가 필요. 문서 읽기를 계속 로컬에서 할지 결정 필요 | 새 서비스·hosting/비용·secret 보관·사용자 토큰 처리 목적지·보관 정책·개인정보 안내·새 AI Web client 필요 여부와 origin/redirect 설정을 구체적으로 승인. 아직 구현·배포하지 않음 |
| GIS browser token model | 전용 브라우저 로그인 화면에서 버튼 클릭 → 5개 읽기 승인 → 짧은 access token으로 사용. 만료 시 사용자 버튼으로 새 token 요청 | browser 흐름에는 secret이 필요하지 않고 refresh token 없이 사용 가능. 장기 offline·무인 갱신을 제공하지 않음. 로컬 MCP에 토큰을 안전하게 전달하는 설계는 별도 검증 필요 | 새 AI 전용 Web client와 JavaScript origin, local UI/loopback 전달 설계 승인. 기존 일반 Web client를 AI로 변경·혼용하지 않음. 짧은 세션·재인증 UX 수용 여부 결정 |

### 개인용 JSON의 적용 범위

현재 운영자가 이미 보유한 Agent JSON을 자기 Mac에서 사용하는 임시안입니다. 이를 일반 사용자에게 비공개 경로로라도 복사 배포하는 것은 이번 제안에 포함하지 않습니다. 각 일반 사용자가 자신의 client를 사용하려면 자체 Cloud 프로젝트·OAuth 설정·필요한 승인 부담이 생겨 원래의 “GitHub 주소 → 설치 → 브라우저 로그인” 목표를 충족하지 못합니다.

공개 후보는 private JSON 모드를 명시적 환경변수로만 허용하고 일반 public login은 차단합니다. 기존 Agent 로그인용 로컬 준비물은 별도 경로·범위를 사용합니다. 아직 실제 JSON을 읽거나 이 경로로 새 동의를 실행하지 않았습니다. private JSON 안의 client가 AI 전용인지와 요청 권한 5개는 사용자가 직접 확인해야 합니다.

### 중계의 공식 경로와 검증 범위

[Google Web server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server)는 confidential client의 secret을 서버에 보관하고 code를 교환하는 공식 경로입니다. 현재 Desktop Agent의 token endpoint를 단순 프록시하면 해결된다는 것은 검증하지 않았습니다. 공식 Web server 흐름을 채택할 경우 AI 전용 Web client·HTTPS callback을 별도로 구성하는 설계가 자연스럽지만, 그 생성·설정은 추가 승인 사항입니다.

후보 대상은 현재 운영자의 Cloudflare 계정에서 새 `edu-workspace-mcp-oauth` 서비스를 만드는 안입니다. 아직 생성·설정·배포하지 않았습니다. secret은 사용자가 직접 입력하고 모델이 읽지 않습니다. 사용자 code·verifier·refresh/access token을 operator 서버가 처리한다는 데이터 흐름을 사전에 공개해야 합니다. 플랫폼 로그/observability에서도 민감한 URL·body·headers를 수집하지 않는지 확인해야 합니다. 로컬 토큰만 저장하는 설계라도 refresh가 중계를 거친다는 부담은 남습니다.

### 서버 없는 공식 방식의 한계

[GIS token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model)은 web app용 공식 방식이며 token 만료 후 사용자 동작으로 새 token을 요청합니다. [client 설정 문서](https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid)는 Web browser client와 승인된 JavaScript origin을 요구하며 secret은 서버 측 작업에만 필요하다고 설명합니다. 이 방식에 로컬 browser UI를 붙여 MCP에 짧은 token을 전달하는 것은 본 검토의 추론·설계 후보이며 구현하거나 Google의 현재 AI client에서 시험한 것이 아닙니다. 새 AI 전용 Web client가 필요하고 기존 Web 두 개를 재사용하지 않습니다.

[Device flow](https://developers.google.com/identity/protocols/oauth2/limited-input-device)의 지원 범위에는 이 프로젝트의 정확한 읽기 5개가 없으므로 대체하지 않습니다. [OOB 복사·붙여넣기 흐름](https://developers.google.com/identity/protocols/oauth2/resources/oob-migration)은 폐기됐습니다. Service account/domain-wide delegation은 일반 사용자의 개인 Google 로그인 목표와 달라 새 보안 권한을 요구하는 우회안으로 채택하지 않습니다.

[Google AI client isolation 안내](https://support.google.com/cloud/answer/15549257?hl=en)에 따라 일반 앱과 Agent workflow는 별도 client를 유지해야 합니다. 기존 local web이 Desktop 로그인에 의존하는 혼용 가능성도 계속 보존·분리해 검토합니다.

## 추가 로그인 시험의 가치

보완된 검사 한 번으로 현재 client의 실제 secret 누락 응답을 확인했습니다. 같은 공개 ID-only 요청을 반복할 구체적인 이득은 없으므로 추가 재로그인을 요청하지 않습니다.

추가 시험을 검토할 이유는 보완된 진단으로 HTTP status + 안전한 OAuth error + allowlist error_description을 얻어 **고칠 수 있는 요청 오류인지, 이 client의 secret 요구인지, 다른 정책 문제인지**를 구분할 때입니다. SDK 요청 형태·PKCE 생성과 verifier 연결·redirect 일치·정확한 ID를 먼저 offline mock으로 점검해야 합니다. 확인할 가설과 결과별 다음 행동을 정리한 뒤 사용자에게 별도로 실행을 요청합니다. 성공 시에도 cached access-token API 성공만으로 끝내지 않고 새 OAuth2Client의 refresh까지 확인해야 합니다.

이번 진단은 `invalid_request` + `client_secret is missing.`을 실제로 포착했으므로 해당 client의 공개 직접 흐름을 계속 보류하고 private JSON/공식 문의/추가 승인된 대안을 비교할 근거가 됩니다. `invalid_grant` + PKCE 관련 설명이라면 패키지 요청 수정의 가치가 있습니다. 설명이 미인식이면 전체 예외를 출력하지 않고 가려진 상태로 공식 확인을 검토합니다. 문의 전송도 사용자 요청 없이 하지 않습니다.

## 기존 앱과 배포 제한

실행 중인 기존 저장소의 source·dist에는 legacy bundled fallback이 유지돼 있고 현재 후보는 별도 worktree입니다. 실제 사용자 토큰을 읽지 않았으므로 현재 기존 로그인 성공을 새로 입증한 것은 아닙니다.

후보는 기존 등록·다른 MCP 서버·웹 설정을 유지하면서 `edu-workspace-agent`를 별도로 추가합니다. 그러나 후보는 공개 secret 배포를 중단하므로 기존 bundled OAuth에 의존한 사용자는 후보로 자동 업그레이드할 수 없습니다. private credentials가 있는 기존 Web/legacy 모드는 기능을 유지하지만 실제 인증 호환성은 사용자 시험이 필요합니다. 기존 앱과 토큰을 후보로 자동 교체·이동하지 않습니다. 따라서 아직 호환성이 완결된 공개 릴리스가 아닙니다.
# 2026-10-14 구현 상태와 무료 배포 제한

사용자는 남은 구현을 요청했고 **무료 요금제만 허용하며 무료 여부를 확인할 수 없으면 배포 금지**라고 정했습니다. 현재 후보의 일반 Agent 경로는 원격 MCP 로그인·stdio bridge이고, Google private JSON 환경변수를 명시한 경우와 legacy/web 경로는 분리되어 있습니다. 서버 소스는 공개 package 밖의 비공개 개발 폴더에 있습니다. 별도 Gemini/OpenAI 모델 API는 새 MCP에 넣지 않습니다.

Cloudflare 화면에서 Workers **Free / US$0 / 현재 요금제**를 확인했습니다. 현재 공식 문서는 [Docs](https://developers.google.com/workspace/docs/api/limits)·[Forms](https://developers.google.com/workspace/forms/api/limits)·[Sheets](https://developers.google.com/workspace/sheets/api/limits)·[Slides](https://developers.google.com/workspace/slides/api/limits)의 표준 사용을 추가 비용 없이 제공한다고 명시합니다. Google `edu-workspace-mcp` 프로젝트의 결제 연결 자체는 이번 MCP의 과금이나 배포 차단 근거가 아니며, 결제 해제를 필요조건으로 안내한 부분은 정정했습니다. **이전 결제 해제 승인 요청은 철회하고 더 이상 권고하지 않습니다. 답변이 와도 실행하지 않습니다.**

[Google의 표준 사용량 안내](https://developers.google.com/workspace/tools-safety)는 2026년 후반의 초과 사용 과금을 예고하며 검토한 문서에서는 새 일일 기준과 시행일이 확인되지 않았습니다. 하루 600회 서버 제한은 프로젝트 전체 과금 제한이나 영구 무료 보장이 아닙니다. 비공개 배포 검사는 현재 요금 검토(최대 24시간), 최신 Cloudflare Free 확인, 승인된 읽기 권한·AI 전용 Web client·별도 배포 승인에 근거합니다. 검토 만료 시 OAuth/MCP를 차단하고 재검토 전 유료 서비스로 전환하지 않습니다. 계정 요금제를 실시간 검사하거나 검토를 자동 갱신하는 기능은 아닙니다.

새 Web client·secret·실제 Google 교환/갱신/읽기·4개 실제 앱 활성화·공개 서버/npm 배포는 아직 완료하지 않았습니다. 다음의 이전 검토안은 배경 자료이며 Desktop secret 프록시를 운영 권고로 채택했다는 뜻이 아닙니다.

