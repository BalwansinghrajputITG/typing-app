export function calculateTier(points) {
  if (points >= 900) return "DIAMOND";
  if (points >= 500) return "PLATINUM";
  if (points >= 250) return "GOLD";
  if (points >= 100) return "SILVER";
  return "BRONZE";
}

export function tierWeight(tier) {
  const weights = {
    BRONZE: 1,
    SILVER: 2,
    GOLD: 3,
    PLATINUM: 4,
    DIAMOND: 5
  };

  return weights[tier] ?? 0;
}
