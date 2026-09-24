# Changelog

이 프로젝트는 [Semantic Versioning](https://semver.org/)을 따릅니다.

## Unreleased

### 보기 좋은 문서 양식

- `docs_create_lesson_plan`: 제목 상자·기본 정보표·핵심 용어·차시별 흐름표·단계별 교수·학습 과정표·평가 계획표·지도상 유의점을 갖춘 교수·학습 과정안을 만듭니다. 같은 단계는 칸을 합치고 시간을 더하며, 차시가 여럿이면 차시마다 새 쪽에서 시작합니다.
- `docs_create_worksheet`: 교과서 활동 쪽 같은 학생용 학습지. 학년·반·번호·이름 칸, 학습 목표 상자, 활동 이름표와 번호 붙은 물음, 이름표 달린 줄 있는 답 칸(`write`), 빈 표(`table`, 행 이름 가능), ○ 자기 점검표(`checklist`), 큰 칸(`box`), 도움말 상자. 수업 패키지 프롬프트도 학습지는 이 도구를 쓰도록 바꿨습니다.
- `docs_create_document`를 새 양식으로 바꿨습니다: 제목 상자, 절 제목, 소제목(`##`), 진짜 글머리·번호 목록, 머리행 있는 표, 참고 상자(`>`), 굵게(`**`), 선택 `subtitle`. 성취기준은 표로, 출처는 작은 회색 글씨로 넣습니다.
- A4 용지·여백, 한글 글꼴(Noto Sans KR)과 한글 굵게, 표 머리행 쪽마다 반복, 표의 행이 두 쪽으로 쪼개지지 않게, 제목은 다음 내용과 같은 쪽에 두도록 인쇄 설정을 입힙니다.
- 문서는 HTML을 Drive에서 Google Docs로 변환해 만들고, 변환이 살리지 못하는 설정은 Docs API로 한 번 더 입힙니다. 새 OAuth 범위는 없습니다. 인쇄 설정만 실패하면 문서는 남기고 `warning`을 돌려줍니다.

### 문서와 홈페이지

- README에 「이 서버가 하는 일과 하지 않는 일」(삭제·기존 파일 수정·점수 입력 없음, 공유 알림 메일), 「Google이 멈추거나 느릴 때」, 자동 보안 검사에서 보일 수 있는 공개 client secret과 `spawn` 두 곳의 설명을 더했습니다.
- 공식 홈페이지에 교수·학습 과정안, 학습지 양식, 성취기준 찾기 예시 프롬프트를 더했습니다.

### 초등 교육과정 성취기준 연결

- `curriculum_search_standards`, `curriculum_get_standards`: 초등 2022 개정 교육과정 성취기준 620개를 교과·학년·낱말·코드로 찾습니다. 패키지에 든 정리본만 읽어 인터넷과 Google 로그인 없이 동작합니다.
- `docs_create_document`, `education_create_assessment_tracker`, `forms_create_quiz`, `classroom_create_assignment_draft`에 `standardCodes` 추가. 서버가 정리된 원문과 출처를 붙이며, 모르는 코드는 Google 호출 전에 비슷한 코드를 제안하고 멈춥니다.
- 과정중심평가 시트의 평가계획 탭을 성취기준으로 미리 채우고, 성취기준 교과를 교과 드롭다운에 더합니다.
- MCP 프롬프트 `lesson_package_with_standards`: 성취기준 선택부터 수업안·학습지·슬라이드·형성평가·Classroom 초안까지 한 흐름으로 안내합니다.
- 데이터 원천은 `korean-elementary-learning-map-mcp` 0.5.1(MIT, devDependency 고정). NCIC PDF 자동 추출 원문 중 113개를 정리(띄어쓰기 36곳 포함)하고, 표가 섞였거나 해설 문단이 들어간 13개는 「원문 확인 필요」로 둡니다. `npm run curriculum:build`로 다시 만들 수 있고, 라이선스 고지는 `THIRD_PARTY_NOTICES.md`에 있습니다.

## 1.0.0 - 2026-09-09

첫 번째 정식 안정 버전입니다.

### 주요 기능

- Google Docs, Sheets, Slides, Forms, Drive, Classroom을 위한 25개 MCP 도구
- 공용 데스크톱 OAuth 앱을 통한 사용자별 간편 로그인
- Codex, Claude Desktop, Cursor 전체 프로젝트용 자동 설치 명령
- Classroom 과제 게시와 Drive 공유의 일회성 사용자 승인
- 기존 Docs·Sheets·Slides·Forms와 Classroom 수업·과제·학생·제출 현황 읽기
- 셀 값과 수식 본문을 반환하지 않는 Sheets 구조·수식·오류 진단
- 평가계획·기록·제출·관찰·학생별현황·대시보드가 연결된 9개 탭 과정중심평가 템플릿
- Classroom 제출 현황을 개인정보 최소화 대시보드 시트로 생성

### 사용성

- 일반 Sheets에 고정 머리글, 32px 이상 행 높이, 내용 기반 열 너비와 교차 음영 적용
- 교육용 Sheets에 용도별 열 너비, 넉넉한 기록 칸, 큰 제목과 구분된 요약 영역 적용
- Docs에 제목·소제목·본문 위계와 인쇄용 여백 적용
- Slides에 수업용 색상, 안전한 본문 영역, 슬라이드 번호와 일관된 타이포그래피 적용
- 공식 홈페이지에 Docs·Sheets·Slides·Forms·Drive·Classroom 등 복사 가능한 예시 프롬프트 9종 추가

### 권한과 개인정보

- 기존 Workspace 자료 읽기는 `install ... --read`, `login --read`로 명시적으로 선택
- 기존 `EDU_WORKSPACE_SHEETS_READ`는 호환하고 새 통합 설정 `EDU_WORKSPACE_READ_ACCESS` 사용
- Classroom 제출 현황 시트는 학생 매칭에만 사용자 ID를 사용하고 결과 파일에는 저장하지 않도록 최소화
- 교사용 과제 생성에 필요한 공식 Classroom 범위 사용

### 보안 및 안정성

- OAuth Authorization Code 흐름에 PKCE(S256)와 `state` 검증 적용
- OAuth 로그인 5분 만료 및 토큰 원자적 저장·사용자 전용 권한 적용
- 최소 OAuth 범위와 이전의 과도한 범위를 확인하는 진단 기능
- Google API 할당량 오류에 제한적 지수 백오프 적용
- 비멱등 생성 요청의 모호한 서버 오류 자동 재시도 금지
- 문서·시트·슬라이드·퀴즈 입력 총량 제한 및 인터넷 전체 편집 공유 차단

## 0.1.0 - 2026-09-05

- 공개 베타 및 최초 npm 배포
