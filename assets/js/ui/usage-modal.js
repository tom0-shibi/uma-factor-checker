function initializeUsageModal() {
  const openButton = document.getElementById("usage-open");
  const backdrop = document.getElementById("usage-modal");
  const dialog = backdrop?.querySelector(".usage-modal");
  const closeButton = document.getElementById("usage-close");
  const toolButton = document.getElementById("tool-open");
  const toolMenu = document.getElementById("tool-menu");
  const toolSwitcher = toolButton?.parentElement;

  if (!openButton || !backdrop || !dialog || !closeButton) {
    return;
  }

  let returnFocus = null;

  const closeToolMenu = () => {
    if (!toolButton || !toolMenu) {
      return;
    }

    toolMenu.hidden = true;
    toolButton.setAttribute("aria-expanded", "false");
  };

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
    closeToolMenu();
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

  if (toolButton && toolMenu && toolSwitcher) {
    toolButton.addEventListener("click", () => {
      toolMenu.hidden = !toolMenu.hidden;
      toolButton.setAttribute("aria-expanded", String(!toolMenu.hidden));
    });

    document.addEventListener("click", event => {
      if (!toolSwitcher.contains(event.target)) {
        closeToolMenu();
      }
    });

    document.addEventListener("focusin", event => {
      if (!toolSwitcher.contains(event.target)) {
        closeToolMenu();
      }
    });
  }

  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") {
      return;
    }

    if (!backdrop.hidden) {
      close();
      return;
    }

    if (toolButton && toolMenu && !toolMenu.hidden) {
      closeToolMenu();
      toolButton.focus();
    }
  });
}

export { initializeUsageModal };
