import { randomUUID } from "node:crypto";

export type ApprovalRecord = {
  id: string;
  action: "classroom.publish" | "drive.share";
  summary: Record<string, unknown>;
  expiresAt: string;
};

const approvals = new Map<string, ApprovalRecord>();

export function createApproval(action: ApprovalRecord["action"], summary: Record<string, unknown>): ApprovalRecord {
  const record: ApprovalRecord = {
    id: randomUUID(),
    action,
    summary,
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString()
  };
  approvals.set(record.id, record);
  return record;
}

export function consumeApproval(id: string, action: ApprovalRecord["action"]): ApprovalRecord {
  const record = approvals.get(id);
  if (!record || record.action !== action) throw new Error("승인 요청을 찾을 수 없거나 작업이 일치하지 않습니다.");
  if (Date.parse(record.expiresAt) <= Date.now()) {
    approvals.delete(id);
    throw new Error("승인 요청이 만료되었습니다. 작업 초안을 다시 생성하세요.");
  }
  approvals.delete(id);
  return record;
}

export function resetApprovalsForTests() {
  approvals.clear();
}
