function initializeUsageModal() {
  const openButton = document.getElementById("usage-open");
  const backdrop = document.getElementById("usage-modal");
  const dialog = backdrop?.querySelector(".usage-modal");
  const closeButton = document.getElementById("usage-close");

  if (!openButton || !backdrop || !dialog || !closeButton) {
    return;
  }

  let returnFocus = null;

  const close = () => {
    if (backdrop.hidden) {
      return;
    }

    backdrop.hidden = true;
    document.body.classList.remove("usage-modal-open");
    openButton.setAttribute("aria-expanded", "false");
    returnFocus?.focus();
  };

  const open = () => {
    returnFocus = document.activeElement;
    backdrop.hidden = false;
    document.body.classList.add("usage-modal-open");
    openButton.setAttribute("aria-expanded", "true");
    closeButton.focus();
  };

  openButton.addEventListener("click", open);
  closeButton.addEventListener("click", close);
  backdrop.addEventListener("click", event => {
    if (event.target === backdrop) {
      close();
    }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !backdrop.hidden) {
      close();
    }
  });
}

export { initializeUsageModal };
