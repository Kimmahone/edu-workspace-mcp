document.addEventListener("click", async (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest("[data-copy-target]");
  if (!(button instanceof HTMLButtonElement)) return;

  const targetId = button.dataset.copyTarget;
  const target = targetId ? document.getElementById(targetId) : null;
  const label = button.querySelector("span");
  if (!target || !label) return;

  try {
    await navigator.clipboard.writeText(target.textContent.trim());
    const original = label.textContent;
    label.textContent = "복사했어요";
    button.classList.add("is-copied");
    window.setTimeout(() => {
      label.textContent = original;
      button.classList.remove("is-copied");
    }, 1800);
  } catch {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(target);
    selection?.removeAllRanges();
    selection?.addRange(range);
    label.textContent = "선택했어요 — 복사해 주세요";
  }
});
