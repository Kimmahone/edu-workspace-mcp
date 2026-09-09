# Changelog

이 프로젝트는 [Semantic Versioning](https://semver.org/)을 따릅니다.

## Unreleased

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
