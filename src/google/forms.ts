import { forms_v1, google } from "googleapis";
import { getAuthorizedClient } from "../auth/google-auth.js";
import { moveFile } from "./drive.js";
import { extractGoogleFileId } from "./references.js";
import { withGoogleRetry } from "./retry.js";

export type QuizQuestion = {
  title: string;
  type: "MULTIPLE_CHOICE" | "SHORT_ANSWER" | "PARAGRAPH";
  choices?: string[];
  correctAnswer?: string;
  points?: number;
  required?: boolean;
};

export async function createQuiz(title: string, description: string | undefined, questions: QuizQuestion[], parentFolderId?: string) {
  const auth = await getAuthorizedClient();
  const api = google.forms({ version: "v1", auth });
  const created = await withGoogleRetry(() => api.forms.create({ requestBody: { info: { title } } }), { idempotent: false });
  const formId = created.data.formId;
  if (!formId) throw new Error("Google Forms 문서 ID를 받지 못했습니다.");

  const requests: Array<Record<string, unknown>> = [
    {
      updateSettings: {
        settings: { quizSettings: { isQuiz: true } },
        updateMask: "quizSettings.isQuiz"
      }
    }
  ];
  if (description) {
    requests.push({ updateFormInfo: { info: { description }, updateMask: "description" } });
  }
  questions.forEach((question, index) => {
    const questionBody: Record<string, unknown> = { required: question.required ?? true };
    if (question.type === "MULTIPLE_CHOICE") {
      questionBody.choiceQuestion = {
        type: "RADIO",
        options: (question.choices ?? []).map((value) => ({ value })),
        shuffle: false
      };
    } else {
      questionBody.textQuestion = { paragraph: question.type === "PARAGRAPH" };
    }
    if (question.correctAnswer) {
      questionBody.grading = {
        pointValue: question.points ?? 1,
        correctAnswers: { answers: [{ value: question.correctAnswer }] }
      };
    }
    requests.push({
      createItem: {
        item: { title: question.title, questionItem: { question: questionBody } },
        location: { index }
      }
    });
  });
  await withGoogleRetry(() => api.forms.batchUpdate({ formId, requestBody: { requests } }), { idempotent: false });
  await moveFile(formId, parentFolderId);
  const form = await withGoogleRetry(() => api.forms.get({ formId }));
  return {
    formId,
    title,
    responderUrl: form.data.responderUri,
    editUrl: `https://docs.google.com/forms/d/${formId}/edit`
  };
}

function questionType(question: forms_v1.Schema$Question): string {
  if (question.choiceQuestion) return question.choiceQuestion.type ?? "CHOICE";
  if (question.textQuestion) return question.textQuestion.paragraph ? "PARAGRAPH" : "SHORT_ANSWER";
  if (question.scaleQuestion) return "SCALE";
  if (question.dateQuestion) return "DATE";
  if (question.timeQuestion) return question.timeQuestion.duration ? "DURATION" : "TIME";
  if (question.fileUploadQuestion) return "FILE_UPLOAD";
  if (question.ratingQuestion) return "RATING";
  if (question.rowQuestion) return "GRID_ROW";
  return "UNKNOWN";
}

function summarizeQuestion(question: forms_v1.Schema$Question) {
  return {
    questionId: question.questionId ?? "",
    type: questionType(question),
    required: Boolean(question.required),
    choices: question.choiceQuestion?.options?.map((option) => option.value ?? "") ?? undefined,
    pointValue: question.grading?.pointValue ?? undefined,
    correctAnswers: question.grading?.correctAnswers?.answers?.map((answer) => answer.value ?? "") ?? undefined
  };
}

export function summarizeFormItems(items: forms_v1.Schema$Item[] = []) {
  return items.map((item, index) => {
    const questions = item.questionItem?.question
      ? [summarizeQuestion(item.questionItem.question)]
      : (item.questionGroupItem?.questions ?? []).map(summarizeQuestion);
    let type = questions[0]?.type ?? "CONTENT";
    if (item.pageBreakItem) type = "PAGE_BREAK";
    else if (item.textItem) type = "TEXT";
    else if (item.imageItem) type = "IMAGE";
    else if (item.videoItem) type = "VIDEO";
    else if (item.questionGroupItem) type = "QUESTION_GROUP";
    return {
      index: index + 1,
      itemId: item.itemId ?? "",
      title: item.title ?? "",
      description: item.description ?? undefined,
      type,
      questions
    };
  });
}

export async function readForm(formIdOrUrl: string, maxItems = 200) {
  const formId = extractGoogleFileId(formIdOrUrl, "form");
  const limit = Math.max(1, Math.min(maxItems, 500));
  const auth = await getAuthorizedClient();
  const api = google.forms({ version: "v1", auth });
  const response = await withGoogleRetry(() => api.forms.get({ formId }));
  const allItems = summarizeFormItems(response.data.items);
  return {
    formId,
    title: response.data.info?.title ?? "",
    documentTitle: response.data.info?.documentTitle ?? "",
    description: response.data.info?.description ?? "",
    isQuiz: Boolean(response.data.settings?.quizSettings?.isQuiz),
    responderUrl: response.data.responderUri ?? "",
    editUrl: `https://docs.google.com/forms/d/${formId}/edit`,
    linkedSheetId: response.data.linkedSheetId ?? undefined,
    totalItems: allItems.length,
    returnedItems: Math.min(allItems.length, limit),
    truncated: allItems.length > limit,
    items: allItems.slice(0, limit)
  };
}

function summarizeResponse(response: forms_v1.Schema$FormResponse) {
  return {
    responseId: response.responseId ?? "",
    respondentEmail: response.respondentEmail ?? undefined,
    createTime: response.createTime ?? undefined,
    lastSubmittedTime: response.lastSubmittedTime ?? undefined,
    totalScore: response.totalScore ?? undefined,
    answers: Object.fromEntries(Object.entries(response.answers ?? {}).map(([questionId, answer]) => [
      questionId,
      {
        text: answer.textAnswers?.answers?.map((value) => value.value ?? "") ?? undefined,
        files: answer.fileUploadAnswers?.answers?.map((file) => ({
          fileId: file.fileId ?? "",
          fileName: file.fileName ?? "",
          mimeType: file.mimeType ?? ""
        })) ?? undefined,
        score: answer.grade?.score ?? undefined,
        correct: answer.grade?.correct ?? undefined,
        feedback: answer.grade?.feedback?.text ?? undefined
      }
    ]))
  };
}

export async function listFormResponses(formIdOrUrl: string, maxResponses = 100) {
  const formId = extractGoogleFileId(formIdOrUrl, "form");
  const limit = Math.max(1, Math.min(maxResponses, 500));
  const auth = await getAuthorizedClient();
  const api = google.forms({ version: "v1", auth });
  const responses: forms_v1.Schema$FormResponse[] = [];
  let pageToken: string | undefined;
  do {
    const response = await withGoogleRetry(() => api.forms.responses.list({
      formId,
      pageSize: Math.min(100, limit - responses.length),
      pageToken
    }));
    responses.push(...(response.data.responses ?? []));
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken && responses.length < limit);

  return {
    formId,
    returnedResponses: responses.length,
    hasMore: Boolean(pageToken),
    responses: responses.map(summarizeResponse)
  };
}
