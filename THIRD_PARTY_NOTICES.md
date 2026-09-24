# Third-Party Notices

## 초등 2022 개정 교육과정 성취기준 데이터

`data/curriculum/elementary-2022.json` 은 아래 두 원천으로 만든 정리본입니다.
`scripts/build-curriculum-data.mjs` 로 다시 만들 수 있습니다.

### 1. korean-elementary-learning-map-mcp (MIT)

- 저장소: https://github.com/taehyeonglim/korean-elementary-learning-map-mcp
- 사용한 버전: 0.5.1 (`devDependencies` 에 고정)
- 사용한 파일: `data/kr/curriculum-standards.json`(성취기준 코드·학년군·영역·요지), `data/kr/standard-texts.json`(성취기준 문장)
- 바꾼 점: 문장 뒤에 붙은 다음 단원 제목·쪽 번호·탐구 활동 목록을 잘라 냈고, PDF 줄바꿈으로 생긴 띄어쓰기 오류 중 확인한 것만 고쳤으며,
  표 내용이 섞였거나 해설 문단이 들어간 문장은 싣지 않았습니다(`text: null`). 항목별 정리 내역은 `textNotes` 에 있습니다.

원천 패키지의 라이선스 전문:

```text
MIT License

Copyright (c) 2026 DECK (github.com/DECK6)

This repository — including its build scripts, validators, dataset,
ontology artifacts, and documentation — is an original work by the
copyright holder, compiled from publicly available information about
the national elementary curriculum of the Republic of Korea. It was
inspired by, but does not copy content or data from, the Marble Skill
Taxonomy. No rights to the official curriculum source documents
themselves are granted or implied — see NOTICE.md.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### 2. 성취기준 문장의 출처

성취기준 문장은 교육부 고시 제2022-33호(2026 일부 개정 포함) 교육과정 문서로, 국가교육과정정보센터(NCIC,
https://ncic.re.kr)가 공개한 PDF에서 추출한 것입니다. 교육부가 공표한 공공저작물로서 저작권법 제24조의2(공공저작물의
자유이용)에 따라 출처를 표기해 이용합니다. 이 데이터는 교육부·국가교육위원회·NCIC의 공식 산출물이 아니며,
공식 문서로 쓰기 전에는 NCIC 원문과 대조해야 합니다.
