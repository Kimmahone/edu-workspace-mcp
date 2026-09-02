# Contributing

기여를 환영합니다. 이 프로젝트는 교육기관 데이터와 외부 변경 작업을 다루므로 기능보다 안전한 권한 경계를 우선합니다.

## 개발 환경

```bash
npm install
npm run check
npm test
npm run test:mcp
```

## 원칙

- 새 Google OAuth 범위를 추가하면 README에 목적과 위험을 설명합니다.
- 외부 상태를 바꾸는 도구에는 올바른 MCP annotations와 사용자 확인 흐름을 추가합니다.
- 실제 학생·교사 개인정보를 fixture나 로그에 포함하지 않습니다.
- Google API 호출은 `src/google/`에 두고 MCP 계약은 `src/server.ts`에서 관리합니다.
- 새 도구에는 성공, 인증 실패, 입력 오류 테스트를 추가합니다.

Pull Request에는 변경 이유, 사용한 OAuth 범위, 테스트 결과, 되돌리기 어려운 외부 영향 여부를 적어 주세요.
