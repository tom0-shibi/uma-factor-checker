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

  const positionToolMenu = () => {
    if (!toolButton || !toolMenu || toolMenu.hidden) {
      return;
    }

    const buttonRect = toolButton.getBoundingClientRect();
    const menuWidth = Math.min(330, Math.max(0, window.innerWidth - 32));
    const left = Math.min(
      Math.max(16, buttonRect.left),
      Math.max(16, window.innerWidth - menuWidth - 16),
    );

    toolMenu.style.setProperty("--tool-menu-top", `${buttonRect.bottom + 8}px`);
    toolMenu.style.setProperty("--tool-menu-left", `${left}px`);
  };

  const closeToolMenu = () => {
    if (!toolButton || !toolMenu) {
      return;
    }

    toolMenu.hidden = true;
    toolMenu.classList.remove("tool-menu-portal");
    toolMenu.style.removeProperty("--tool-menu-top");
    toolMenu.style.removeProperty("--tool-menu-left");

    if (toolSwitcher && toolMenu.parentElement !== toolSwitcher) {
      toolSwitcher.appendChild(toolMenu);
    }

    toolButton.setAttribute("aria-expanded", "false");
  };

  const openToolMenu = () => {
    if (!toolButton || !toolMenu) {
      return;
    }

    document.body.appendChild(toolMenu);
    toolMenu.classList.add("tool-menu-portal");
    toolMenu.hidden = false;
    toolButton.setAttribute("aria-expanded", "true");
    positionToolMenu();
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
    toolButton.addEventListener("click", event => {
      event.stopPropagation();

      if (toolMenu.hidden) {
        openToolMenu();
      } else {
        closeToolMenu();
      }
    });

    toolMenu.addEventListener("click", event => {
      const link = event.target.closest("a[href]");
      if (!link) {
        return;
      }

      event.preventDefault();
      const opened = window.open(link.href, "_blank", "noopener,noreferrer");
      if (opened) {
        opened.opener = null;
      }
      closeToolMenu();
    });

    document.addEventListener("click", event => {
      if (!toolSwitcher.contains(event.target) && !toolMenu.contains(event.target)) {
        closeToolMenu();
      }
    });

    document.addEventListener("focusin", event => {
      if (!toolSwitcher.contains(event.target) && !toolMenu.contains(event.target)) {
        closeToolMenu();
      }
    });

    window.addEventListener("resize", positionToolMenu);
    window.addEventListener("scroll", positionToolMenu, { passive: true });
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
