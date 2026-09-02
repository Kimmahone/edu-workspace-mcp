# 예제 모음

이 폴더는 `edu-workspace-mcp`를 연결한 AI 클라이언트에서 복사해 테스트할 수 있는 교육용 예제를 제공합니다.

## 추천 첫 데모

다음 문장을 AI 클라이언트에 입력합니다.

> 5학년 과학 ‘소화와 순환’ 수업 패키지를 만들어줘. Drive에 전용 폴더를 만들고, 교사용 수업안과 학생용 학습지는 Docs로, 6장 수업 자료는 Slides로, 5문항 형성평가는 Forms 퀴즈로 만들어줘. ‘5학년 3반 과학’ Classroom에는 과제 초안까지만 만들고 게시 전에 나에게 확인받아줘.

이 데모는 다음 기능을 한 흐름에서 보여 줍니다.

- Google 연결 상태 확인
- 담당 Classroom 수업 검색
- Drive 폴더 생성
- Docs, Slides, Forms 파일 생성
- Classroom 과제 초안 생성
- 일회성 승인 후 게시

## 실행 가능한 코드 예제

[`src/tests/education-demo.test.ts`](../src/tests/education-demo.test.ts)는 Google 계정 없이 동작하는 인메모리 통합 데모입니다.

```bash
npm test
```

테스트는 실제 MCP 클라이언트와 같은 방식으로 도구를 호출하고, 수업 패키지가 만들어진 뒤 과제가 `DRAFT`에서 승인된 `PUBLISHED` 상태로 바뀌는지 확인합니다.

더 많은 프롬프트와 도구 호출 순서는 [교육자를 위한 실제 활용 예시](../docs/EDUCATOR_USE_CASES.md)를 참고하세요.
