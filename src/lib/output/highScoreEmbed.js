import { EmbedBuilder, AttachmentBuilder } from "discord.js";

export const fetchHighScoresImage = async (vpsId) => {
  const apiUrl = `${process.env.VPC_DATA_SERVICE_API_URI}/generateHighScoresLeaderboard`;
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vpsId, layout: "portrait", numRows: 10 }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch high scores image: ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
};

export const buildHighScoresPage = (version, imageBuffer) => {
  const fileName = `highscores-${version.vpsId}.png`;
  const attachment = new AttachmentBuilder(imageBuffer, { name: fileName });

  const embed = new EmbedBuilder()
    .setTitle(`🏆 High Scores Leaderboard`)
    .setDescription(`<${process.env.HIGH_SCORES_URL}?vpsId=${version.vpsId}>`)
    .setColor("#0099ff")
    .setImage(`attachment://${fileName}`)
    .setFooter({ text: "📌  How to Post: /post-high-score" });

  return { embed, attachment };
};
