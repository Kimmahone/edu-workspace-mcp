# 배포자용 공용 Google OAuth 설정

이 작업은 `edu-workspace-mcp` 배포자가 프로덕션 출시 전에 **한 번만** 수행한다. 최종 사용자는 Google Cloud Console을 사용하지 않는다.

## 1. 프로덕션 프로젝트

1. Google Cloud Console에서 `edu-workspace-mcp-production` 같은 별도 프로젝트를 만든다.
2. Drive, Docs, Sheets, Slides, Forms, Classroom API를 활성화한다.
3. OAuth 동의 화면에 앱 이름, 지원 이메일, 홈페이지, 개인정보처리방침, 서비스 약관을 등록한다.
4. [OAUTH_SCOPES.md](OAUTH_SCOPES.md)의 범위만 신청한다.
5. Desktop 앱 유형의 OAuth client ID를 만든다.

## 2. 앱에 공용 client ID 포함

Google의 설치형 앱은 client secret을 비밀로 유지할 수 없는 공개 클라이언트다. 발급된 client ID와 필요 시 client secret을 `src/auth/bundled-oauth-client.ts`에 설정한다.

```ts
export const BUNDLED_GOOGLE_OAUTH_CLIENT = {
  clientId: "YOUR_CLIENT_ID.apps.googleusercontent.com",
  clientSecret: "YOUR_DESKTOP_CLIENT_SECRET"
} as const;
```

공용 값이 비어 있으면 다음 개발자용 대체 구성을 순서대로 사용한다.

1. `EDU_WORKSPACE_GOOGLE_CLIENT_ID`, `EDU_WORKSPACE_GOOGLE_CLIENT_SECRET` 환경 변수
2. `~/.edu-workspace-mcp/credentials.json`

## 3. OAuth 검증

Classroom과 Workspace 데이터 범위는 공개 앱 검증이 필요할 수 있다. Google에 다음 자료를 제출한다.

- 검증된 홈페이지 도메인
- 개인정보처리방침과 서비스 약관
- 범위별 사용 목적
- OAuth 동작과 기능을 보여 주는 데모 영상
- 데이터 보관·삭제·보안 설명

검증 전에는 OAuth 동의 화면의 테스트 사용자만 로그인할 수 있다. 프로덕션으로 전환하고 검증이 끝나면 일반 사용자는 앱 설치 후 Google 로그인만 하면 된다.

## 4. 학교 관리자 안내

Google Workspace for Education 관리자는 제3자 앱을 제한할 수 있다. 앱 홈페이지에 OAuth client ID, 요청 범위, 데이터 흐름, 개인정보처리방침, 관리자 허용 절차를 제공한다. 이 정책은 MCP에서 우회할 수 없다.

## 5. 릴리스 검사

```bash
npm run check
npm test
npm run test:mcp
npm pack --dry-run
```

테스트/프로덕션 프로젝트와 OAuth client ID를 분리한다. 실제 학생 데이터가 아닌 테스트 수업으로 E2E를 실행한다.
