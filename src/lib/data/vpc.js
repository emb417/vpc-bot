import "dotenv/config";

const baseApiUrl = process.env.VPC_DATA_SERVICE_API_URI;

/**
 * Get scores by table and author using fuzzy search.
 */
export const getScoresByTableAndAuthorUsingFuzzyTableSearch = async (
  tableSearchTerm,
) => {
  const response = await fetch(
    `${baseApiUrl}/scoresByTableAndAuthorUsingFuzzyTableSearch?tableSearchTerm=${encodeURIComponent(tableSearchTerm)}`,
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
 * Get the current week for a channel.
 */
export const getCurrentWeek = async (channelName) => {
  const response = await fetch(
    `${baseApiUrl}/currentWeek?channelName=${encodeURIComponent(channelName)}`,
  );
  return response.json();
};

export default {
  getScoresByTableAndAuthorUsingFuzzyTableSearch,
  getScoresByVpsId,
  getCurrentWeek,
};
