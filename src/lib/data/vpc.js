import "dotenv/config";

const baseApiUrl = process.env.VPC_DATA_SERVICE_API_URI;

/**
 * Get all tables.
 */
export const getTables = async () => {
  const response = await fetch(`${baseApiUrl}/tables`);
  return response.json();
};

/**
 * Get tables with author and version info.
 */
export const getTablesWithAuthorVersion = async () => {
  const response = await fetch(`${baseApiUrl}/tablesWithAuthorVersion`);
  return response.json();
};

/**
 * Get scores by table name.
 */
export const getScoresByTable = async (tableName) => {
  const response = await fetch(
    `${baseApiUrl}/scoresByTable?tableName=${encodeURIComponent(tableName)}`
  );
  return response.json();
};

/**
 * Get scores by table and author using fuzzy search.
 */
export const getScoresByTableAndAuthorUsingFuzzyTableSearch = async (
  tableSearchTerm
) => {
  const response = await fetch(
    `${baseApiUrl}/scoresByTableAndAuthorUsingFuzzyTableSearch?tableSearchTerm=${encodeURIComponent(tableSearchTerm)}`
  );
  return response.json();
};

/**
 * Get scores by table and author.
 */
export const getScoresByTableAndAuthor = async (tableName, authorName) => {
  const response = await fetch(
    `${baseApiUrl}/scoresByTableAndAuthor?tableName=${encodeURIComponent(tableName)}&authorName=${encodeURIComponent(authorName)}`
  );
  return response.json();
};

/**
 * Get scores by table, author, and version.
 */
export const getScoresByTableAndAuthorAndVersion = async (
  tableName,
  authorName,
  versionNumber
) => {
  const response = await fetch(
    `${baseApiUrl}/scoresByTableAndAuthorAndVersion?tableName=${encodeURIComponent(tableName)}&authorName=${encodeURIComponent(authorName)}&versionNumber=${encodeURIComponent(versionNumber)}`
  );
  return response.json();
};

/**
 * Get scores by VPS ID.
 */
export const getScoresByVpsId = async (vpsId) => {
  const response = await fetch(`${baseApiUrl}/scoresByVpsId?vpsId=${vpsId}`);
  return response.json();
};

/**
 * Get all weeks.
 */
export const getWeeks = async () => {
  const response = await fetch(`${baseApiUrl}/weeks`);
  return response.json();
};

/**
 * Get the current week for a channel.
 */
export const getCurrentWeek = async (channelName) => {
  const response = await fetch(
    `${baseApiUrl}/currentWeek?channelName=${encodeURIComponent(channelName)}`
  );
  return response.json();
};

export default {
  getTables,
  getTablesWithAuthorVersion,
  getScoresByTable,
  getScoresByTableAndAuthorUsingFuzzyTableSearch,
  getScoresByTableAndAuthor,
  getScoresByTableAndAuthorAndVersion,
  getScoresByVpsId,
  getWeeks,
  getCurrentWeek,
};
