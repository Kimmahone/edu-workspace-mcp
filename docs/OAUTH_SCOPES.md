# Google OAuth 범위

공개 OAuth 검증 전에 각 범위의 필요성을 다시 검토하고 Google Cloud Console의 동의 화면과 이 문서를 일치시켜야 합니다.

| 범위 | 사용 목적 |
| --- | --- |
| `drive.file` | 이 앱이 생성하거나 사용자가 이 앱으로 연 파일의 검색·폴더 정리·공유 |
| `documents` | Google Docs 문서 생성과 본문 삽입 |
| `spreadsheets` | Google Sheets 생성과 셀 값·수식 입력 |
| `presentations` | Google Slides 생성과 텍스트 삽입 |
| `forms.body` | Google Forms 퀴즈 생성과 문항·정답·배점 설정 |
| `classroom.courses.readonly` | 교사가 접근할 수 있는 Classroom 수업 조회 |
| `classroom.coursework.me` | 사용자가 담당하는 수업의 과제 초안 생성과 게시 |

`drive.file`은 전체 Drive 읽기 권한이 아니다. 검색 도구는 이 앱이 접근할 수 있는 파일만 반환한다. 학생 명단, 제출물, 성적, 이메일, 보호자 정보 범위는 현재 요청하지 않는다.
