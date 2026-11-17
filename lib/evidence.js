export const fullScreenshot = { x: 0.012, y: 0.012, width: 0.976, height: 0.976 };
export function evidenceFor(prospect, title) {
  return prospect.evidence?.[title] || (!prospect.documentAnalysis ? prospect.evidenceByFinding?.[title] : null) || null;
}
