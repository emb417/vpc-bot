import { getCollection } from "../../services/database.js";

/**
 * Calculate tickets for eligible users.
 * @param {Array} weeks - Scores for the weeks
 * @param {Array} entries - entries for the week
 * @returns {Array} List of eligible users with ticket counts
 */
export const calculateRaffleData = (weeks, entries) => {
  if (!weeks || !entries || entries.length === 0) return [];

  const currentWeek = weeks.find((w) => !w.isArchived);
  if (!currentWeek || !currentWeek.scores) return [];

  const lastFourWeeks = weeks
    .filter((w) => w.isArchived)
    .sort((a, b) => new Date(b.periodStart) - new Date(a.periodStart))
    .slice(0, 4);

  const sortedScores = [...currentWeek.scores].sort(
    (a, b) => b.score - a.score,
  );

  const eligibleUsers = entries
    .map((entry) => {
      const userScoreIndex = sortedScores.findIndex(
        (s) => s.userId === entry.userId,
      );
      if (userScoreIndex === -1) return null;

      const rank = userScoreIndex + 1;

      // Performance
      let performanceTickets = 1;
      if (rank <= 10) performanceTickets += 1;
      if (rank <= 3) performanceTickets += 2;

      // Persistence
      const persistenceTickets = Math.min(
        lastFourWeeks.reduce((count, week) => {
          const played = week.scores?.some((s) => s.userId === entry.userId);
          return played ? count + 1 : count;
        }, 0),
        3,
      );

      // Total capped at 7
      const tickets = Math.min(performanceTickets + persistenceTickets, 7);

      return {
        userId: entry.userId,
        username: sortedScores[userScoreIndex].username,
        table: entry.table,
        tickets,
        performanceTickets,
        persistenceTickets,
        score: sortedScores[userScoreIndex].score,
        rank,
      };
    })
    .filter(Boolean);

  const totalTickets = eligibleUsers.reduce(
    (sum, user) => sum + user.tickets,
    0,
  );

  return eligibleUsers
    .map((user) => ({
      ...user,
      probability: totalTickets > 0 ? (user.tickets / totalTickets) * 100 : 0,
    }))
    .sort((a, b) => {
      if (b.tickets !== a.tickets) return b.tickets - a.tickets;
      return b.score - a.score;
    });
};

export const validateEntry = async (userId, table, currentWeek) => {
  const score = currentWeek.scores?.find((s) => s.userId === userId);
  if (!score) {
    return {
      valid: false,
      error:
        "You must have a score posted for the current week to enter the weekly raffle.\n\nYou can post a score with `/post-score` or type `!score 12345678` and attach a photo.",
    };
  }

  const fiftyTwoWeeksAgo = new Date();
  fiftyTwoWeeksAgo.setDate(fiftyTwoWeeksAgo.getDate() - 52 * 7);

  const weeksCollection = await getCollection("weeks");
  const recentPlay = await weeksCollection.findOne({
    vpsId: table.vpsId,
    "scores.userId": userId,
    periodStart: { $gte: fiftyTwoWeeksAgo.toISOString().split("T")[0] },
  });

  if (recentPlay) {
    return {
      valid: false,
      error: `You cannot enter "${table.name}" because it was played in the last 52 weeks (Week of ${recentPlay.periodStart}).`,
    };
  }

  return { valid: true };
};

export default {
  calculateRaffleData,
  validateEntry,
};
