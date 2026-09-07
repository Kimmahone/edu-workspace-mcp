# Google OAuth 범위

Google Cloud Console의 동의 화면과 이 문서의 범위는 항상 일치해야 합니다. 앱은 기능을 수행할 수 있는 가장 좁은 범위만 요청하며, 전체 Drive 범위는 요청하지 않습니다.

## 기본 범위

| 범위 | 사용 목적 |
| --- | --- |
| `drive.file` | 이 앱이 생성하거나 사용자가 앱에 명시적으로 허용한 파일의 생성·조회·정리·공유 |
| `classroom.courses.readonly` | 교사가 접근할 수 있는 Classroom 수업 조회 |
| `classroom.coursework.students` | 교사가 수업 과제를 읽고 초안을 생성한 뒤 확인 후 게시하며, 과제별 학생 제출 상태를 조회 |

`classroom.coursework.students`는 Google Classroom의 `courseWork.create`에 공식적으로 필요한 범위입니다. 이전 실험 버전의 `classroom.coursework.me`는 학생 본인용 범위라 교사용 과제 생성 기능에 적합하지 않아 교체했습니다.

## 읽기 확장 범위 (선택)

`install ... --read`와 `login --read`를 사용했을 때만 다음 범위를 요청합니다.

| 범위 | 사용 목적 |
| --- | --- |
| `documents.readonly` | 기존 Google Docs의 본문·표·문서 탭 읽기 |
| `spreadsheets.readonly` | 기존 Google Sheets의 탭과 셀 값 읽기 |
| `presentations.readonly` | 기존 Google Slides의 텍스트·표·발표자 노트 읽기 |
| `forms.body.readonly` | 기존 Google Forms의 설명·문항·선택지·정답 읽기 |
| `forms.responses.readonly` | Google Forms 응답과 퀴즈 점수 읽기 |
| `classroom.rosters.readonly` | 교사가 담당하는 수업의 학생 명단 읽기 |

환경 설정을 직접 관리할 때는 MCP 서버에 `EDU_WORKSPACE_READ_ACCESS=1`을 전달할 수 있습니다. 이전 개발판의 `EDU_WORKSPACE_SHEETS_READ=1`도 호환되지만 새 설정을 권장합니다. 범위를 바꾼 뒤에는 `login --read`로 다시 로그인해야 합니다.

## 의도적으로 요청하지 않는 범위

- `drive`, `drive.readonly`, `drive.metadata.readonly`: 전체 Drive 접근이 가능한 제한(restricted) 범위라 요청하지 않습니다.
- Gmail, Calendar, 보호자 정보 관련 범위: 현재 도구에 필요하지 않습니다.

따라서 `drive_search_files`와 `drive_get_file_metadata`는 앱이 만들었거나 앱에 접근 권한이 부여된 파일만 다룹니다. 반면 서비스별 읽기 확장 범위는 사용자가 URL 또는 ID로 지정한 기존 Docs·Sheets·Slides·Forms를 읽을 수 있습니다.

읽기 결과에는 문서 내용, Forms 응답, 학생 이름·이메일·제출 상태·점수 같은 개인정보가 포함될 수 있습니다. 앱 운영자는 이를 중앙 서버에 저장하지 않지만, 사용자가 연결한 AI 클라이언트가 결과를 처리하므로 학교 정책과 해당 AI 서비스의 데이터 설정을 확인해야 합니다.
