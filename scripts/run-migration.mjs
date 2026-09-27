import fs from "node:fs/promises";
import path from "node:path";
import { getAuthorizedClient } from "../dist/auth/google-auth.js";
import { google } from "googleapis";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function migrateCourse(classroom, sourceJsonPath, targetCourseId, courseName) {
  console.log(`\n========================================`);
  console.log(`🚀 [${courseName}] 마이그레이션 시작 -> 대상 ID: ${targetCourseId}`);
  console.log(`========================================`);

  const raw = JSON.parse(await fs.readFile(sourceJsonPath, "utf8"));
  // creationTime 오름차순 정렬: 과거 과제부터 생성하여 최신 과제가 상단에 오도록 함
  const items = [...raw.courseWork].sort(
    (a, b) => new Date(a.creationTime).getTime() - new Date(b.creationTime).getTime()
  );

  console.log(`총 ${items.length}개의 과제를 복원합니다.`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const indexStr = `[${i + 1}/${items.length}]`;
    console.log(`${indexStr} 생성 중: ${item.title}...`);

    const validMaterials = (item.materials || [])
      .filter((m) => m && m.url)
      .map((m) => ({
        link: {
          url: m.url,
          title: m.title || undefined
        }
      }));

    const workType = item.workType === "SHORT_ANSWER_QUESTION" ? "SHORT_ANSWER_QUESTION" : "ASSIGNMENT";

    const requestBody = {
      title: item.title,
      description: item.description || undefined,
      workType,
      state: "PUBLISHED",
      maxPoints: item.maxPoints !== undefined ? item.maxPoints : undefined,
      materials: validMaterials.length > 0 ? validMaterials : undefined
    };

    try {
      const res = await classroom.courses.courseWork.create({
        courseId: targetCourseId,
        requestBody
      });
      console.log(`  ✅ 성공 (ID: ${res.data.id})`);
      successCount++;
    } catch (err) {
      console.error(`  ❌ 실패: ${err.message}`);
      // Fallback: If materials caused issue, try without materials
      if (requestBody.materials) {
        try {
          console.log(`  🔄 첨부파일 제외 후 재시도 중...`);
          const res = await classroom.courses.courseWork.create({
            courseId: targetCourseId,
            requestBody: { ...requestBody, materials: undefined }
          });
          console.log(`  ✅ 재시도 성공 (ID: ${res.data.id})`);
          successCount++;
        } catch (retryErr) {
          console.error(`  ❌ 재시도 실패: ${retryErr.message}`);
          failCount++;
        }
      } else {
        failCount++;
      }
    }

    await delay(400);
  }

  console.log(`\n🎉 [${courseName}] 완료: 성공 ${successCount}건 / 실패 ${failCount}건`);
}

async function main() {
  const auth = await getAuthorizedClient();
  const classroom = google.classroom({ version: "v1", auth });

  const backupDir = "/Users/yses/Desktop/바이브코딩 앱/탑재용(이미지 용량 줄이기)/2026 수업(클래스룸)/마이그레이션_백업";

  // 1. 2024 구글 공인 교육자
  await migrateCourse(
    classroom,
    path.join(backupDir, "2024_구글_공인_교육자_과제목록.json"),
    "873044643134",
    "2024 구글 공인 교육자"
  );

  // 2. 2024 양서초
  await migrateCourse(
    classroom,
    path.join(backupDir, "2024_양서초(4-3)_과제목록.json"),
    "873044971095",
    "2024 양서초"
  );

  console.log("\n🎊 모든 수업 마이그레이션이 성공적으로 종료되었습니다!");
}

main().catch((err) => {
  console.error("치명적 오류 발생:", err);
  process.exit(1);
});
