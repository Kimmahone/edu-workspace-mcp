# Google Workspace 관리자 허용 안내

학교 계정에서 `admin_policy_enforced`, `access_blocked`, `400 access_not_configured` 오류가 표시되면 Google Workspace 관리자가 앱을 허용해야 한다.

## 앱 정보

- 앱 이름: Edu Workspace MCP
- OAuth 클라이언트 ID: `749884149912-4nl430614qdfm27clnqtj0imvvfr7j5g.apps.googleusercontent.com`
- 홈페이지: https://edu.jeld.kr/
- 개인정보처리방침: https://edu.jeld.kr/privacy.html
- 지원 이메일: kimjj0709@gmail.com

## 요청 범위

- `https://www.googleapis.com/auth/drive.file`
- `https://www.googleapis.com/auth/classroom.courses.readonly`
- `https://www.googleapis.com/auth/classroom.coursework.students`

읽기 확장 모드를 사용하는 교직원은 다음 읽기 전용 범위도 승인해야 한다.

- `https://www.googleapis.com/auth/documents.readonly`
- `https://www.googleapis.com/auth/spreadsheets.readonly`
- `https://www.googleapis.com/auth/presentations.readonly`
- `https://www.googleapis.com/auth/forms.body.readonly`
- `https://www.googleapis.com/auth/forms.responses.readonly`
- `https://www.googleapis.com/auth/classroom.rosters.readonly`

앱은 Gmail, 보호자 정보 또는 전체 Google Drive 범위를 요청하지 않는다. 읽기 확장 모드에서는 교사가 담당하는 수업의 학생 명단, Forms 응답, 제출 상태와 점수를 처리할 수 있다.

## 관리자 설정

1. Google 관리 콘솔에서 **보안 → 액세스 및 데이터 관리 → API 제어**로 이동한다.
2. **서드 파티 앱 액세스 관리 → 새 앱 구성**을 선택한다.
3. 위 OAuth 클라이언트 ID로 앱을 검색한다.
4. 적용할 교직원 조직 단위를 선택한다.
5. 기관 정책에 따라 **특정 Google 데이터**를 선택하고 사용할 기능에 해당하는 위 범위만 허용하거나, 검토 후 **신뢰함**으로 설정한다.
6. 저장 후 교사가 `login` 또는 `login --read`를 다시 실행한다. 정책 반영에는 시간이 걸릴 수 있다.

학생 조직 단위에 앱을 허용할 필요는 없다. 현재 앱의 대상 사용자는 자신의 수업 자료와 Classroom 과제를 관리하는 교사·교육자다.
