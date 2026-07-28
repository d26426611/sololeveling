import { Player } from "../state/player.js";
import { GlobalSystem } from "../state/globalSystem.js";
import { toast } from "../ui/toast.js";

export const StorageSystem = {
  SAVE_KEY: "rpg_abyss_v6",

  saveGame(manual = false) {
    if (Player.currentHp <= 0 || !Player.class) return;
    const data = { player: Player, global: GlobalSystem.data, ts: Date.now() };
    localStorage.setItem(this.SAVE_KEY, JSON.stringify(data));
    if (manual) toast("✅ 進度已保存", "gain");
  },

  hasSave() {
    return !!localStorage.getItem(this.SAVE_KEY);
  },

  loadGame() {
    try {
      const raw = localStorage.getItem(this.SAVE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (d.player) Object.assign(Player, d.player);
      if (d.global) GlobalSystem.data = { ...GlobalSystem.defaultData, ...d.global };
      if (!Player.stats) Player.stats = { ...Player.baseStats };
      return true;
    } catch (e) {
      console.error("Load failed", e);
      return false;
    }
  },

  hardReset() {
    localStorage.removeItem(this.SAVE_KEY);
    location.reload();
  },

  exportSave() {
    const code = btoa(encodeURIComponent(JSON.stringify({ player: Player, global: GlobalSystem.data })));
    const area = document.getElementById("save-code-area");
    if (!area) return code;
    area.value = code;
    area.select();
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(code).then(
        () => toast("📋 代碼已複製", "gain"),
        () => toast("✅ 代碼已生成 (請手動複製)", "gain")
      );
    } else {
      document.execCommand("copy");
      toast("代碼已複製", "gain");
    }
    return code;
  },

  importSave(code) {
    if (!code) return false;
    try {
      const d = JSON.parse(decodeURIComponent(atob(code)));
      if (!d.player) throw new Error("format");
      Object.assign(Player, d.player);
      GlobalSystem.data = { ...GlobalSystem.defaultData, ...d.global };
      this.saveGame(true);
      return true;
    } catch (e) {
      toast("無效代碼", "warn");
      return false;
    }
  },
};
