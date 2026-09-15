import { APP_BUILD, members, MEMBER_ORDER, debugLogLines, analysisProgress } from "./config.js";
import { drawOriginalImage, analyzeFactorImage } from "./analysis/image-analysis.js";
import { createOcrWorker, runOcrForFactorMetadata, runOcrForWhiteCards } from "./ocr/ocr.js";
import { renderAnalysisDebug, renderAnalysisError, renderUnsupportedLayouts, renderOverallSkillSummary, appendSummaryToDebugLog, resetReviewAccordionState, resetUnsupportedLayouts } from "./result/results.js?v=20260915-representative-check-03";
import { ensureDynamicStyles, ensureAnalysisProgressOverlay, ensureResultSummaryContainer, updateAnalysisProgressDisplay, showAnalysisProgress, hideAnalysisProgress, showAnalysisCompleteProgress, scrollToResultsTop, initializePageScrollPosition, setPasteTarget, updateImageSummary } from "./ui/ui.js?v=20260915-representative-check-03";
import { initializePresetManager } from "./preset/preset-manager.js";
import { initializeTheme } from "./ui/theme.js";
import { initializeRepresentativeCheck } from "./representative/representative-check.js?v=20260915-representative-check-03";

console.info(
  `[Uma Factor Checker] build: ${APP_BUILD}`
);

initializeTheme();
initializePageScrollPosition();
initializePresetManager();
initializeRepresentativeCheck();

/* =========================================================
  全人物の保存済み解析結果初期化処理
  再解析時に古い結果が混ざらないようにする。
  ========================================================= */

function resetAnalysisResults() {
  MEMBER_ORDER.forEach(
    memberId => {
      members[
        memberId
      ].analysisResults = [];
    }
  );
}

/* =========================================================
  解析対象画像総数取得処理
  ========================================================= */

function getTotalImageCount() {
  return MEMBER_ORDER.reduce(
    (
      total,
      memberId
    ) =>
      total +
      members[
        memberId
      ].images.length,
    0
  );
}

/* =========================================================
  画像解析メイン処理

  1. 解析中オーバーレイ表示
  2. OCR worker生成
  3. カード検出
  4. 色・星判定
  5. 白因子OCR
  6. スキル要件との類似照合
  7. 人物ごとに解析結果保存
  8. 同一人物内の重複除去
  9. 6人分集計
  10. 結果表示
  ========================================================= */

const analyzeImagesButton =
  document.getElementById(
    "analyze-images"
  );

