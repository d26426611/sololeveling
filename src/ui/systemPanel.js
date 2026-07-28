import { StorageSystem } from "../systems/storage.js";
import { confirmModal } from "./modal.js";

export function initSystemPanel() {
  const pane = document.getElementById("tab-system");
  if (!pane) return;
  pane.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === "save") {
      StorageSystem.saveGame(true);
    } else if (action === "reset") {
      if (await confirmModal("重置進度", "確定要刪除所有進度嗎？此操作無法復原。")) StorageSystem.hardReset();
    } else if (action === "export") {
      StorageSystem.exportSave();
    } else if (action === "import") {
      const area = document.getElementById("save-code-area");
      if (StorageSystem.importSave(area.value.trim())) {
        setTimeout(() => location.reload(), 500);
      }
    }
  });
}
