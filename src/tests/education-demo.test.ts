import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { resetApprovalsForTests } from "../approvals/service.js";
import { createServer, type WorkspaceServices } from "../server.js";

type Call = { tool: string; input: unknown };

function demoServices(calls: Call[]): WorkspaceServices {
  return {
    getAuthStatus: async () => ({
      authenticated: true,
      oauthClientConfigured: true,
      oauthClientSource: "bundled",
      credentialsPath: "/demo/credentials.json",
      tokenPath: "/demo/token.json",
      grantedScopes: [],
      message: "demo account connected"
    }),
    listCourses: async (query) => {
      calls.push({ tool: "classroom_list_courses", input: { query } });
      return [{ id: "science-5-3", name: "5학년 3반 과학", state: "ACTIVE" }];
    },
    searchFiles: async () => [],
    createFolder: async (name, parentId) => {
      calls.push({ tool: "drive_create_folder", input: { name, parentId } });
      return { id: "lesson-folder", name, url: "https://drive.example/lesson-folder" };
    },
    createDocument: async (title, blocks, parentFolderId) => {
      calls.push({ tool: "docs_create_document", input: { title, blocks, parentFolderId } });
      const slug = title.includes("교사용") ? "teacher-guide" : "student-worksheet";
      return { documentId: slug, title, url: `https://docs.example/${slug}` };
    },
    createWorkbook: async (title, sheets, parentFolderId) => {
      calls.push({ tool: "sheets_create_workbook", input: { title, sheets, parentFolderId } });
      return { spreadsheetId: "assessment-sheet", title, url: "https://sheets.example/assessment-sheet" };
    },
    createPresentation: async (title, slides, parentFolderId) => {
      calls.push({ tool: "slides_create_presentation", input: { title, slides, parentFolderId } });
      return { presentationId: "lesson-slides", title, url: "https://slides.example/lesson-slides" };
    },
    createQuiz: async (title, description, questions, parentFolderId) => {
      calls.push({ tool: "forms_create_quiz", input: { title, description, questions, parentFolderId } });
      return {
        formId: "formative-quiz",
        title,
        responderUrl: "https://forms.example/formative-quiz/respond",
        editUrl: "https://forms.example/formative-quiz/edit"
      };
    },
    createAssignmentDraft: async (input) => {
      calls.push({ tool: "classroom_create_assignment_draft", input });
      return {
        courseId: input.courseId,
        courseWorkId: "digestion-assignment",
        title: input.title,
        state: "DRAFT",
        alternateLink: "https://classroom.example/digestion-assignment",
        dueDate: { year: 2026, month: 9, day: 11 },
        dueTime: { hours: 9, minutes: 0 },
        materials: input.materials ?? []
      };
    },
    publishAssignment: async (courseId, courseWorkId) => {
      calls.push({ tool: "classroom_publish_assignment", input: { courseId, courseWorkId } });
      return {
        courseId,
        courseWorkId,
        title: "소화와 순환 형성평가",
        state: "PUBLISHED",
        alternateLink: "https://classroom.example/digestion-assignment"
      };
    },
    shareFile: async () => ({ id: "permission-demo", type: "user", role: "reader" })
  };
}

