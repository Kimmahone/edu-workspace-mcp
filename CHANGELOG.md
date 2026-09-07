# Changelog

이 프로젝트는 [Semantic Versioning](https://semver.org/)을 따릅니다.

## Unreleased

### 추가

- `sheets_list_sheets` — 스프레드시트의 탭 목록과 행·열 크기, 숨김 여부 확인
- `sheets_read_values` — 지정한 범위의 값 읽기. ID와 전체 URL을 모두 받고, 기본 200행까지 돌려주며 잘린 경우 `truncated`로 알림
- `docs_read_document` — Google Docs 본문·표·중첩 문서 탭 읽기
- `slides_read_presentation` — Slides 텍스트·표·발표자 노트 읽기
- `forms_read_form`, `forms_list_responses` — Forms 문항 구조와 응답·점수 읽기
- `drive_get_file_metadata` — 앱이 접근 가능한 Drive 파일 정보 읽기
- `classroom_list_coursework`, `classroom_list_students`, `classroom_list_student_submissions` — 과제·명단·제출 현황 읽기
- `install ... --read`, `login --read` — 기존 Workspace 자료 읽기 범위를 명시적으로 선택
- Claude Code 사용자 범위 전역 설치 지원 (`install claude`)

### 변경

- 교사용 과제 생성에 맞게 Classroom 범위를 `classroom.coursework.me`에서 공식 필수 범위인 `classroom.coursework.students`로 수정
- 기존 `EDU_WORKSPACE_SHEETS_READ`는 호환하고 새 통합 설정 `EDU_WORKSPACE_READ_ACCESS`를 사용

### 배경

기본 범위 `drive.file`은 이 앱이 만들었거나 사용자가 이 앱으로 연 파일만 다룰 수 있어,
교사가 이미 쓰고 있던 학급 기록 스프레드시트를 읽을 수 없었습니다.
서비스별 읽기 전용 범위를 선택 항목으로 두어, 필요한 사용자만 켜서 쓸 수 있게 했습니다. 제한 범위인 전체 Drive 읽기는 요청하지 않습니다.

## 1.0.0 - 2026-09-05

첫 번째 정식 안정 버전입니다.

### 주요 기능

- Google Docs, Sheets, Slides, Forms, Drive, Classroom을 위한 12개 MCP 도구
- 공용 데스크톱 OAuth 앱을 통한 사용자별 간편 로그인
- Codex, Claude Desktop, Cursor 전체 프로젝트용 자동 설치 명령
- Classroom 과제 게시와 Drive 공유의 일회성 사용자 승인

### 보안 및 안정성

- OAuth Authorization Code 흐름에 PKCE(S256)와 `state` 검증 적용
- OAuth 로그인 5분 만료 및 토큰 원자적 저장·사용자 전용 권한 적용
- 최소 OAuth 범위와 이전의 과도한 범위를 확인하는 진단 기능
- Google API 할당량 오류에 제한적 지수 백오프 적용
- 비멱등 생성 요청의 모호한 서버 오류 자동 재시도 금지
- 문서·시트·슬라이드·퀴즈 입력 총량 제한 및 인터넷 전체 편집 공유 차단

## 0.1.0 - 2026-09-05

- 공개 베타 및 최초 npm 배포
