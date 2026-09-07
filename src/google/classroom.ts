import { classroom_v1, google } from "googleapis";
import { getAuthorizedClient } from "../auth/google-auth.js";
import { withGoogleRetry } from "./retry.js";

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
  const response = await withGoogleRetry(() => classroom.courses.list({
    courseStates: ["ACTIVE"],
    teacherId: "me",
    pageSize: 100
  }));

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

function summarizeMaterial(material: classroom_v1.Schema$Material) {
  if (material.driveFile?.driveFile) {
    return {
      type: "DRIVE_FILE",
      id: material.driveFile.driveFile.id ?? "",
      title: material.driveFile.driveFile.title ?? "",
      url: material.driveFile.driveFile.alternateLink ?? "",
      shareMode: material.driveFile.shareMode ?? undefined
    };
  }
  if (material.link) return { type: "LINK", title: material.link.title ?? "", url: material.link.url ?? "" };
  if (material.form) return { type: "FORM", title: material.form.title ?? "", url: material.form.formUrl ?? "", responseUrl: material.form.responseUrl ?? undefined };
  if (material.youtubeVideo) return { type: "YOUTUBE", title: material.youtubeVideo.title ?? "", url: material.youtubeVideo.alternateLink ?? "", id: material.youtubeVideo.id ?? "" };
  return { type: "UNKNOWN" };
}

function summarizeAttachment(attachment: classroom_v1.Schema$Attachment) {
  if (attachment.driveFile) {
    return {
      type: "DRIVE_FILE",
      id: attachment.driveFile.id ?? "",
      title: attachment.driveFile.title ?? "",
      url: attachment.driveFile.alternateLink ?? ""
    };
  }
  if (attachment.link) return { type: "LINK", title: attachment.link.title ?? "", url: attachment.link.url ?? "" };
  if (attachment.form) return { type: "FORM", title: attachment.form.title ?? "", url: attachment.form.formUrl ?? "", responseUrl: attachment.form.responseUrl ?? undefined };
  if (attachment.youTubeVideo) return { type: "YOUTUBE", title: attachment.youTubeVideo.title ?? "", url: attachment.youTubeVideo.alternateLink ?? "", id: attachment.youTubeVideo.id ?? "" };
  return { type: "UNKNOWN" };
}

export async function listCourseWork(courseId: string, options: { states?: string[]; maxResults?: number } = {}) {
  const limit = Math.max(1, Math.min(options.maxResults ?? 100, 500));
  const auth = await getAuthorizedClient();
  const classroom = google.classroom({ version: "v1", auth });
  const items: classroom_v1.Schema$CourseWork[] = [];
  let pageToken: string | undefined;
  do {
    const response = await withGoogleRetry(() => classroom.courses.courseWork.list({
      courseId,
      courseWorkStates: options.states,
      orderBy: "updateTime desc",
      pageSize: Math.min(100, limit - items.length),
      pageToken
    }));
    items.push(...(response.data.courseWork ?? []));
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken && items.length < limit);

  return {
    courseId,
    returnedCourseWork: items.length,
    hasMore: Boolean(pageToken),
    courseWork: items.map((item) => ({
      id: item.id ?? "",
      title: item.title ?? "",
      description: item.description ?? undefined,
      state: item.state ?? undefined,
      workType: item.workType ?? undefined,
      alternateLink: item.alternateLink ?? undefined,
      creationTime: item.creationTime ?? undefined,
      updateTime: item.updateTime ?? undefined,
      dueDate: item.dueDate ?? undefined,
      dueTime: item.dueTime ?? undefined,
      scheduledTime: item.scheduledTime ?? undefined,
      maxPoints: item.maxPoints ?? undefined,
      topicId: item.topicId ?? undefined,
      associatedWithDeveloper: item.associatedWithDeveloper ?? undefined,
      materials: (item.materials ?? []).map(summarizeMaterial)
    }))
  };
}

