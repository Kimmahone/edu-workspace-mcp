# Workspace Lab 디자인 에셋

## Google 제품 아이콘

사용자가 제공한 `구글/공식 아이콘/PRODUCT/SVG`의 원본 SVG를 그대로 복사했습니다. 제품 연결을 설명하는 용도입니다. Google 제품 아이콘과 상표의 권리는 Google에 있으며 앱 자체 로고나 운영 주체 표시로 사용하지 않습니다.

| 배포 파일 | 제공 폴더의 원본 |
| --- | --- |
| `web/assets/google/docs.svg` | Docs/logo_docs_192px_2020q4.svg |
| `web/assets/google/sheets.svg` | Sheets/Sheets_Product_Icon.svg |
| `web/assets/google/slides.svg` | Slides/Slides_Product_Icon.svg |
| `web/assets/google/forms.svg` | Forms/Forms_Product_Icon.svg |
| `web/assets/google/drive.svg` | Drive/Drive_Product_Icon.svg |
| `web/assets/google/classroom.svg` | Classroom/Classroom_Product_Icon.svg |
| `web/assets/google/gemini.png` | 구글/이미지/gemini.png (참고용 복사본) |

개인 인증서·배지·스크린샷·영상 등 나머지 참고 자료는 앱에 포함하지 않습니다. `구글/` 폴더는 배포 업로드에서 제외합니다.

## 앱 전용 에셋

- `web/assets/illustrations/lab-mark.svg`: Workspace Lab용 별도 기하학 로고와 파비콘.
- `web/assets/illustrations/conversion.svg`: 한글 문서와 Docs 변환을 설명하는 벡터 그림.
- `web/studio.js`와 `web/style.css`: 반응형 문서·시트·슬라이드·퀴즈 미니어처와 협업 일러스트. CSS로 화면 전환, 떠오르는 카드, 커서, 그래프 애니메이션 구현.
- `prefers-reduced-motion: reduce` 환경에서는 애니메이션과 이동 효과를 비활성화합니다.
- Google과의 공식 제휴를 의미하지 않으며 앱 하단에 독립 서비스임을 표시합니다.

## 실제 예시 파일

`web/assets/examples`에는 12종 × HWPX/Markdown/JSON/PDF/PNG, 총 60개 파일이 있습니다. 카드 PNG와 PDF는 앱 디자인 렌더러에서 생성합니다. Google 화면 캡처가 아니며, Google 변환이나 한글 글꼴 환경에 따라 줄바꿈과 쪽 배치는 달라질 수 있습니다. 시트·발표·퀴즈의 HWPX는 내용을 문서로 정리한 참고 파일입니다. 실제 Google Sheets/Slides/Forms는 예시를 편집 화면으로 불러온 후 ‘Google에 저장’에서 만듭니다.

`web/assets/illustrations/forms-header-{navy,blue,warm}.png`는 설문지 테마 설정에 사용할 1600×400 머리글 이미지입니다. `scripts/render-form-headers.mjs`로 생성한 앱 전용 그래픽입니다.

내용 변경 후 `npm run web:examples`, 설정 안내 변경 후 `npm run web:guide`로 재생성합니다.
