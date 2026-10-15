# 개인정보 처리 안내

공개 정책의 기준 문서는 [https://edu.jeld.kr/privacy.html](https://edu.jeld.kr/privacy.html)입니다. 이 문서는 저장소에서 데이터 흐름을 빠르게 확인하기 위한 요약입니다.

## 기존 로컬 stdio 버전 (1.1.1 이하·명시적 private/legacy 경로)

- 배포용 데스크톱 OAuth 클라이언트 식별자는 앱에 포함되며, 사용자의 Google 액세스·갱신 토큰은 사용자의 컴퓨터에만 저장됩니다.
- MCP 서버는 요청을 처리하기 위해 Google API와 직접 통신합니다.
- 프로젝트 자체는 사용자의 문서 내용이나 토큰을 별도 중앙 서버로 전송하거나 수집하지 않습니다.
- AI 클라이언트가 MCP 도구에 전달한 내용은 해당 AI 서비스의 데이터 정책을 따릅니다.

## 저장 위치와 삭제

- 기본 설정 폴더: `~/.edu-workspace-mcp`
- OAuth 권한 철회 및 토큰 삭제: `npx -y edu-workspace-mcp@1.0.0 disconnect`
- Google 계정의 제3자 앱 액세스 화면에서도 권한을 철회할 수 있습니다.

## 처리하는 데이터

사용자가 호출한 도구에 따라 파일 이름·내용, Drive 파일 ID, Classroom 수업·과제 정보가 Google API 요청에 포함될 수 있습니다. 읽기 확장 모드를 선택하면 기존 Docs·Sheets·Slides·Forms 내용, Forms 응답, 담당 수업의 학생 이름·이메일·제출 상태·점수도 처리할 수 있습니다. 구조 진단 도구는 셀 값과 수식 본문을 MCP 응답에 포함하지 않으며, Classroom 제출 대시보드는 학생 매칭에 쓴 사용자 ID를 결과 파일에 저장하지 않습니다. 앱은 보호자 정보, Gmail 또는 전체 Drive 범위를 요청하지 않습니다.

## 원격 버전

호스팅형 MCP는 아직 배포하지 않았습니다. 1.1.2 후보에는 로컬 stdio→원격 MCP 연결 코드가 있으며 공개 인증·배포는 보류합니다. 무료 운영 확인과 실제 Google 검증 전에 일반 사용자에게 제공하지 않습니다.

후보 구조에서는 운영자 Cloudflare Worker가 Google 인증 코드·verifier·토큰과 사용자가 지정한 문서·시트·슬라이드·폼 응답을 처리합니다. Google refresh token은 서버 키로 암호화해 D1에 보관하고 Google access token은 API 호출 동안 메모리에서만 사용합니다. 임시 OAuth transaction은 암호화해 KV에 최대 10분, 연결은 30일 미사용 만료로 설계합니다. 문서 본문은 서버 DB·캐시·로그·학습 자료에 저장하지 않으며 요청한 AI 앱으로 전달합니다. AI 앱의 데이터 정책은 별도로 적용됩니다.

사용자 컴퓨터의 `~/.edu-workspace-mcp-agent/remote/`에는 별도 MCP credential만 저장합니다. 연결 해제는 서버 접근 차단·활성 Google token ciphertext 제거·선택한 로컬 MCP credential 제거이며 Google 프로젝트 전체 동의까지 철회하지 않습니다. 전체 Google revoke는 같은 프로젝트의 일반 client에도 영향을 줄 수 있어 별도 확인이 필요합니다. 활성 DB 삭제와 백업의 즉시 물리 삭제는 다르며 Cloudflare D1 Free Time Travel 이력은 7일입니다.

운영자·처리 목적·지역/하위 처리자·만료 정리·복구 절차·권리 요청 방법을 실제 운영 조건에 맞춰 공개 정책에도 반영한 후 배포해야 합니다. 이 저장소 문서 수정만으로 현재 공개 홈페이지의 개인정보처리방침을 변경했다고 보고하지 않습니다.
