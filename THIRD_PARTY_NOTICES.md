# Third-Party Notices

## 초등 2022 개정 교육과정 성취기준 데이터

`data/curriculum/elementary-2022.json` 은 아래 두 원천으로 만든 정리본입니다.
`scripts/build-curriculum-data.mjs` 로 다시 만들 수 있습니다.

### 1. korean-elementary-learning-map-mcp (MIT)

- 저장소: https://github.com/taehyeonglim/korean-elementary-learning-map-mcp
- 사용한 버전: 0.5.1 (`devDependencies` 에 고정)
- 사용한 파일: `data/kr/curriculum-standards.json`(성취기준 코드·학년군·영역·요지), `data/kr/standard-texts.json`(성취기준 문장)
- 학습 지도 연동: `topics.json`, `dependencies.json`의 해시를 검사한 뒤 필요한 필드를 `data/curriculum/learning-map.json`으로 묶었습니다. 세부 주제·관찰 증거·평가 발문·선수관계는 DECK의 설계 자료이며 공식 수업 순서를 의미하지 않습니다. `scripts/build-learning-map.mjs`로 재생성합니다.
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

## kordoc (MIT)

- 저장소: https://github.com/chrisryugj/kordoc
- 사용한 버전: 4.15.4 (`dependencies`에 고정)
- 용도: HWP/HWPX·DOCX 파싱과 HWPX 생성. 원본 파일을 다시 배포하지 않으며 패키지는 npm에서 설치됩니다.
- 라이선스: MIT. 패키지의 `LICENSE` 및 저장소 고지를 따릅니다.

## Workspace Lab product artwork

Google Docs, Sheets, Slides, Forms, Drive and Classroom product icons in `web/assets/google` were supplied by the project owner. Google product names and artwork remain the property of Google. They identify connected services; Workspace Lab is an independent application. Source mappings are in `docs/ASSETS.md`.

## Cloudflare 개인용 브라우저 문서 엔진

Kordoc 4.15.4 (MIT)을 브라우저 Web Worker에 번들합니다. HWP/HWPX/DOCX 처리 코드는 동일하며 파일 시스템·운영체제·PDF/OCR 전용 경로는 브라우저에서 명시적으로 지원하지 않습니다. Buffer·압축·문서용 해시/암호 연산을 브라우저 호환 모듈로 연결합니다. 교육과정 JSON은 공개 정적 번들에 포함합니다.

`npm run cloud:build`는 실제 번들에 포함된 패키지의 라이선스 전문을 `/cloud/LICENSES.txt`로 생성합니다. Kordoc과 모든 브라우저 의존성의 고지는 배포 파일과 함께 제공됩니다.
