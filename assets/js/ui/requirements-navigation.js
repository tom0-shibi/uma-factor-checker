import { requirements, members, MEMBER_ORDER } from "../config.js";

function hasAppliedRequirements() {
  return ["S", "A", "B", "C"].some(
    rank => Array.isArray(requirements[rank]) && requirements[rank].length > 0
  );
}

function hasInheritanceData() {
  return MEMBER_ORDER.some(memberId => {
    const member = members[memberId];
    return Boolean(
      member && (
        (Array.isArray(member.images) && member.images.length > 0) ||
        (Array.isArray(member.analysisResults) && member.analysisResults.length > 0) ||
        Boolean(member.libraryEntry)
      )
    );
  });
}

function showWorkflowNotice(message) {
  let notice = document.getElementById("workflow-navigation-notice");
  if (!notice) {
    const tabs = document.querySelector(".tabs");
    if (!tabs) return;
    notice = document.createElement("div");
    notice.id = "workflow-navigation-notice";
    notice.className = "workflow-navigation-notice";
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");
    tabs.insertAdjacentElement("afterend", notice);
  }
  notice.textContent = message;
  notice.hidden = false;
}

function clearWorkflowNotice() {
  const notice = document.getElementById("workflow-navigation-notice");
  if (notice) notice.hidden = true;
}

function openTab(tabId) {
  const button = document.querySelector(`[data-tab="${tabId}"]`);
  if (button) button.click();
}

function guardWorkflowTabClick(event) {
  const button = event.target.closest?.(".tab-button[data-tab]");
  if (!button) return;

  const tabId = button.dataset.tab;
  if (tabId === "requirements") {
    clearWorkflowNotice();
    return;
  }

  if (!hasAppliedRequirements()) {
    event.preventDefault();
    event.stopImmediatePropagation();
    openTab("requirements");
    showWorkflowNotice(
      tabId === "results"
        ? "継承プランを確認するには、先にスキル要件を設定して「スキル要件を反映」を押してください。"
        : "継承設定を始めるには、先にスキル要件を設定して「スキル要件を反映」を押してください。"
    );
    return;
  }

  if (tabId === "results" && !hasInheritanceData()) {
    event.preventDefault();
    event.stopImmediatePropagation();
    openTab("images");
    showWorkflowNotice(
      "継承プランを確認するには、先に継承ウマ娘を設定してください。画像または保存データから設定できます。"
    );
    return;
  }

  clearWorkflowNotice();
}

export function initializeRequirementsAppliedNavigation() {
  document.addEventListener("click", guardWorkflowTabClick, true);

  document.addEventListener(
    "requirements-applied",
    event => {
      if (!event.detail?.navigateToImages) return;
      clearWorkflowNotice();
      openTab("images");
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
    }
  );
}
