import { google } from "googleapis";
import { getAuthorizedClient } from "../auth/google-auth.js";
import { extractGoogleFileId } from "./references.js";
import { withGoogleRetry } from "./retry.js";

function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export async function searchFiles(query?: string, mimeType?: string, parentId?: string) {
  const auth = await getAuthorizedClient();
  const drive = google.drive({ version: "v3", auth });
  const filters = ["trashed = false"];
  if (query) filters.push(`name contains '${escapeDriveQuery(query)}'`);
  if (mimeType) filters.push(`mimeType = '${escapeDriveQuery(mimeType)}'`);
  if (parentId) filters.push(`'${escapeDriveQuery(parentId)}' in parents`);

  const response = await withGoogleRetry(() => drive.files.list({
    q: filters.join(" and "),
    pageSize: 100,
    orderBy: "modifiedTime desc",
    fields: "files(id,name,mimeType,webViewLink,parents,modifiedTime)"
  }));
  return response.data.files ?? [];
}

export async function getFileMetadata(fileIdOrUrl: string) {
  const fileId = extractGoogleFileId(fileIdOrUrl, "file");
  const auth = await getAuthorizedClient();
  const drive = google.drive({ version: "v3", auth });
  const response = await withGoogleRetry(() => drive.files.get({
    fileId,
    fields: "id,name,mimeType,webViewLink,webContentLink,parents,createdTime,modifiedTime,size,owners(displayName,emailAddress),capabilities(canEdit,canComment,canShare,canDownload),trashed"
  }));
  return response.data;
}

export async function createFolder(name: string, parentId?: string) {
  const auth = await getAuthorizedClient();
  const drive = google.drive({ version: "v3", auth });
  const response = await withGoogleRetry(() => drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined
    },
    fields: "id,name,webViewLink,parents"
  }), { idempotent: false });
  return response.data;
}

export async function moveFile(fileId: string, parentFolderId?: string) {
  if (!parentFolderId) return;
  const auth = await getAuthorizedClient();
  const drive = google.drive({ version: "v3", auth });
  const current = await withGoogleRetry(() => drive.files.get({ fileId, fields: "parents" }));
  await withGoogleRetry(() => drive.files.update({
    fileId,
    addParents: parentFolderId,
    removeParents: current.data.parents?.join(","),
    fields: "id,parents"
  }));
}

export async function shareFile(fileId: string, type: "user" | "group" | "domain" | "anyone", role: "reader" | "commenter" | "writer", emailAddress?: string, domain?: string) {
  const auth = await getAuthorizedClient();
  const drive = google.drive({ version: "v3", auth });
  const response = await withGoogleRetry(() => drive.permissions.create({
    fileId,
    sendNotificationEmail: Boolean(emailAddress),
    requestBody: { type, role, emailAddress, domain },
    fields: "id,type,role,emailAddress,domain"
  }), { idempotent: false });
  return response.data;
}
