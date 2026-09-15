const REPRESENTATIVE_MEMBER_ORDER = ["target", "parentA", "parentB"];

const representativeMembers = {
  target: { label: "本体", images: [], analysisResults: [], source: "separate" },
  parentA: { label: "親A", images: [], analysisResults: [], source: "separate" },
  parentB: { label: "親B", images: [], analysisResults: [], source: "separate" }
};

function resetRepresentativeAnalysis(memberId = null) {
  const ids = memberId ? [memberId] : REPRESENTATIVE_MEMBER_ORDER;
  ids.forEach(id => {
    representativeMembers[id].analysisResults = [];
  });
}

function getRepresentativeImageExportPattern(registeredMemberIds) {
  const registered = new Set(registeredMemberIds);
  if (
    registered.size === 1 &&
    registered.has("target")
  ) {
    return "target-only";
  }
  if (
    registered.size === 3 &&
    REPRESENTATIVE_MEMBER_ORDER.every(memberId => registered.has(memberId))
  ) {
    return "full-family";
  }
  return null;
}

export {
  REPRESENTATIVE_MEMBER_ORDER,
  representativeMembers,
  resetRepresentativeAnalysis,
  getRepresentativeImageExportPattern
};
