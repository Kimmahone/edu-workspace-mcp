export type LessonPackagePromptInput = {
  grade: string;
  subject: string;
  topic: string;
  classroom?: string;
};

// 교육과정 조회와 Workspace 생성을 한 흐름으로 잇는 안내문. 성취기준은 교사가 고른 뒤에만 쓰고,
// 원문은 모델이 옮겨 적지 않고 standardCodes로 넘겨 서버가 붙이게 한다(옮겨 적다 틀리는 일을 막는다).
export function lessonPackagePrompt({ grade, subject, topic, classroom }: LessonPackagePromptInput): string {
  const classroomStep = classroom?.trim()
    ? `「${classroom.trim()}」 Classroom에`
    : "어느 Classroom 수업인지 물어본 뒤 그 수업에";
  return [
    `${grade}학년 ${subject} 「${topic}」 수업 패키지를 만들어 주세요. 아래 순서를 지켜 주세요.`,
    "",
    `1. curriculum_search_standards(subject: "${subject}", grade: ${grade}, query: 주제의 핵심 낱말)로 관련 성취기준 후보를 찾아 코드와 원문을 보여 주고, 제가 고를 때까지 기다려 주세요. "원문 확인 필요"로 표시된 항목이 있으면 알려 주세요.`,
    "2. 고른 성취기준에 맞춰 학습 목표를 학생 눈높이의 한 문장으로 정리해 보여 주세요.",
    `3. drive_create_folder로 「${grade}학년 ${subject} ${topic}」 폴더를 만드세요.`,
    "4. docs_create_lesson_plan으로 교수·학습 과정안을 만드세요. standardCodes에 고른 코드를 넣고, 성취기준 원문은 직접 쓰지 마세요. 서버가 정리된 원문과 출처를 붙입니다. 단계마다 학습 과정·활동·시간·자료(▣)·유의점(※)을 채우세요.",
    "5. docs_create_worksheet로 학생용 학습지를 만드세요. 학생 눈높이의 학습 목표 한 문장을 넣고, 물음마다 답 칸(write)·빈 표(table)·자기 점검표(checklist)를 알맞게 골라 답을 쓸 공간을 넉넉히 두세요. 학습지에는 성취기준 원문을 넣지 마세요.",
    "6. slides_create_presentation으로 한 장에 핵심 하나씩 수업 슬라이드를 만드세요.",
    "7. forms_create_quiz로 고른 성취기준마다 1~2문항씩 형성평가를 만들고 standardCodes를 넣으세요.",
    `8. ${classroomStep} classroom_create_assignment_draft로 학생용 자료만 첨부한 과제 초안을 만드세요. 게시는 제가 대상·마감·첨부를 확인한 뒤에만 하세요.`,
    "",
    "모든 자료에서 학습 목표와 용어를 같게 쓰고, 마지막에 만든 파일 주소를 모아 보여 주세요."
  ].join("\n");
}