export async function listStudents(courseId: string, maxResults = 200) {
  const limit = Math.max(1, Math.min(maxResults, 1_000));
  const auth = await getAuthorizedClient();
  const classroom = google.classroom({ version: "v1", auth });
  const students: classroom_v1.Schema$Student[] = [];
  let pageToken: string | undefined;
  do {
    const response = await withGoogleRetry(() => classroom.courses.students.list({
      courseId,
      pageSize: Math.min(100, limit - students.length),
      pageToken
    }));
    students.push(...(response.data.students ?? []));
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken && students.length < limit);

  return {
    courseId,
    returnedStudents: students.length,
    hasMore: Boolean(pageToken),
    students: students.map((student) => ({
      userId: student.userId ?? student.profile?.id ?? "",
      fullName: student.profile?.name?.fullName ?? "",
      givenName: student.profile?.name?.givenName ?? "",
      familyName: student.profile?.name?.familyName ?? "",
      emailAddress: student.profile?.emailAddress ?? undefined,
      photoUrl: student.profile?.photoUrl ?? undefined,
      courseWorkFolder: student.studentWorkFolder ?? undefined
    }))
  };
}

export async function listStudentSubmissions(
  courseId: string,
  courseWorkId: string,
  options: { states?: string[]; maxResults?: number } = {}
) {
  const limit = Math.max(1, Math.min(options.maxResults ?? 200, 1_000));
  const auth = await getAuthorizedClient();
  const classroom = google.classroom({ version: "v1", auth });
  const courseWorkResponse = await withGoogleRetry(() => classroom.courses.courseWork.get({
    courseId,
    id: courseWorkId
  }));
  const unavailableReason = studentSubmissionsUnavailableReason(courseWorkResponse.data.state);
  if (unavailableReason) {
    return {
      courseId,
      courseWorkId,
      returnedSubmissions: 0,
      hasMore: false,
      unavailableReason,
      submissions: []
    };
  }

  const submissions: classroom_v1.Schema$StudentSubmission[] = [];
  let pageToken: string | undefined;
  do {
    const response = await withGoogleRetry(() => classroom.courses.courseWork.studentSubmissions.list({
      courseId,
      courseWorkId,
      states: options.states,
      pageSize: Math.min(100, limit - submissions.length),
      pageToken
    }));
    submissions.push(...(response.data.studentSubmissions ?? []));
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken && submissions.length < limit);

  return {
    courseId,
    courseWorkId,
    returnedSubmissions: submissions.length,
    hasMore: Boolean(pageToken),
    submissions: submissions.map((submission) => ({
      id: submission.id ?? "",
      userId: submission.userId ?? "",
      state: submission.state ?? undefined,
      late: submission.late ?? undefined,
      assignedGrade: submission.assignedGrade ?? undefined,
      draftGrade: submission.draftGrade ?? undefined,
      creationTime: submission.creationTime ?? undefined,
      updateTime: submission.updateTime ?? undefined,
      alternateLink: submission.alternateLink ?? undefined,
      shortAnswer: submission.shortAnswerSubmission?.answer ?? undefined,
      multipleChoiceAnswer: submission.multipleChoiceSubmission?.answer ?? undefined,
      attachments: (submission.assignmentSubmission?.attachments ?? []).map(summarizeAttachment)
    }))
  };
}

export function studentSubmissionsUnavailableReason(state?: string | null) {
  return state === "DRAFT"
    ? "과제가 아직 DRAFT 상태라 학생 제출물이 생성되지 않았습니다. 과제를 게시한 뒤 다시 조회하세요."
    : undefined;
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
  const response = await withGoogleRetry(() => classroom.courses.courseWork.create({
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
  }), { idempotent: false });
  if (!response.data.id) throw new Error("Google Classroom 과제 ID를 받지 못했습니다.");
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
  const response = await withGoogleRetry(() => classroom.courses.courseWork.patch({
    courseId,
    id: courseWorkId,
    updateMask: "state",
    requestBody: { state: "PUBLISHED" }
  }));
  return {
    courseId,
    courseWorkId,
    state: response.data.state,
    title: response.data.title,
    alternateLink: response.data.alternateLink
  };
}
