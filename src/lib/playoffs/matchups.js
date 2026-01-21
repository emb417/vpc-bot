/**
 * Get the round name based on remaining participants.
 * @param {number} remainingParticipants - Number of participants in the round
 * @returns {string} The round name
 */
export const getRoundName = (remainingParticipants) => {
  switch (remainingParticipants) {
    case 16:
      return "1st Round";
    case 8:
      return "2nd Round";
    case 4:
      return "Semifinal Round";
    case 2:
      return "Championship Round";
    default:
      return "Unknown Round";
  }
};

/**
 * Get the current playoff matchups with scores.
 * @param {Object} week - The current week data
 * @param {Object} playoff - The playoff data
 * @param {Object} round - The current round data
 * @returns {Array} Array of game matchups
 */
export const getCurrentPlayoffMatchups = (week, playoff, round) => {
  const games = [];

  for (let i = 0; i < round.games.length; i += 2) {
    const awaySeed = parseInt(round.games[i]);
    const awayUsername = playoff.seeds[awaySeed - 1]?.username;
    const awayScore =
      week.scores?.find(({ username }) => username === awayUsername)?.score ??
      null;

    const homeSeed = parseInt(round.games[i + 1]);
    const homeUsername = playoff.seeds[homeSeed - 1]?.username;
    const homeScore =
      week.scores?.find(({ username }) => username === homeUsername)?.score ??
      null;

    games.push({
      away: {
        seed: awaySeed,
        username: awayUsername,
        score: awayScore,
      },
      home: {
        seed: homeSeed,
        username: homeUsername,
        score: homeScore,
      },
    });
  }

  return games;
};

/**
 * Find the winning seeds from matchups.
 * @param {Array} games - Array of game matchups
 * @returns {Array} Array of winning seed numbers
 */
export const findWinningSeeds = (games) => {
  return games.map(({ away, home }) => {
    return home.score >= away.score ? home.seed : away.seed;
  });
};

/**
 * Generate initial bracket matchups for a playoff.
 * @param {number} numSeeds - Number of seeds (8 or 16)
 * @returns {Array} Array of seed numbers in matchup order
 */
export const generateBracket = (numSeeds) => {
  if (numSeeds === 16) {
    // 1v16, 8v9, 5v12, 4v13, 3v14, 6v11, 7v10, 2v15
    return [1, 16, 8, 9, 5, 12, 4, 13, 3, 14, 6, 11, 7, 10, 2, 15];
  } else if (numSeeds === 8) {
    // 1v8, 4v5, 3v6, 2v7
    return [1, 8, 4, 5, 3, 6, 2, 7];
  }
  return [];
};

export default {
  getRoundName,
  getCurrentPlayoffMatchups,
  findWinningSeeds,
  generateBracket,
};
