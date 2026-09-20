import { IS_DEV } from "../environment.js";
import { analysisProgress } from "../config.js";
import { replaceImagesForDevelopment } from "../ui/ui.js?v=20260921-duplicate-paste-01";

const FIXTURE_ASSIGNMENTS = {
  parentA: ["parent-a-01", "parent-a-02"],
  grandA1: ["grand-a1-01"],
  grandA2: ["grand-a2-01", "grand-a2-02"],
  parentB: ["parent-b-01", "parent-b-02"],
  grandB1: ["grand-b1-01"],
  grandB2: ["grand-b2-01", "grand-b2-02"]
};

async function loadFixtureFiles() {
  if (!IS_DEV) {
    throw new Error("テスト画像はdev環境専用です。");
  }
  return Object.fromEntries(await Promise.all(
    Object.entries(FIXTURE_ASSIGNMENTS).map(async ([id, names]) => [
      id,
      await Promise.all(names.map(async name => {
        const filename = `skill-check-${name}.png`;
        const url = new URL(
          `../../../tests/fixtures/factor-images/regression-20260916/${filename}`,
          import.meta.url
        );
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`${filename}: HTTP ${response.status}`);
        }
        const blob = await response.blob();
        // Decode before replacing anything: also rejects corrupt images/HTML responses.
        const bitmap = await createImageBitmap(blob);
        bitmap.close();
        const header = new Uint8Array(await blob.slice(0, 3).arrayBuffer());
        const type = header[0] === 255 && header[1] === 216 && header[2] === 255
          ? "image/jpeg" : "image/png";
        return new File([blob], filename, { type });
      }))
    ])
  ));
}

function initializeFixtureControls() {
  if (!IS_DEV) {
    return;
  }
  const controls = document.getElementById("dev-controls");
  const button = document.getElementById("set-test-images");
  const status = document.getElementById("test-images-status");
  controls.hidden = false;
  button.addEventListener("click", async () => {
    if (button.disabled || analysisProgress.active) {
      return;
    }
    button.disabled = true;
    status.textContent = "テスト画像10枚を読み込み中…";
    try {
      const files = await loadFixtureFiles();
      replaceImagesForDevelopment(files);
      status.textContent = "10枚を6枠へセットしました。「画像を解析」で解析してください。";
    } catch (error) {
      status.textContent = `セットできませんでした：${error.message}`;
    } finally {
      button.disabled = false;
    }
  });
}

export { FIXTURE_ASSIGNMENTS, loadFixtureFiles, initializeFixtureControls };
