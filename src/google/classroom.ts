import { google } from "googleapis";
import { getAuthorizedClient } from "../auth/google-auth.js";

export type CourseSummary = {
  id: string;
  name: string;
  section?: string;
  state?: string;
  alternateLink?: string;
};

export async function listCourses(query?: string): Promise<CourseSummary[]> {
  const auth = await getAuthorizedClient();
  const classroom = google.classroom({ version: "v1", auth });
  const response = await classroom.courses.list({
    courseStates: ["ACTIVE"],
    teacherId: "me",
    pageSize: 100
  });

  const normalized = (response.data.courses ?? []).map((course) => ({
    id: course.id ?? "",
    name: course.name ?? "이름 없는 수업",
    section: course.section ?? undefined,
    state: course.courseState ?? undefined,
    alternateLink: course.alternateLink ?? undefined
  }));
  const needle = query?.trim().toLocaleLowerCase("ko-KR");
  return needle
    ? normalized.filter((course) => `${course.name} ${course.section ?? ""}`.toLocaleLowerCase("ko-KR").includes(needle))
    : normalized;
}

export type AssignmentDraftInput = {
  courseId: string;
  title: string;
  description?: string;
  dueAt?: string;
  maxPoints?: number;
  materials?: Array<{ title: string; url: string }>;
};

function dueFields(dueAt?: string) {
  if (!dueAt) return {};
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) throw new Error("dueAt은 시간대가 포함된 ISO 8601 날짜여야 합니다.");
  return {
    dueDate: { year: due.getUTCFullYear(), month: due.getUTCMonth() + 1, day: due.getUTCDate() },
    dueTime: { hours: due.getUTCHours(), minutes: due.getUTCMinutes(), seconds: due.getUTCSeconds() }
  };
}

export async function createAssignmentDraft(input: AssignmentDraftInput) {
  const auth = await getAuthorizedClient();
  const classroom = google.classroom({ version: "v1", auth });
  const response = await classroom.courses.courseWork.create({
    courseId: input.courseId,
    requestBody: {
      title: input.title,
      description: input.description,
      state: "DRAFT",
      workType: "ASSIGNMENT",
      maxPoints: input.maxPoints,
      materials: input.materials?.map((material) => ({ link: material })),
      ...dueFields(input.dueAt)
    }
  });
  return {
    courseId: input.courseId,
    courseWorkId: response.data.id,
    title: response.data.title,
    state: response.data.state,
    alternateLink: response.data.alternateLink,
    dueDate: response.data.dueDate,
    dueTime: response.data.dueTime,
    materials: input.materials ?? []
  };
}

export async function publishAssignment(courseId: string, courseWorkId: string) {
  const auth = await getAuthorizedClient();
  const classroom = google.classroom({ version: "v1", auth });
  const response = await classroom.courses.courseWork.patch({
    courseId,
    id: courseWorkId,
    updateMask: "state",
    requestBody: { state: "PUBLISHED" }
  });
  return {
    courseId,
    courseWorkId,
    state: response.data.state,
    title: response.data.title,
    alternateLink: response.data.alternateLink
  };
}
