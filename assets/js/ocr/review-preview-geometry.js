function getSourceCardThumbnailCrop(sourceWidth, sourceHeight, card) {
  const paddingX = Math.round(card.width * 0.02);
  return {
    x: Math.max(0, card.x - paddingX),
    y: Math.max(0, card.y),
    width: Math.min(
      sourceWidth - Math.max(0, card.x - paddingX),
      card.width + paddingX * 2
    ),
    height: Math.min(
      sourceHeight - Math.max(0, card.y),
      card.height
    )
  };
}

export { getSourceCardThumbnailCrop };
