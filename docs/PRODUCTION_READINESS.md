# 정식 배포 운영 기준

## 지원 범위

- Node.js 20 이상
- macOS, Windows, Linux
- Codex/ChatGPT Desktop 계열, Claude Code, Claude Desktop, Cursor 등 로컬 stdio MCP 클라이언트
- Google 개인 계정 및 관리자가 앱 접근을 허용한 Google Workspace 계정

ChatGPT 웹은 로컬 stdio 서버를 실행하지 못하므로 현재 정식 지원 범위가 아니다.

## 출시 게이트

정식 버전은 다음 조건을 모두 통과한 경우에만 npm `latest`로 게시한다.

1. TypeScript 정적 검사와 전체 단위·통합 테스트 통과
2. 실제 stdio MCP 연결 및 전체 도구 검색 성공 (현재 22개)
3. macOS, Windows, Linux와 Node.js 20·22·24 CI 통과
4. 운영 의존성 보안 감사에서 알려진 취약점 0건
5. `npm pack --dry-run`과 설치 후 실행 스모크 테스트 통과
6. OAuth 범위, 개인정보처리방침, 이용약관, 지원 연락처 일치
7. 실제 Google 테스트 계정에서 로그인, 콘텐츠 조회, 생성, 초안 흐름 검증
8. 읽기 확장 범위에 대한 Google OAuth 민감 범위 검수 상태 확인

## 현재 출시 진행 상태 (2026-09-07)

- [x] `main` 소스와 공개 문서를 1.0.0으로 갱신
- [x] 전체 22개 MCP 도구 및 실제 Google 계정 E2E 검증
- [x] macOS, Windows, Linux와 Node.js 20·22·24 CI 통과
- [x] OAuth 브랜딩, 외부 사용자용 프로덕션 상태, 공개 URL 확인
- [x] Google Cloud에 읽기 확장 범위와 범위 근거 저장
- [ ] 실제 학생 개인정보가 없는 데모 영상 촬영 및 YouTube 미등록 업로드
- [ ] Google 데이터 액세스 검수 제출 및 승인
- [ ] npm Trusted Publisher에 `publish.yml` 연결
- [ ] GitHub Release `v1.0.0` 게시 및 npm `latest` 1.0.0 확인

`v1.0.0` GitHub Release를 게시하면 `.github/workflows/publish.yml`이 전체 출시 검사를 다시 실행하고 npm Trusted Publishing으로 동일 버전을 게시한다. 릴리스 태그와 `package.json` 버전이 다르면 게시를 중단한다.

## 버전 정책

- 메이저 버전: MCP 도구 이름·필수 입력·권한 범위의 호환되지 않는 변경
- 마이너 버전: 호환되는 도구와 기능 추가
- 패치 버전: 오류 수정, 문서, 보안 및 안정성 개선

학교·기관 배포에서는 `edu-workspace-mcp@1.0.0`처럼 정확한 버전을 고정하고 검증한 뒤 업데이트한다.

## 운영 및 비용 보호

- Google Cloud 결제 보고서와 API 할당량을 정기적으로 확인한다.
- 결제 계정에 낮은 예산 알림을 설정한다. 예산 알림은 결제를 자동 차단하지 않는다는 점을 유의한다.
- 비정상 호출 증가, OAuth 오류율, 403/429 응답을 확인한다.
- 대규모 학교·교육청은 자체 OAuth 프로젝트를 선택적으로 사용해 할당량과 운영 책임을 분리할 수 있다.
- Google API 범위를 추가하기 전에 검증 필요 여부와 개인정보처리방침을 갱신한다.

## 사고 대응

1. OAuth 클라이언트 또는 패키지 오용이 의심되면 신규 배포를 중단한다.
2. 필요한 경우 Google Cloud에서 OAuth 클라이언트를 교체하거나 비활성화한다.
3. 영향받은 사용자에게 Google 계정의 앱 접근 철회와 재로그인을 안내한다.
4. 수정 버전을 게시하고 GitHub Security Advisory를 통해 사실과 대응을 공개한다.
