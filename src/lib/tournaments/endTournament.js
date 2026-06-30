import "dotenv/config";
import { formatDateISO } from "../../utils/formatting.js";
import { calculateSeasonPoints } from "../scores/points.js";
import { updateOne } from "../../services/database.js";

/**
 * Finalize a tournament: mark it ended, record the actual end date, compute the
 * final standings/winner, and emit `postTournamentResults` so the winner is
 * announced in the tournament channel and the bragging-rights channel.
 *
 * Shared by the `/end-tournament` command and the scheduled auto-end job.
 *
 * @param {Client} client - Discord client (used to emit the announcement event)
 * @param {Object} tournament - the active tournament document
 * @returns {{ endedAt: string, winner: Object|null, topFinishers: Array }}
 */
export const endTournament = async (client, tournament) => {
  const endedAt = formatDateISO();
  await updateOne(
    { channelName: tournament.channelName, status: "active" },
    { $set: { status: "ended", endedAt } },
    null,
    "tournaments",
  );

  const standings = calculateSeasonPoints(tournament.tables ?? []);
  const playerInfo = new Map();
  for (const table of tournament.tables ?? []) {
    for (const s of table.scores ?? []) {
      const key = s.username?.toLowerCase();
      if (key && !playerInfo.has(key)) {
        playerInfo.set(key, {
          userId: s.userId,
          username: s.username,
          userAvatarUrl: s.userAvatarUrl,
        });
      }
    }
  }

  const topFinishers = standings.slice(0, 3).map((row) => {
    const info = playerInfo.get(row.username) ?? {};
    return {
      username: info.username ?? row.username,
      userId: info.userId,
      points: row.points,
      score: row.score,
    };
  });

  const winner = topFinishers[0] ?? null;

  if (winner?.userId) {
    client.emit("postTournamentResults", {
      client,
      tournament,
      endedDate: endedAt,
      winner,
      topFinishers,
      channelIds: [
        tournament.channelId,
        process.env.BRAGGING_RIGHTS_CHANNEL_ID,
      ],
    });
  }

  return { endedAt, winner, topFinishers };
};

export default { endTournament };
