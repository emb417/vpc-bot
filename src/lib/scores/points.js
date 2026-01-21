/**
 * Points assignment for rankings.
 * Top 10 positions get decreasing points, everyone else gets 1.
 */
const POINTS_BY_RANK = [12, 10, 9, 8, 7, 6, 5, 4, 3, 2];

/**
 * Assign points to scores based on their rank position.
 * Mutates the scores array in place.
 * @param {Array} scores - Array of score objects, already sorted descending by score
 */
export const assignPoints = (scores) => {
  scores.forEach((score, index) => {
    if (index < POINTS_BY_RANK.length) {
      score.points = POINTS_BY_RANK[index];
    } else {
      score.points = 1;
    }
  });
};

/**
 * Calculate total points for a player across multiple weeks.
 * @param {Array} weeks - Array of week objects with scores
 * @returns {Array} Leaderboard array sorted by points (descending)
 */
export const calculateSeasonPoints = (weeks) => {
  const playerMap = new Map();

  weeks.forEach((week) => {
    if (!week.scores) return;

    week.scores.forEach((score) => {
      const username = score.username.toLowerCase();
      const existing = playerMap.get(username);

      if (existing) {
        existing.points += parseInt(score.points) || 0;
        existing.score += parseInt(score.score) || 0;
      } else {
        playerMap.set(username, {
          username: username,
          score: parseInt(score.score) || 0,
          points: parseInt(score.points) || 0,
        });
      }
    });
  });

  // Convert to array and sort by points (descending), then by score (descending)
  return Array.from(playerMap.values()).sort((a, b) => {
    if (a.points === b.points) {
      return b.score - a.score;
    }
    return b.points - a.points;
  });
};

export default {
  assignPoints,
  calculateSeasonPoints,
};
