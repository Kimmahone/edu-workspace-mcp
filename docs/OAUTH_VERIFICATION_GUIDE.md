# Google OAuth 검수 제출 가이드

이 문서는 Edu Workspace MCP의 공개 배포를 위한 Google OAuth 검수 자료 초안이다. Google Cloud 프로젝트는 `edu-workspace-mcp`, 앱 이름은 **Edu Workspace MCP**이다.

## 공개 정보

- 홈페이지: <https://edu.jeld.kr/>
- 개인정보처리방침: <https://edu.jeld.kr/privacy.html>
- 이용약관: <https://edu.jeld.kr/terms.html>
- 사용자 지원 이메일: `kimjj0709@gmail.com`
- 승인된 도메인: `jeld.kr`
- 소스 코드: <https://github.com/Kimmahone/edu-workspace-mcp>

## 앱 설명

Edu Workspace MCP는 교사와 교육자가 Claude, ChatGPT 등 MCP 호환 AI 클라이언트에서 Google Workspace for Education 도구를 사용할 수 있게 하는 오픈소스 로컬 애플리케이션이다. 사용자의 컴퓨터에서 실행되며 Google 공식 API와 직접 통신한다. 운영자가 사용자 문서나 OAuth 토큰을 수집하는 중앙 서버는 없다.

## 현재 최소 권한 구성

현재 앱은 다음 세 범위만 요청한다.

- `https://www.googleapis.com/auth/drive.file`
- `https://www.googleapis.com/auth/classroom.courses.readonly`
- `https://www.googleapis.com/auth/classroom.coursework.students`

기존 Workspace 자료 읽기를 선택한 사용자는 다음 서비스별 읽기 범위도 요청한다.

- `https://www.googleapis.com/auth/documents.readonly`
- `https://www.googleapis.com/auth/spreadsheets.readonly`
- `https://www.googleapis.com/auth/presentations.readonly`
- `https://www.googleapis.com/auth/forms.body.readonly`
- `https://www.googleapis.com/auth/forms.responses.readonly`
- `https://www.googleapis.com/auth/classroom.rosters.readonly`

앱은 제한 범위인 `drive`, `drive.readonly`, `drive.metadata.readonly`를 요청하지 않는다. 다만 Classroom 과제 쓰기와 서비스별 읽기 범위는 민감 범위 검수 대상이므로 공개 배포 전에 Google Cloud 데이터 액세스 화면 등록, 사용 사유와 데모 영상 제출이 필요하다.

## 범위 사용 사유

### `https://www.googleapis.com/auth/drive.file`

앱이 생성하거나 사용자가 앱에 명시적으로 연 Google Drive 파일을 찾고, 생성된 파일을 지정한 폴더로 이동하거나 사용자의 확인을 거쳐 공유하기 위해 필요하다. 전체 Drive에 대한 포괄적인 읽기 권한은 요청하지 않는다.

### `https://www.googleapis.com/auth/classroom.courses.readonly`

과제 초안을 만들 수업을 사용자가 정확히 선택할 수 있도록 로그인한 교사가 접근 가능한 활성 Classroom 수업 목록을 읽기 위해 필요하다.

### `https://www.googleapis.com/auth/classroom.coursework.students`

교사가 담당하는 수업에 과제 초안을 만들고 확인 후 게시하며, 과제별 학생 제출 상태와 점수를 조회하기 위해 필요하다. Google Classroom의 `courseWork.create`가 요구하는 공식 범위다.

### 서비스별 읽기 전용 범위

`documents.readonly`, `spreadsheets.readonly`, `presentations.readonly`, `forms.body.readonly`는 사용자가 URL 또는 ID로 지정한 기존 수업 자료를 읽고 요약·분석하는 데 필요하다. `forms.responses.readonly`는 형성평가 응답과 점수를 분석하는 데, `classroom.rosters.readonly`는 제출물의 사용자 ID를 학생 이름과 연결하는 데 필요하다. 이 범위는 `--read`를 선택한 경우에만 요청한다.

## 데이터 처리 요약

