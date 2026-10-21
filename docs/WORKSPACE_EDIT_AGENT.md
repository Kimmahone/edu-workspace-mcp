# Google Docs·Sheets 생성·편집 Agent

2026-10-21 기준 1.2.0 설치 후보입니다. 코드·격리 Worker 검사는 완료했으며 실제 Google 쓰기 동의·실제 생성/수정 검증과 정식 npm 게시 전입니다. 공개 설치가 가능한 버전으로 표시하지 않습니다. 기존 공개 읽기 버전1.1.2는 유지합니다.

## 가능한 작업

- `docs_create_document`: 새 Google 문서 생성
- `docs_batch_update`: 지정한 문서의 본문·표·서식 수정
- `sheets_create_spreadsheet`: 새 스프레드시트 생성
- `sheets_write_values`: 지정한 범위의 값·수식 수정
- `sheets_batch_update`: 셀·표 서식 변경과 탭 추가

기존 읽기·성취기준 도구10개도 제공합니다. 파일 삭제·공유·Drive 전체 검색·Classroom 도구는 추가하지 않습니다. 쓰기 입력 전체는8KiB, batch는20개, 셀 값은 한 번에1000셀 이내입니다. 큰 작업은 요청 단위로 나눕니다.

## 권한과 연결

기본 연결은 계속 읽기 전용입니다. 편집을 선택하면 `documents`와 `spreadsheets` 권한을 요청하며 기존 Forms 본문·응답과 Slides는 읽기 전용입니다. Google 권한 화면의 문서·시트 관리 범위는 모든 해당 서비스 자료에 적용되지만 MCP는 사용자가 요청한 자료를 만들거나 지정한 ID의 자료만 수정합니다. Google의 실제 파일 소유권·편집 권한도 필요합니다.

편집 권한은 Google에서 사용자가 직접 동의해야 합니다. 기존 읽기 로그인으로 쓰기가 자동 허용되지 않습니다. 읽기 자격증명은 `~/.edu-workspace-mcp-agent/remote/`, 편집 자격증명은 `~/.edu-workspace-mcp-agent/remote-edit/`에 별도로 보관합니다. 인증 파일을 AI에 보내거나 저장소에 넣지 마세요.

정식 게시 뒤에만 해당 버전의 `setup <app> --workspace-edit`, `login --workspace-edit`, `doctor --workspace-edit`를 사용합니다. 1.1.2에 이 옵션을 전달하지 않습니다. 후보 시험은 운영자가 준비한 로컬 후보로 진행합니다.

## 요청과 수정 확인

작업마다16~100자의 고유 requestId가 필요합니다. 같은 ID는 다시 실행하지 않습니다. 생성 중 시간 초과가 났다고 새 ID로 즉시 다시 만들지 말고 먼저 Google에서 결과를 확인합니다. Docs 수정은 먼저 읽은 revisionId를 requiredRevisionId로 전달하여 다른 편집을 덮어쓰지 않습니다. Sheets 값은 기본 RAW로 기록하며 사용자가 수식을 요청한 경우만 USER_ENTERED를 사용합니다. Sheets API는 Docs와 같은 revision 조건부 쓰기를 제공하지 않으므로 정확한 범위를 먼저 확인합니다.

## 계속 무료로 사용하는 조건

현재 Docs·Sheets API 표준 사용은 추가 비용 없이 제공됩니다. 기존 Workers Free·공식 요금8개 자동 확인을 유지하며 요금 변경·48시간 확인 실패 시 멈춥니다. 읽기와 쓰기를 합쳐 전체40회/분·600회/일, 연결별100회/일이며 쓰기는 추가로 연결별20회/일로 제한합니다. 한국 시간 오전9시에 일일 한도가 초기화됩니다. 유료 전환·할당량 유료 확대·별도 모델 API 호출은 하지 않습니다. Google 저장공간과 연결한 AI 앱의 이용 조건은 각 계정에 적용됩니다. 영구 무료를 보장하지 않습니다.
