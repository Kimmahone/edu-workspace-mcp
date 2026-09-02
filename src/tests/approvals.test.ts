import assert from "node:assert/strict";
import test from "node:test";
import { consumeApproval, createApproval, resetApprovalsForTests } from "../approvals/service.js";

test("approval can only be consumed once for the matching action", () => {
  resetApprovalsForTests();
  const approval = createApproval("classroom.publish", { courseId: "course-1" });
  assert.equal(consumeApproval(approval.id, "classroom.publish").summary.courseId, "course-1");
  assert.throws(() => consumeApproval(approval.id, "classroom.publish"));
});

test("approval rejects a different action", () => {
  resetApprovalsForTests();
  const approval = createApproval("drive.share", { fileId: "file-1" });
  assert.throws(() => consumeApproval(approval.id, "classroom.publish"));
});