- OAuth 토큰은 기본적으로 사용자 컴퓨터의 `~/.edu-workspace-mcp/token.json`에 저장된다.
- 사용자 Google 데이터는 Google 공식 API와 사용자가 선택한 AI 클라이언트 사이에서 요청 수행에 필요한 범위로만 처리된다. 읽기 모드에서는 문서 내용, Forms 응답, 학생 명단·제출 상태·점수가 포함될 수 있다.
- 운영자는 별도 중앙 서버에 Google 사용자 데이터나 OAuth 토큰을 저장하지 않는다.
- 광고, 판매, 신용평가 또는 사용자 프로파일링에 Google 사용자 데이터를 사용하지 않는다.
- 사용자는 `npx edu-workspace-mcp disconnect`로 로컬 토큰을 삭제하고 Google 계정 설정에서 앱 권한을 철회할 수 있다.

## 데모 영상 시나리오

영상은 OAuth 동의 화면에서 앱 이름과 요청 범위를 읽을 수 있게 보여 주고, 각 범위가 실제 기능에 어떻게 연결되는지 한 번의 연속된 흐름으로 시연한다. 실제 학생 개인정보 대신 전용 테스트 수업과 가상 학생 데이터를 사용한다.

1. 공개 홈페이지, 개인정보처리방침, 이용약관을 차례로 보여 준다.
2. 터미널에서 설치 명령을 실행하고 MCP 호환 AI 클라이언트에 서버가 등록된 모습을 보여 준다.
3. `workspace_get_auth_status`가 미연결 상태임을 보여 준다.
4. `login --read`로 Google OAuth 로그인을 시작하고 동의 화면의 앱 이름, 지원 이메일, 요청 범위를 확대해 보여 준다.
5. 테스트 계정으로 동의한 뒤 연결 성공 상태를 보여 준다.
6. `classroom_list_courses`로 테스트 수업을 조회한다.
7. `drive_create_folder`로 데모 폴더를 생성한다.
8. `docs_create_document`로 짧은 수업안을 생성하고 결과 문서를 연다.
9. `sheets_create_workbook`으로 평가 체크표와 대시보드 시트를 생성하고 결과를 연다.
10. `slides_create_presentation`으로 2~3장의 수업 슬라이드를 생성하고 결과를 연다.
11. `forms_create_quiz`로 2~3문항의 퀴즈를 생성하고 결과를 연다.
12. 읽기 도구로 방금 만든 Docs·Sheets·Slides·Forms 내용을 다시 읽어 각 범위의 실제 사용 장면을 보여 준다.
13. 테스트 Forms 응답을 제출한 뒤 `forms_list_responses`로 응답을 읽는다.
14. 테스트 Classroom의 과제·학생 명단·제출 현황을 읽는다.
15. `classroom_create_assignment_draft`로 과제 초안을 만든 뒤 학생에게 보이지 않는 `DRAFT` 상태임을 보여 준다.
16. 앱이 게시 전에 확인을 요구하는 모습을 보여 주고, 테스트 수업에서만 게시 승인을 실행한다.
17. Drive 공유 도구가 대상과 권한을 먼저 확인하고 승인 없이는 공유하지 않는 흐름을 보여 준다.
18. `npx edu-workspace-mcp disconnect`로 로컬 토큰을 삭제하고 Google 권한을 철회할 수 있음을 보여 준다.

## 제출 전 체크리스트

- [ ] `https://edu.jeld.kr/`의 인증서가 유효하고 HTTP가 HTTPS로 리디렉션된다.
- [ ] Google Cloud의 앱 게시 상태가 `프로덕션`이다.
- [ ] 홈페이지, 개인정보처리방침, 이용약관과 지원 이메일이 OAuth 브랜딩에 저장되어 있다.
- [ ] `jeld.kr`의 Search Console 소유권이 프로젝트 소유자 계정으로 확인되어 있다.
- [ ] Google Cloud 데이터 액세스 화면의 범위와 `src/config.ts`의 범위가 일치한다.
- [ ] 테스트 계정에 실제 학생 개인정보가 없다.
- [ ] 데모 영상에 OAuth 동의 화면과 각 민감 범위의 실제 사용 장면을 포함했다.
- [ ] 검수 담당자가 접근 가능한 공개 또는 미등록 링크로 업로드하고 인증 센터에 등록했다.
- [ ] 최종 제출 내용을 검토하고 사용자의 확인을 받은 뒤 제출했다.
