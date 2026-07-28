export function confirmModal(title, text) {
  return new Promise((resolve) => {
    const m = document.getElementById("custom-modal");
    if (!m) {
      resolve(window.confirm(text));
      return;
    }
    document.getElementById("modal-title").innerText = title;
    document.getElementById("modal-text").innerHTML = text;

    // clone 掉舊按鈕以清除先前綁定的 onclick，避免重複觸發
    const yesBtn = document.getElementById("modal-btn-yes");
    const noBtn = document.getElementById("modal-btn-no");
    const yes = yesBtn.cloneNode(true);
    const no = noBtn.cloneNode(true);
    yesBtn.replaceWith(yes);
    noBtn.replaceWith(no);

    yes.onclick = () => {
      m.style.display = "none";
      resolve(true);
    };
    no.onclick = () => {
      m.style.display = "none";
      resolve(false);
    };
    m.style.display = "flex";
  });
}
