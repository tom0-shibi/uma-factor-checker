export function initializeRequirementsAppliedNavigation() {
  document.addEventListener(
    "requirements-applied",
    event => {
      if (
        !event.detail
          ?.navigateToImages
      ) {
        return;
      }

      const imageTabButton =
        document.querySelector(
          '[data-tab="images"]'
        );

      if (imageTabButton) {
        imageTabButton.click();
      }
    }
  );
}
