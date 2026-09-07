import assert from "node:assert/strict";
import test from "node:test";
import { extractDocumentText } from "../google/docs.js";
import { summarizeFormItems } from "../google/forms.js";
import { extractGoogleFileId } from "../google/references.js";
import { extractPageElementText } from "../google/slides.js";
import { studentSubmissionsUnavailableReason } from "../google/classroom.js";

test("Google file references accept IDs and service URLs", () => {
  assert.equal(
    extractGoogleFileId("https://docs.google.com/document/d/1AbC_def-1234567890/edit", "document"),
    "1AbC_def-1234567890"
  );
  assert.equal(
    extractGoogleFileId("https://docs.google.com/presentation/d/1Slides_1234567890/edit", "presentation"),
    "1Slides_1234567890"
  );
  assert.equal(extractGoogleFileId("1RawFileId_12345", "file"), "1RawFileId_12345");
  assert.throws(() => extractGoogleFileId("https://docs.google.com/forms/d/e/public-id/viewform", "form"));
});

test("Docs reader preserves paragraph and table cell boundaries", () => {
  const text = extractDocumentText([
    { paragraph: { elements: [{ textRun: { content: "학습 목표\n" } }] } },
    { table: { tableRows: [{ tableCells: [
      { content: [{ paragraph: { elements: [{ textRun: { content: "이름\n" } }] } }] },
      { content: [{ paragraph: { elements: [{ textRun: { content: "점수\n" } }] } }] }
    ] }] } }
  ]);
  assert.equal(text, "학습 목표\n이름\t점수\n");
});

test("Slides reader extracts text from shapes, groups, and tables", () => {
  const grouped = extractPageElementText({
    elementGroup: {
      children: [
        { shape: { text: { textElements: [{ textRun: { content: "제목" } }] } } },
        { table: { tableRows: [{ tableCells: [{ text: { textElements: [{ textRun: { content: "내용" } }] } }] }] } }
      ]
    }
  });
  assert.equal(grouped, "제목\n내용");
});

test("Forms reader returns concise question metadata", () => {
  const items = summarizeFormItems([{
    itemId: "item-1",
    title: "정답을 고르세요",
    questionItem: {
      question: {
        questionId: "q-1",
        required: true,
        choiceQuestion: { type: "RADIO", options: [{ value: "가" }, { value: "나" }] },
        grading: { pointValue: 2, correctAnswers: { answers: [{ value: "가" }] } }
      }
    }
  }]);
  assert.equal(items[0].type, "RADIO");
  assert.deepEqual(items[0].questions[0].choices, ["가", "나"]);
  assert.deepEqual(items[0].questions[0].correctAnswers, ["가"]);
});

test("Classroom draft submissions return an actionable empty-state reason", () => {
  assert.match(studentSubmissionsUnavailableReason("DRAFT") ?? "", /게시한 뒤/);
  assert.equal(studentSubmissionsUnavailableReason("PUBLISHED"), undefined);
});
