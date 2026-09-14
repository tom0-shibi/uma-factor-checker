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

export {
  REPRESENTATIVE_MEMBER_ORDER,
  representativeMembers,
  resetRepresentativeAnalysis
};
