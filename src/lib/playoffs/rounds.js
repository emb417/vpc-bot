import { getRoundName, findWinningSeeds, getCurrentPlayoffMatchups } from "./matchups.js";

/**
 * Advance to the next playoff round.
 * @param {Object} currentWeek - The current week data
 * @param {Object} currentPlayoff - The current playoff data
 * @param {Object} currentRound - The current round data
 * @returns {Object} New round data
 */
export const advanceRound = (currentWeek, currentPlayoff, currentRound) => {
  const games = getCurrentPlayoffMatchups(
    currentWeek,
    currentPlayoff,
    currentRound
  );

  const winningSeeds = findWinningSeeds(games);
  const roundName = getRoundName(winningSeeds.length);

  return {
    roundName,
    games: winningSeeds,
    matchups: games,
  };
};

/**
 * Check if a playoff is complete.
 * @param {Object} round - The current round
 * @returns {boolean} True if playoff is complete
 */
export const isPlayoffComplete = (round) => {
  return round.games && round.games.length === 2;
};

/**
 * Get the playoff champion from the final round.
 * @param {Object} week - The week data with scores
 * @param {Object} playoff - The playoff data
 * @param {Object} finalRound - The final round data
 * @returns {Object} The champion data { seed, username, score }
 */
export const getChampion = (week, playoff, finalRound) => {
  const games = getCurrentPlayoffMatchups(week, playoff, finalRound);
  if (games.length !== 1) return null;

  const game = games[0];
  return game.home.score >= game.away.score ? game.home : game.away;
};

export default {
  advanceRound,
  isPlayoffComplete,
  getChampion,
};
