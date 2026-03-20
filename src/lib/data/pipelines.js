/**
 * Search pipeline for finding a specific score by VPS ID and version.
 */
const searchScorePipeline = (vpsId, versionNumber) => [
  { $unwind: "$authors" },
  {
    $unwind: { path: "$authors.versions", preserveNullAndEmptyArrays: true },
  },
  {
    $unwind: {
      path: "$authors.versions.scores",
      preserveNullAndEmptyArrays: true,
    },
  },
  {
    $project: {
      tableName: "$tableName",
      AuthorName: "$authors.authorName",
      vpsId: "$authors.vpsId",
      versionNumber: "$authors.versions.versionNumber",
      score: "$authors.versions.scores.score",
      user: "$authors.versions.scores.user",
      _id: 0,
    },
  },
  { $sort: { tableName: 1, AuthorName: -1, versionNumber: -1, score: -1 } },
  { $match: { vpsId: vpsId, versionNumber: versionNumber } },
  { $limit: 1 },
];

/**
 * Search pipeline for finding a score by VPS ID, username, and score value.
 */
const searchScoreByVpsIdUsernameScorePipeline = (data) => [
  { $unwind: "$authors" },
  {
    $unwind: { path: "$authors.versions", preserveNullAndEmptyArrays: true },
  },
  {
    $unwind: {
      path: "$authors.versions.scores",
      preserveNullAndEmptyArrays: true,
    },
  },
  {
    $project: {
      tableId: "$_id",
      tableName: "$tableName",
      authorId: "$authors._id",
      authorName: "$authors.authorName",
      vpsId: "$authors.vpsId",
      versionId: "$authors.versions._id",
      versionNumber: "$authors.versions.versionNumber",
      tableUrl: "$authors.versions.versionUrl",
      scoreId: "$authors.versions.scores._id",
      user: "$authors.versions.scores.user",
      userName: "$authors.versions.scores.username",
      score: "$authors.versions.scores.score",
      posted: "$authors.versions.scores.createdAt",
      postUrl: "$authors.versions.scores.postUrl",
      _id: 0,
    },
  },
  {
    $match: {
      $expr: {
        $and: [
          { $eq: ["$vpsId", data.vpsId] },
          { $eq: ["$userName", data.u] },
          { $eq: ["$score", data.s] },
        ],
      },
    },
  },
];

/**
 * Pipeline for ranking players across weeks.
 */
const rankingPipeline = (weeks, players) => [
  {
    $match: {
      weekNumber: {
        $in: weeks,
      },
    },
  },
  {
    $unwind: {
      path: "$scores",
    },
  },
  {
    $project: {
      _id: 0,
      username: "$scores.username",
      score: "$scores.score",
    },
  },
  {
    $group: {
      _id: "$username",
      total: {
        $sum: "$score",
      },
    },
  },
  {
    $sort: {
      total: -1,
    },
  },
  {
    $match: {
      _id: {
        $in: players,
      },
    },
  },
];

export default {
  searchScorePipeline,
  searchScoreByVpsIdUsernameScorePipeline,
  rankingPipeline,
};
