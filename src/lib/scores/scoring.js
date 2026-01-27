import { formatDateTime } from "../../utils/formatting.js";
import { assignPoints } from "./points.js";

/**
 * Get the rank change for a user after a new score.
 * @param {string} username - The username to check
 * @param {Array} previousScores - Scores before the update
 * @param {Array} newScores - Scores after the update
 * @returns {number} The change in rank (positive = moved up)
 */
export const getRankChange = (username, previousScores, newScores) => {
  const newIndex = newScores.findIndex((x) => x.username === username);
  const previousIndex = previousScores.findIndex(
    (x) => x.username === username,
  );

  if (previousIndex === -1) {
    // New player - their rank change is positions from bottom
    return newScores.length - newIndex;
  }

  const indexDiff = previousIndex - newIndex;
  return indexDiff;
};

/**
 * Get the current rank text for a user.
 * @param {string} username - The username to check
 * @param {Array} scores - The scores array
 * @returns {string} Formatted rank text like "3 of 15"
 */
export const getCurrentRankText = (username, scores) => {
  const index = scores.findIndex((x) => x.username === username) + 1;
  return `${index} of ${scores.length}`;
};

/**
 * Process a new score submission.
 * @param {Object} user - Discord user object
 * @param {number} scoreValue - The score value
 * @param {Object} currentWeek - The current week data
 * @returns {Object} Result object with updated scores and metadata
 */
export const processScore = (user, scoreValue, currentWeek) => {
  const username = user.username?.trimEnd() || user.id;
  const avatarUrl = user.displayAvatarURL();
  const mode = currentWeek.mode ?? "default";
  const scoreAsInt = parseInt(String(scoreValue).replace(/,/g, ""));

  // Clone scores arrays
  const prevScores = currentWeek.scores
    ? JSON.parse(JSON.stringify(currentWeek.scores))
    : [];
  const scores = currentWeek.scores
    ? JSON.parse(JSON.stringify(currentWeek.scores))
    : [];

  // Find existing score
  const existing = scores.find((x) => x.username === username);
  let previousScore = 0;

  if (existing) {
    previousScore = existing.score;
    existing.score = scoreAsInt;
    existing.diff = scoreAsInt - previousScore;
    existing.mode = mode;
    existing.posted = formatDateTime(new Date());
    existing.userAvatarUrl = avatarUrl;
  } else {
    scores.push({
      userId: user.id,
      username: username.replace("`", ""),
      userAvatarUrl: avatarUrl,
      score: scoreAsInt,
      diff: scoreAsInt,
      mode: mode,
      posted: formatDateTime(new Date()),
    });
  }

  // Sort descending by score
  scores.sort((a, b) => b.score - a.score);

  // Assign points
  assignPoints(scores);

  // Calculate rank change
  const rankChange = getRankChange(username, prevScores, scores);
  const currentRank = getCurrentRankText(username, scores);

  return {
    scores,
    previousScore,
    scoreAsInt,
    scoreDiff: scoreAsInt - previousScore,
    rankChange,
    currentRank,
    username,
    mode,
  };
};

/**
 * Validate a score value.
 * @param {string|number} score - The score to validate
 * @returns {Object} { valid: boolean, value: number, error: string }
 */
export const validateScore = (score) => {
  const scoreAsInt = parseInt(String(score).replace(/,/g, ""));
  const re = /^([1-9]|[1-9][0-9]{1,14})$/;

  if (isNaN(scoreAsInt) || !re.test(String(scoreAsInt))) {
    return {
      valid: false,
      value: null,
      error: "The score needs to be a number between 1 and 999999999999999.",
    };
  }

  return {
    valid: true,
    value: scoreAsInt,
    error: null,
  };
};

export default {
  getRankChange,
  getCurrentRankText,
  processScore,
  validateScore,
};