if (analyzeImagesButton) {
  analyzeImagesButton.addEventListener(
    "click",
    async () => {
      const totalImages =
        getTotalImageCount();

      if (
        totalImages === 0
      ) {
        return;
      }

      const debugContainer =
        document.getElementById(
          "analysis-debug"
        );

      if (debugContainer) {
        debugContainer.innerHTML =
          "";
      }

      const resultContainer =
        ensureResultSummaryContainer();

      resultContainer.innerHTML =
        "";

      debugLogLines.length = 0;

      resetReviewAccordionState();

      resetUnsupportedLayouts();

      resetAnalysisResults();

      const copyButton =
        document.getElementById(
          "copy-debug-log"
        );

      if (copyButton) {
        copyButton.disabled =
          true;
      }

      const copyStatus =
        document.getElementById(
          "copy-debug-status"
        );

      if (copyStatus) {
        copyStatus.textContent =
          "";
      }

      const ocrStatus =
        document.getElementById(
          "ocr-status"
        );

      if (ocrStatus) {
        ocrStatus.textContent =
          "";
      }

      analyzeImagesButton.disabled =
        true;

      showAnalysisProgress(
        totalImages
      );

      const activeMembers =
        MEMBER_ORDER
          .filter(
            memberId =>
              members[
                memberId
              ].images.length > 0
          )
          .map(
            memberId => [
              memberId,
              members[
                memberId
              ]
            ]
          );

      let ocrWorker = null;
      let globalImageNumber = 0;
      let analyzedImageCount = 0;
      const unsupportedLayouts = [];

      try {
        ocrWorker =
          await createOcrWorker();
      } catch (error) {
        console.error(
          "OCRの初期化に失敗しました",
          error
        );

        if (ocrStatus) {
          ocrStatus.textContent =
            "OCRの初期化に失敗しました。";
        }

        updateAnalysisProgressDisplay(
          "OCRの初期化に失敗しました",
          error.message ||
          "Tesseract.jsを確認してください。"
        );

        await new Promise(
          resolve =>
            setTimeout(
              resolve,
              1200
            )
        );

        hideAnalysisProgress();

        analyzeImagesButton.disabled =
          false;

        return;
      }

      try {
        for (
          const [
            memberId,
            member
          ]
          of activeMembers
        ) {
          for (
            let i = 0;
            i < member.images.length;
            i++
          ) {
            globalImageNumber++;

            analysisProgress
              .currentImageNumber =
                globalImageNumber;

            analysisProgress
              .currentMemberLabel =
                member.label;

            analysisProgress
              .currentImageIndex =
                i;

            analysisProgress
              .currentWhiteCard = 0;

            analysisProgress
              .totalWhiteCards = 0;

            analysisProgress
              .tesseractProgress = 0;

            updateAnalysisProgressDisplay(
              `${member.label} / 画像${i + 1}`,
              `カードを検出しています... ・ 全体 ${globalImageNumber} / ${totalImages}画像`
            );

            const imageData =
              member.images[i];

            try {
              const {
                canvas,
                ctx,
                width,
                height
              } =
                await drawOriginalImage(
                  imageData.file
                );

              updateAnalysisProgressDisplay(
                `${member.label} / 画像${i + 1}`,
                `因子カードを解析しています... ・ 全体 ${globalImageNumber} / ${totalImages}画像`
              );

              const analysis =
                analyzeFactorImage(
                  ctx,
                  width,
                  height
                );

              const detectedLeftCount =
                analysis.detectedRows.filter(
                  row => row.left
                ).length;

              const detectedRightCount =
                analysis.detectedRows.filter(
                  row => row.right
                ).length;

              debugLogLines.push(
                "image classification:",
                `member=${memberId}`,
                `imageIndex=${i + 1}`,
                `supported=${analysis.supported === true}`,
                `layout=${analysis.classificationLayout ?? analysis.layoutType}`,
                `reason=${analysis.supportReason ?? analysis.unsupportedReason ?? "-"}`,
                `left=${detectedLeftCount}`,
                `right=${detectedRightCount}`,
                `anchorFound=${analysis.factorAnchorFound}`,
                `anchorY=${analysis.factorAnchorY ?? "-"}`,
                `addedToUnsupportedImages=${analysis.supported !== true}`,
                ""
              );

              if (
                analysis.supported !== true
              ) {
                member
                  .analysisResults
                  .push({
                    imageId:
                      imageData.id,
                    imageIndex:
                      i,
                    analysis
                  });

                unsupportedLayouts.push({
                  memberId,
                  memberLabel:
                    member.label,
                  imageIndex: i,
                  reason:
                    analysis
                      .unsupportedReason,
                  analysis
                });

                updateAnalysisProgressDisplay(
                  `${member.label} / 画像${i + 1}`,
                  `非対応の画像形式です。OCRを実行せず次の画像へ進みます。`
                );

                continue;
              }

              const factorMetadata =
                await runOcrForFactorMetadata(
                  ocrWorker,
                  canvas,
                  analysis
                );

              debugLogLines.push(
                "factor metadata:",
                `member=${memberId}`,
                `imageIndex=${i + 1}`,
                `metadataFound=${analysis.factorMetadataFound}`,
                `layout=${analysis.classificationLayout}`,
                `blueCardFound=${Boolean(factorMetadata.blue)}`,
                `blueRawOcr=${JSON.stringify(factorMetadata.blue?.rawOcrText ?? "")}`,
                `blueNormalized=${JSON.stringify(factorMetadata.blue?.normalizedOcrText ?? "")}`,
                `blueCandidate=${factorMetadata.blue?.candidate ?? "-"}`,
                `blueSimilarity=${factorMetadata.blue?.similarity?.toFixed(3) ?? "-"}`,
                `blueConfidence=${factorMetadata.blue?.confidence?.toFixed(1) ?? "-"}`,
                `blueCanonical=${factorMetadata.blue?.name ?? "-"}`,
                `blueStars=${factorMetadata.blue?.stars ?? "-"}`,
                `redCardFound=${Boolean(factorMetadata.red)}`,
                `redRawOcr=${JSON.stringify(factorMetadata.red?.rawOcrText ?? "")}`,
                `redNormalized=${JSON.stringify(factorMetadata.red?.normalizedOcrText ?? "")}`,
                `redCandidate=${factorMetadata.red?.candidate ?? "-"}`,
                `redSimilarity=${factorMetadata.red?.similarity?.toFixed(3) ?? "-"}`,
                `redConfidence=${factorMetadata.red?.confidence?.toFixed(1) ?? "-"}`,
                `redCanonical=${factorMetadata.red?.name ?? "-"}`,
                `redStars=${factorMetadata.red?.stars ?? "-"}`,
                `greenCardFound=${Boolean(factorMetadata.green)}`,
                `greenCanonical=${factorMetadata.green?.name ?? "-"}`,
                `greenStars=${factorMetadata.green?.stars ?? "-"}`,
                "",
                "【因子情報】",
                `青：${factorMetadata.blue?.name ?? "名称未確定"} ${"★".repeat(factorMetadata.blue?.stars ?? 0) || "-"}`,
                `赤：${factorMetadata.red?.name ?? "名称未確定"} ${"★".repeat(factorMetadata.red?.stars ?? 0) || "-"}`,
                `緑：${factorMetadata.green?.name ?? "-"} ${"★".repeat(factorMetadata.green?.stars ?? 0) || "-"}`,
                ""
              );

              await runOcrForWhiteCards(
                ocrWorker,
                canvas,
                analysis,
                member.label,
                i
              );

              member
                .analysisResults
                .push({
                  imageId:
                    imageData.id,
                  imageIndex:
                    i,
                  analysis
                });

              analyzedImageCount++;

              renderAnalysisDebug(
                member.label,
                i,
                canvas,
                analysis
              );

              analysisProgress
                .currentWhiteCard =
                  analysisProgress
                    .totalWhiteCards;

              analysisProgress
                .tesseractProgress = 1;

              updateAnalysisProgressDisplay(
                `${member.label} / 画像${i + 1}`,
                `解析完了 ・ 全体 ${globalImageNumber} / ${totalImages}画像`
              );
            } catch (error) {
              console.error(
                `${member.label} / 画像${i + 1} の解析に失敗しました`,
                error
              );

              renderAnalysisError(
                member.label,
                i,
                error
              );

              updateAnalysisProgressDisplay(
                `${member.label} / 画像${i + 1}`,
                `この画像の解析に失敗しました。次の画像へ進みます。`
              );
            }
          }
        }
      } finally {
        if (
          ocrWorker
        ) {
          try {
            await ocrWorker
              .terminate();
          } catch (error) {
            console.warn(
              "OCR worker終了時にエラーが発生しました",
              error
            );
          }
        }
      }

      if (
        analyzedImageCount > 0 ||
        unsupportedLayouts.length === 0
      ) {
        renderOverallSkillSummary();
      }

      renderUnsupportedLayouts(
        unsupportedLayouts,
        analyzedImageCount > 0
      );

      debugLogLines.push(
        `supportedImageCount=${analyzedImageCount}`,
        `unsupportedImageCount=${unsupportedLayouts.length}`,
        ""
      );

      appendSummaryToDebugLog();

      if (ocrStatus) {
        ocrStatus.textContent =
          "解析が完了しました。";
      }

      if (copyButton) {
        copyButton.disabled =
          debugLogLines.length ===
          0;
      }

      await showAnalysisCompleteProgress();

      const resultTabButton =
        document.querySelector(
          '[data-tab="results"]'
        );

      if (resultTabButton) {
        resultTabButton.click();
      }

      hideAnalysisProgress();

      scrollToResultsTop();

      analyzeImagesButton.disabled =
        false;
    }
  );
}

/* =========================================================
  初期状態設定
  ========================================================= */

ensureDynamicStyles();
ensureAnalysisProgressOverlay();
ensureResultSummaryContainer();

setPasteTarget(
  "parentA"
);
