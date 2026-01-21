import "dotenv/config";

const baseApiUrl = process.env.VPS_DATA_SERVICE_API_URI;

/**
 * Get VPS game data by VPS ID.
 */
export const getVpsGame = async (vpsId) => {
  const response = await fetch(`${baseApiUrl}/games/tables/${vpsId}`);
  return response.json();
};

export default {
  getVpsGame,
};
