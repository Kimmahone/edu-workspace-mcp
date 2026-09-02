import { google } from "googleapis";
import { getAuthorizedClient } from "../auth/google-auth.js";
import { moveFile } from "./drive.js";

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
  const created = await api.forms.create({ requestBody: { info: { title } } });
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
  await api.forms.batchUpdate({ formId, requestBody: { requests } });
  await moveFile(formId, parentFolderId);
  const form = await api.forms.get({ formId });
  return {
    formId,
    title,
    responderUrl: form.data.responderUri,
    editUrl: `https://docs.google.com/forms/d/${formId}/edit`
  };
}