test("education demo creates a lesson package and safely publishes its Classroom draft", async () => {
  resetApprovalsForTests();
  const calls: Call[] = [];
  const server = createServer(demoServices(calls));
  const client = new Client({ name: "education-demo", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const courses = await client.callTool({
    name: "classroom_list_courses",
    arguments: { query: "5학년 3반 과학" }
  });
  const courseId = (courses.structuredContent as { courses: Array<{ id: string }> }).courses[0].id;

  const folder = await client.callTool({
    name: "drive_create_folder",
    arguments: { name: "5학년 과학 - 소화와 순환" }
  });
  const folderId = (folder.structuredContent as { folder: { id: string } }).folder.id;

  const teacherGuide = await client.callTool({
    name: "docs_create_document",
    arguments: {
      title: "소화와 순환 교사용 수업안",
      parentFolderId: folderId,
      blocks: [
        { heading: "학습 목표", text: "소화 기관과 순환 기관의 기능을 설명할 수 있다." },
        { heading: "수업 흐름", text: "도입 질문 → 기관 카드 분류 → 모둠 설명 → 형성평가" },
        { heading: "관찰 포인트", text: "기관의 이름보다 기능과 기관 사이의 관계를 설명하는지 확인한다." }
      ]
    }
  });

  const worksheet = await client.callTool({
    name: "docs_create_document",
    arguments: {
      title: "소화와 순환 학생용 학습지",
      parentFolderId: folderId,
      blocks: [
        { heading: "생각 열기", text: "음식이 몸속에서 이동하는 경로를 예상해 보세요." },
        { heading: "모둠 활동", text: "기관 카드를 순서대로 놓고 각 기관의 기능을 한 문장으로 설명하세요." },
        { heading: "정리", text: "소화와 순환이 우리 몸에서 함께 작용하는 까닭을 써 보세요." }
      ]
    }
  });

  const slides = await client.callTool({
    name: "slides_create_presentation",
    arguments: {
      title: "소화와 순환 수업 자료",
      parentFolderId: folderId,
      slides: [
        { title: "오늘의 질문", body: "먹은 음식은 우리 몸에서 어떻게 이동할까요?" },
        { title: "학습 목표", body: "소화 기관과 순환 기관의 기능을 설명해 봅시다." },
        { title: "소화 기관", body: "입 → 식도 → 위 → 작은창자 → 큰창자" },
        { title: "순환 기관", body: "심장과 혈관이 영양소와 산소를 운반합니다." },
        { title: "모둠 활동", body: "기관 카드 분류와 기능 설명" },
        { title: "정리 질문", body: "소화된 영양소는 어떻게 온몸으로 이동할까요?" }
      ]
    }
  });

  const quiz = await client.callTool({
    name: "forms_create_quiz",
    arguments: {
      title: "소화와 순환 형성평가",
      description: "수업 후 핵심 개념을 확인하는 5문항 퀴즈입니다.",
      parentFolderId: folderId,
      questions: [
        { title: "음식물이 가장 먼저 잘게 부서지는 곳은 어디인가요?", type: "MULTIPLE_CHOICE", choices: ["입", "위", "작은창자", "큰창자"], correctAnswer: "입", points: 2 },
        { title: "소화된 영양소가 주로 흡수되는 곳은 어디인가요?", type: "MULTIPLE_CHOICE", choices: ["식도", "위", "작은창자", "큰창자"], correctAnswer: "작은창자", points: 2 },
        { title: "혈액을 온몸으로 보내는 기관은 무엇인가요?", type: "MULTIPLE_CHOICE", choices: ["폐", "심장", "간", "콩팥"], correctAnswer: "심장", points: 2 },
        { title: "혈액이 이동하는 통로는 무엇인가요?", type: "MULTIPLE_CHOICE", choices: ["혈관", "식도", "기관", "신경"], correctAnswer: "혈관", points: 2 },
        { title: "소화된 영양소가 온몸으로 이동하는 과정을 한 문장으로 쓰세요.", type: "SHORT_ANSWER", correctAnswer: "혈액을 통해 온몸으로 이동한다", points: 2 }
      ]
    }
  });

  const guideUrl = (teacherGuide.structuredContent as { document: { url: string } }).document.url;
  const worksheetUrl = (worksheet.structuredContent as { document: { url: string } }).document.url;
  const slidesUrl = (slides.structuredContent as { presentation: { url: string } }).presentation.url;
  const quizUrl = (quiz.structuredContent as { form: { responderUrl: string } }).form.responderUrl;

  const draft = await client.callTool({
    name: "classroom_create_assignment_draft",
    arguments: {
      courseId,
      title: "소화와 순환 형성평가",
      description: "학습지를 완성한 뒤 수업 자료를 복습하고 형성평가에 참여하세요.",
      dueAt: "2026-09-11T18:00:00+09:00",
      maxPoints: 10,
      materials: [
        { title: "교사용 수업안", url: guideUrl },
        { title: "학생용 학습지", url: worksheetUrl },
        { title: "수업 자료", url: slidesUrl },
        { title: "형성평가", url: quizUrl }
      ]
    }
  });
  const draftContent = draft.structuredContent as {
    assignment: { courseWorkId: string; state: string };
    approval: { id: string };
  };
  assert.equal(draftContent.assignment.state, "DRAFT");

  const published = await client.callTool({
    name: "classroom_publish_assignment",
    arguments: {
      courseId,
      courseWorkId: draftContent.assignment.courseWorkId,
      approvalId: draftContent.approval.id,
      confirmation: "PUBLISH"
    }
  });
  assert.equal(
    (published.structuredContent as { assignment: { state: string } }).assignment.state,
    "PUBLISHED"
  );

  assert.deepEqual(calls.map((call) => call.tool), [
    "classroom_list_courses",
    "drive_create_folder",
    "docs_create_document",
    "docs_create_document",
    "slides_create_presentation",
    "forms_create_quiz",
    "classroom_create_assignment_draft",
    "classroom_publish_assignment"
  ]);

  await client.close();
  await server.close();
});
