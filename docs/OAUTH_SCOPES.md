# Google OAuth 범위

Google Cloud Console의 동의 화면과 이 문서의 범위는 항상 일치해야 합니다. 앱은 기능을 수행할 수 있는 가장 좁은 범위만 요청합니다.

| 범위 | 사용 목적 |
| --- | --- |
| `drive.file` | 이 앱이 생성하거나 사용자가 이 앱으로 연 Drive 파일 및 폴더에 한해 Docs·Sheets·Slides·Forms 생성, 편집, 검색, 정리, 공유 |
| `classroom.courses.readonly` | 교사가 접근할 수 있는 Classroom 수업 조회 |
| `classroom.coursework.me` | 사용자가 담당하는 수업의 과제 초안 생성과 게시 |

`drive.file`은 전체 Drive 읽기 권한이 아니다. Google Docs, Sheets, Slides, Forms API는 모두 이 범위로 앱이 사용하는 파일을 생성하고 수정할 수 있다. 검색 도구도 이 앱이 접근할 수 있는 파일만 반환한다. 앱은 `documents`, `spreadsheets`, `presentations`, `forms.body` 같은 제품 전체 범위를 요청하지 않는다. 학생 명단, 제출물, 성적, 이메일, 보호자 정보 범위도 요청하지 않는다.
