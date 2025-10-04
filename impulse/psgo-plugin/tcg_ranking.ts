/**
 * TCG Ranking System
 * Handles ELO rating calculations and competitive battle rankings.
 */

import { MongoDB } from '../../impulse/mongodb_module';
import { 
	PlayerRanking,
	BattleHistory,
	RankingSeason,
	DailyChallenge,
	SimulatedBattle,
	SeasonReward
} from './tcg_data';
import { 
	TCGCards,
	PlayerRankings,
	BattleHistories,
	RankingSeasons,
	DailyChallenges,
	SimulatedBattles,
	SeasonRewards
} from './tcg_collections';
import * as TCG_Economy from './tcg_economy';

// ==================== CONSTANTS ====================

export const RANK_THRESHOLDS = {
	'Bronze III': 0,
	'Bronze II': 800,
	'Bronze I': 900,
	'Silver III': 1000,
	'Silver II': 1100,
	'Silver I': 1200,
	'Gold III': 1300,
	'Gold II': 1400,
	'Gold I': 1500,
	'Platinum III': 1600,
	'Platinum II': 1700,
	'Platinum I': 1800,
	'Diamond III': 1900,
	'Diamond II': 2000,
	'Diamond I': 2100,
	'Master': 2200,
	'Grandmaster': 2400,
} as const;

export const RANK_COLORS = {
	'Bronze III': '#CD7F32', 'Bronze II': '#CD7F32', 'Bronze I': '#CD7F32',
	'Silver III': '#C0C0C0', 'Silver II': '#C0C0C0', 'Silver I': '#C0C0C0',
	'Gold III': '#FFD700', 'Gold II': '#FFD700', 'Gold I': '#FFD700',
	'Platinum III': '#E5E4E2', 'Platinum II': '#E5E4E2', 'Platinum I': '#E5E4E2',
	'Diamond III': '#B9F2FF', 'Diamond II': '#B9F2FF', 'Diamond I': '#B9F2FF',
	'Master': '#FF6B6B', 'Grandmaster': '#9B59B6',
} as const;

const DEFAULT_ELO = 1000;
const K_FACTOR = 32;
const DECAY_THRESHOLD_DAYS = 14;
const DECAY_AMOUNT = 25;
const DAILY_CHALLENGES_LIMIT = 10;
const LEADERBOARD_CHALLENGE_RANGE = 50;
const SEASON_DURATION_DAYS = 30;

// Season rewards for top 10 players
export const SEASON_REWARDS = {
	1: { credits: 2000, title: 'Grandmaster Champion' },
	2: { credits: 1500, title: 'Elite Duelist' },
	3: { credits: 1200, title: 'Master Tactician' },
	4: { credits: 1000, title: 'Legendary Trainer' },
	5: { credits: 800, title: 'Expert Battler' },
	6: { credits: 700, title: 'Skilled Challenger' },
	7: { credits: 600, title: 'Rising Star' },
	8: { credits: 500, title: 'Promising Duelist' },
	9: { credits: 400, title: 'Dedicated Trainer' },
	10: { credits: 300, title: 'Top Competitor' },
} as const;

// ==================== CORE FUNCTIONS ====================

/**
 * Calculate ELO change based on battle result
 */
function calculateEloChange(playerElo: number, opponentElo: number, result: number): number {
	const expectedScore = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
	return Math.round(K_FACTOR * (result - expectedScore));
}

/**
 * Determine rank based on ELO rating
 */
function getRankFromElo(elo: number): string {
	const ranks = Object.entries(RANK_THRESHOLDS).reverse();
	for (const [rank, threshold] of ranks) {
		if (elo >= threshold) return rank;
	}
	return 'Bronze III';
}

/**
 * Get division within rank (for display purposes)
 */
function getDivisionFromElo(elo: number, rank: string): number {
	const rankKeys = Object.keys(RANK_THRESHOLDS);
	const currentRankIndex = rankKeys.indexOf(rank);
	
	if (currentRankIndex === -1) return 1;
	if (currentRankIndex === rankKeys.length - 1) return 1; // Grandmaster
	
	const currentThreshold = RANK_THRESHOLDS[rank as keyof typeof RANK_THRESHOLDS];
	const nextThreshold = RANK_THRESHOLDS[rankKeys[currentRankIndex + 1] as keyof typeof RANK_THRESHOLDS];
	const progress = (elo - currentThreshold) / (nextThreshold - currentThreshold);
	
	return Math.min(5, Math.max(1, Math.ceil(progress * 5)));
}

/**
 * Helper function to get card points from rarity
 */
function getCardPointsFromRarity(rarity: string): number {
	switch (rarity) {
		case 'Common': case '1st Edition': case 'Shadowless': return 5;
		case 'Uncommon': return 10;
		case 'Reverse Holo': return 15;
		case 'Rare': return 20;
		case 'Double Rare': case 'Promo': case 'Black Star Promo': return 25;
		case 'Rare Holo': case 'Classic Collection': return 30;
		case 'Rare Holo 1st Edition': return 35;
		case 'Rare SP': return 40;
		case 'Rare Holo EX': case 'Rare Holo GX': case 'Rare Holo V': return 45;
		case 'Rare BREAK': case 'Rare Prime': case 'LEGEND': case 'Prism Star': return 50;
		case 'Rare Holo VMAX': case 'Rare Holo VSTAR': return 55;
		case 'Rare ex': return 60;
		case 'Radiant Rare': return 60;
		case 'Amazing Rare': case 'Shining': return 65;
		case 'ACE SPEC Rare': case 'Rare ACE': return 70;
		case 'Full Art': case 'Rare Ultra': return 75;
		case 'Rare Shiny': case 'Shiny Rare': return 80;
		case 'Trainer Gallery': case 'Character Rare': case 'Rare Shiny GX': case 'Shiny Ultra Rare': return 85;
		case 'Illustration Rare': return 90;
		case 'Rare Holo LV.X': return 95;
		case 'Rare Holo Star': return 100;
		case 'Character Super Rare': return 110;
		case 'Rare Secret': return 120;
		case 'Special Illustration Rare': return 150;
		case 'Rare Rainbow': return 160;
		case 'Gold Full Art': case 'Rare Gold': case 'Hyper Rare': return 175;
		case 'Gold Star': return 200;
		default: return 5;
	}
}

// ==================== PLAYER RANKING FUNCTIONS ====================

/**
 * Get or create player ranking data
 */
export async function getPlayerRanking(userId: string): Promise<PlayerRanking> {
	let ranking = await PlayerRankings.findOne({ userId });
	
	if (!ranking) {
		ranking = {
			userId,
			elo: DEFAULT_ELO,
			wins: 0,
			losses: 0,
			draws: 0,
			winStreak: 0,
			bestWinStreak: 0,
			rank: getRankFromElo(DEFAULT_ELO),
			division: 1,
			lastBattleTime: Date.now(),
			seasonWins: 0,
			seasonLosses: 0,
			seasonDraws: 0,
			totalBattles: 0,
			averagePackValue: 0,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};
		
		await PlayerRankings.insertOne(ranking);
	}
	
	return ranking;
}

/**
 * Update player ranking after a battle
 */
export async function updatePlayerRanking(
	userId: string,
	eloChange: number,
	result: 'win' | 'loss' | 'draw',
	packValue: number
): Promise<PlayerRanking> {
	const ranking = await getPlayerRanking(userId);
	
	// Update ELO
	ranking.elo = Math.max(0, ranking.elo + eloChange);
	ranking.rank = getRankFromElo(ranking.elo);
	ranking.division = getDivisionFromElo(ranking.elo, ranking.rank);
	
	// Update battle statistics
	ranking.totalBattles++;
	ranking.lastBattleTime = Date.now();
	ranking.updatedAt = Date.now();
	
	// Update average pack value
	const totalPackValue = ranking.averagePackValue * (ranking.totalBattles - 1) + packValue;
	ranking.averagePackValue = Math.round(totalPackValue / ranking.totalBattles);
	
	// Update win/loss statistics
	if (result === 'win') {
		ranking.wins++;
		ranking.seasonWins = (ranking.seasonWins || 0) + 1;
		ranking.winStreak++;
		ranking.bestWinStreak = Math.max(ranking.bestWinStreak, ranking.winStreak);
	} else if (result === 'loss') {
		ranking.losses++;
		ranking.seasonLosses = (ranking.seasonLosses || 0) + 1;
		ranking.winStreak = 0;
	} else {
		ranking.draws++;
		ranking.seasonDraws = (ranking.seasonDraws || 0) + 1;
		ranking.winStreak = 0;
	}
	
	await PlayerRankings.upsert({ userId }, ranking);
	return ranking;
}

/**
 * Process battle result and update both players
 */
export async function processBattleResult(
	player1Id: string,
	player2Id: string,
	player1PackValue: number,
	player2PackValue: number,
	wager: number,
	setId: string
): Promise<{
	player1Ranking: PlayerRanking;
	player2Ranking: PlayerRanking;
	battleHistory: BattleHistory;
}> {
	const [player1Ranking, player2Ranking] = await Promise.all([
		getPlayerRanking(player1Id),
		getPlayerRanking(player2Id),
	]);
	
	// Determine battle result
	let winner: string | null = null;
	let player1Result: 'win' | 'loss' | 'draw';
	let player2Result: 'win' | 'loss' | 'draw';
	let resultScore1: number;
	let resultScore2: number;
	
	if (player1PackValue > player2PackValue) {
		winner = player1Id;
		player1Result = 'win';
		player2Result = 'loss';
		resultScore1 = 1;
		resultScore2 = 0;
	} else if (player2PackValue > player1PackValue) {
		winner = player2Id;
		player1Result = 'loss';
		player2Result = 'win';
		resultScore1 = 0;
		resultScore2 = 1;
	} else {
		winner = null;
		player1Result = 'draw';
		player2Result = 'draw';
		resultScore1 = 0.5;
		resultScore2 = 0.5;
	}
	
	// Calculate ELO changes
	const player1EloChange = calculateEloChange(player1Ranking.elo, player2Ranking.elo, resultScore1);
	const player2EloChange = calculateEloChange(player2Ranking.elo, player1Ranking.elo, resultScore2);
	
	// Update rankings
	const [updatedPlayer1, updatedPlayer2] = await Promise.all([
		updatePlayerRanking(player1Id, player1EloChange, player1Result, player1PackValue),
		updatePlayerRanking(player2Id, player2EloChange, player2Result, player2PackValue),
	]);
	
	// Create battle history record
	const battleHistory: BattleHistory = {
		battleId: `${player1Id}_vs_${player2Id}_${Date.now()}`,
		player1: player1Id,
		player2: player2Id,
		player1Elo: player1Ranking.elo,
		player2Elo: player2Ranking.elo,
		player1EloChange,
		player2EloChange,
		winner,
		player1PackValue,
		player2PackValue,
		wager,
		battleTime: Date.now(),
		setId,
	};
	
	await BattleHistories.insertOne(battleHistory);
	
	return {
		player1Ranking: updatedPlayer1,
		player2Ranking: updatedPlayer2,
		battleHistory,
	};
}

// ==================== DAILY CHALLENGE FUNCTIONS ====================

/**
 * Get or create daily challenge data for a user
 */
export async function getDailyChallenges(userId: string): Promise<DailyChallenge> {
	const now = Date.now();
	const todayStart = new Date().setHours(0, 0, 0, 0);
	
	let dailyChallenge = await DailyChallenges.findOne({ userId });
	
	if (!dailyChallenge) {
		dailyChallenge = {
			userId,
			challengesRemaining: DAILY_CHALLENGES_LIMIT,
			lastReset: todayStart,
			challengeHistory: [],
		};
		await DailyChallenges.insertOne(dailyChallenge);
	} else if (dailyChallenge.lastReset < todayStart) {
		// Reset daily challenges
		dailyChallenge.challengesRemaining = DAILY_CHALLENGES_LIMIT;
		dailyChallenge.lastReset = todayStart;
		dailyChallenge.challengeHistory = [];
		await DailyChallenges.upsert({ userId }, dailyChallenge);
	}
	
	return dailyChallenge;
}

/**
 * Get available targets for challenges (top players in leaderboard)
 */
export async function getAvailableChallengeTargets(challengerId: string): Promise<PlayerRanking[]> {
	const dailyChallenge = await getDailyChallenges(challengerId);
	const challengedToday = new Set(dailyChallenge.challengeHistory.map(h => h.targetUserId));
	
	// Get ALL players excluding the challenger and those already challenged today
	// No battle requirement - anyone can be challenged
	const allPlayers = await PlayerRankings.findSorted(
		{
			userId: { $ne: challengerId }
		},
		{ elo: -1 },
		LEADERBOARD_CHALLENGE_RANGE
	);
	
	// If no existing players, create a dummy ranking for the challenger to get started
	if (allPlayers.length === 0) {
		await getPlayerRanking(challengerId); // This creates their ranking
		return []; // No one else to challenge yet
	}
	
	return allPlayers.filter(player => !challengedToday.has(player.userId));
}

/**
 * Simulate a pack opening for battle
 */
async function simulatePackOpening(setId: string): Promise<{ pack: any[], totalValue: number }> {
	// Get available cards from the set
	const setCards = await TCGCards.find({ set: setId });
	if (setCards.length === 0) {
		throw new Error(`No cards found for set ${setId}`);
	}
	
	// Simulate pack opening with weighted rarities
	const pack = [];
	let totalValue = 0;
	
	// Simplified pack generation
	const commons = setCards.filter((c: any) => c.rarity === 'Common');
	const uncommons = setCards.filter((c: any) => c.rarity === 'Uncommon');
	const rares = setCards.filter((c: any) => c.rarity.includes('Rare'));
	
	const allCards = [...commons, ...uncommons, ...rares];
	
	// Generate 10 random cards
	for (let i = 0; i < 10; i++) {
		const randomCard = allCards[Math.floor(Math.random() * allCards.length)];
		pack.push(randomCard);
		
		// Calculate points
		const points = getCardPointsFromRarity(randomCard.rarity);
		totalValue += points;
	}
	
	return { pack, totalValue };
}

/**
 * Execute a simulated challenge battle
 */
export async function executeSimulatedChallenge(
	challengerId: string,
	targetId: string
): Promise<{
	success: boolean;
	error?: string;
	battle?: SimulatedBattle;
	challengerRanking?: PlayerRanking;
	targetRanking?: PlayerRanking;
}> {
	try {
		// Check if challenger has challenges remaining
		const dailyChallenge = await getDailyChallenges(challengerId);
		if (dailyChallenge.challengesRemaining <= 0) {
			return { success: false, error: "No challenges remaining today." };
		}
		
		// Check if target was already challenged today
		const alreadyChallenged = dailyChallenge.challengeHistory.some(h => h.targetUserId === targetId);
		if (alreadyChallenged) {
			return { success: false, error: "You have already challenged this player today." };
		}
		
		// Ensure both players have ranking records (this creates them if they don't exist)
		await Promise.all([
			getPlayerRanking(challengerId),
			getPlayerRanking(targetId)
		]);
		
		// Get available sets
		const availableSets = await TCGCards.distinct('set');
		if (availableSets.length === 0) {
			return { success: false, error: "No sets available for battles." };
		}
		const randomSetId = availableSets[Math.floor(Math.random() * availableSets.length)];
		
		// Simulate both players' pack openings
		const [challengerResult, targetResult] = await Promise.all([
			simulatePackOpening(randomSetId),
			simulatePackOpening(randomSetId)
		]);
		
		// Process the battle result (no wager)
		const battleResult = await processBattleResult(
			challengerId,
			targetId,
			challengerResult.totalValue,
			targetResult.totalValue,
			0, // No wager
			randomSetId
		);
		
		// Create simulated battle record
		const simulatedBattle: SimulatedBattle = {
			battleId: battleResult.battleHistory.battleId,
			challengerId,
			targetId,
			challengerPackValue: challengerResult.totalValue,
			targetPackValue: targetResult.totalValue,
			winner: battleResult.battleHistory.winner,
			challengerEloChange: battleResult.battleHistory.player1EloChange,
			targetEloChange: battleResult.battleHistory.player2EloChange,
			wager: 0, // No wager
			setId: randomSetId,
			timestamp: Date.now(),
			isSimulated: true,
		};
		
		await SimulatedBattles.insertOne(simulatedBattle);
		
		// Update daily challenge data
		dailyChallenge.challengesRemaining--;
		dailyChallenge.challengeHistory.push({
			targetUserId: targetId,
			battleId: simulatedBattle.battleId,
			timestamp: Date.now(),
		});
		await DailyChallenges.upsert({ userId: challengerId }, dailyChallenge);
		
		return {
			success: true,
			battle: simulatedBattle,
			challengerRanking: battleResult.player1Ranking,
			targetRanking: battleResult.player2Ranking,
		};
		
	} catch (error: any) {
		return { success: false, error: error.message };
	}
}


/**
 * Get daily challenge status for display
 */
export async function getDailyChallengeStatus(userId: string): Promise<{
	challengesRemaining: number;
	challengesUsed: number;
	nextReset: number;
	recentChallenges: { targetUserId: string; timestamp: number }[];
}> {
	const dailyChallenge = await getDailyChallenges(userId);
	const tomorrow = new Date();
	tomorrow.setDate(tomorrow.getDate() + 1);
	tomorrow.setHours(0, 0, 0, 0);
	
	return {
		challengesRemaining: dailyChallenge.challengesRemaining,
		challengesUsed: DAILY_CHALLENGES_LIMIT - dailyChallenge.challengesRemaining,
		nextReset: tomorrow.getTime(),
		recentChallenges: dailyChallenge.challengeHistory.slice(-5),
	};
}

// ==================== LEADERBOARD FUNCTIONS ====================

/**
 * Get top players by ELO
 */
export async function getLeaderboard(limit: number = 10): Promise<PlayerRanking[]> {
	return PlayerRankings.findSorted({}, { elo: -1 }, limit);
}

/**
 * Get player's rank position
 */
export async function getPlayerRankPosition(userId: string): Promise<number> {
	const playerRanking = await getPlayerRanking(userId);
	const higherRankedCount = await PlayerRankings.count({ elo: { $gt: playerRanking.elo } });
	return higherRankedCount + 1;
}

/**
 * Get players in same rank tier
 */
export async function getPlayersInRank(rank: string): Promise<PlayerRanking[]> {
	const threshold = RANK_THRESHOLDS[rank as keyof typeof RANK_THRESHOLDS];
	const ranks = Object.entries(RANK_THRESHOLDS);
	const currentIndex = ranks.findIndex(([r]) => r === rank);
	
	let maxThreshold = Number.MAX_SAFE_INTEGER;
	if (currentIndex < ranks.length - 1) {
		maxThreshold = ranks[currentIndex + 1][1];
	}
	
	return PlayerRankings.find({
		elo: { $gte: threshold, $lt: maxThreshold }
	});
}

/**
 * Get seasonal leaderboard
 */
export async function getSeasonalLeaderboard(limit: number = 10): Promise<PlayerRanking[]> {
	return PlayerRankings.findSorted(
		{ seasonWins: { $gt: 0 } },
		{ seasonWins: -1, elo: -1 },
		limit
	);
}

// ==================== BATTLE HISTORY FUNCTIONS ====================

/**
 * Get battle history for a player
 */
export async function getPlayerBattleHistory(userId: string, limit: number = 10): Promise<BattleHistory[]> {
	return BattleHistories.findSorted(
		{ $or: [{ player1: userId }, { player2: userId }] },
		{ battleTime: -1 },
		limit
	);
}

/**
 * Get recent battles across all players
 */
export async function getRecentBattles(limit: number = 20): Promise<BattleHistory[]> {
	return BattleHistories.findSorted({}, { battleTime: -1 }, limit);
}

/**
 * Get recent simulated battles for a user
 */
export async function getSimulatedBattleHistory(userId: string, limit: number = 10): Promise<SimulatedBattle[]> {
	return SimulatedBattles.findSorted(
		{ $or: [{ challengerId: userId }, { targetId: userId }] },
		{ timestamp: -1 },
		limit
	);
}

// ==================== AUTOMATIC SEASON MANAGEMENT ====================

/**
 * Initialize the first season if none exists
 */
export async function initializeSeasonSystem(): Promise<void> {
	const existingSeason = await getCurrentSeason();
	if (!existingSeason) {
		await createNewSeason();
	}
}

/**
 * Create a new season automatically
 */
async function createNewSeason(): Promise<RankingSeason> {
	const now = Date.now();
	const seasonNumber = await RankingSeasons.count({}) + 1;
	
	const season: RankingSeason = {
		seasonId: `season_${seasonNumber}_${now}`,
		name: `Season ${seasonNumber}`,
		startTime: now,
		endTime: now + (SEASON_DURATION_DAYS * 24 * 60 * 60 * 1000),
		isActive: true,
		isCompleted: false,
		rewardsDistributed: false,
	};
	
	await RankingSeasons.insertOne(season);
	
	// Reset seasonal stats for all players
	await PlayerRankings.updateMany(
		{},
		{
			$set: {
				seasonWins: 0,
				seasonLosses: 0,
				seasonDraws: 0,
				updatedAt: Date.now()
			}
		}
	);
	
	console.log(`Started new season: ${season.name}`);
	return season;
}

/**
 * Check and process season end automatically
 */
export async function checkAndProcessSeasonEnd(): Promise<boolean> {
	const currentSeason = await getCurrentSeason();
	if (!currentSeason) return false;
	
	const now = Date.now();
	if (now >= currentSeason.endTime && !currentSeason.isCompleted) {
		await endCurrentSeason();
		return true;
	}
	
	return false;
}

/**
 * End the current season and distribute rewards
 */
async function endCurrentSeason(): Promise<void> {
	const currentSeason = await getCurrentSeason();
	if (!currentSeason) return;
	
	console.log(`Ending season: ${currentSeason.name}`);
	
	// Get final seasonal leaderboard
	const finalLeaderboard = await getSeasonalLeaderboard(100); // Get top 100 for records
	
	// Prepare final leaderboard data
	const finalLeaderboardData = finalLeaderboard.map((player, index) => ({
		userId: player.userId,
		rank: index + 1,
		elo: player.elo,
		seasonWins: player.seasonWins || 0,
		seasonLosses: player.seasonLosses || 0,
		seasonDraws: player.seasonDraws || 0,
		creditsAwarded: 0,
		titleAwarded: undefined as string | undefined,
	}));
	
	// Distribute rewards to top 10
	const rewardPromises = [];
	for (let i = 0; i < Math.min(10, finalLeaderboardData.length); i++) {
		const player = finalLeaderboardData[i];
		const rank = i + 1;
		const reward = SEASON_REWARDS[rank as keyof typeof SEASON_REWARDS];
		
		if (reward) {
			player.creditsAwarded = reward.credits;
			player.titleAwarded = reward.title;
			
			// Award credits
			rewardPromises.push(
				TCG_Economy.grantCurrency(player.userId, reward.credits)
			);
			
			// Record the reward
			const seasonReward: SeasonReward = {
				userId: player.userId,
				seasonId: currentSeason.seasonId,
				rank,
				credits: reward.credits,
				title: reward.title,
				claimedAt: Date.now(),
			};
			rewardPromises.push(SeasonRewards.insertOne(seasonReward));
		}
	}
	
	await Promise.all(rewardPromises);
	
	// Mark season as completed
	await RankingSeasons.updateOne(
		{ seasonId: currentSeason.seasonId },
		{
			$set: {
				isActive: false,
				isCompleted: true,
				rewardsDistributed: true,
				finalLeaderboard: finalLeaderboardData,
				endTime: Date.now(), // Update actual end time
			}
		}
	);
	
	console.log(`Season ${currentSeason.name} completed. Rewards distributed to top 10 players.`);
	
	// Start new season
	await createNewSeason();
}

/**
 * Get current active season
 */
export async function getCurrentSeason(): Promise<RankingSeason | null> {
	return RankingSeasons.findOne({ isActive: true });
}

/**
 * Get season rewards for a user
 */
export async function getUserSeasonRewards(userId: string): Promise<SeasonReward[]> {
	return SeasonRewards.findSorted({ userId }, { claimedAt: -1 }, 10);
}

/**
 * Get current season info with time remaining
 */
export async function getCurrentSeasonInfo(): Promise<{
	season: RankingSeason | null;
	timeRemaining: number;
	daysRemaining: number;
	hoursRemaining: number;
} | null> {
	const season = await getCurrentSeason();
	if (!season) return null;
	
	const now = Date.now();
	const timeRemaining = Math.max(0, season.endTime - now);
	const daysRemaining = Math.floor(timeRemaining / (24 * 60 * 60 * 1000));
	const hoursRemaining = Math.floor((timeRemaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
	
	return {
		season,
		timeRemaining,
		daysRemaining,
		hoursRemaining,
	};
}

/**
 * Force end current season (admin command)
 */
export async function forceEndSeason(): Promise<boolean> {
	const currentSeason = await getCurrentSeason();
	if (!currentSeason) return false;
	
	await endCurrentSeason();
	return true;
}

/**
 * Get completed seasons with their final leaderboards
 */
export async function getCompletedSeasons(limit: number = 5): Promise<RankingSeason[]> {
	return RankingSeasons.findSorted(
		{ isCompleted: true },
		{ endTime: -1 },
		limit
	);
}

/**
 * Run season maintenance (should be called periodically)
 */
export async function runSeasonMaintenance(): Promise<void> {
	try {
		// Initialize season system if needed
		await initializeSeasonSystem();
		
		// Check if season should end
		const seasonEnded = await checkAndProcessSeasonEnd();
		
		if (seasonEnded) {
			console.log('Season maintenance: Season ended and new season started');
		}
	} catch (error) {
		console.error('Error in season maintenance:', error);
	}
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Get rank color for display
 */
export function getRankColor(rank: string): string {
	return RANK_COLORS[rank as keyof typeof RANK_COLORS] || '#808080';
}

/**
 * Format ELO change for display
 */
export function formatEloChange(change: number): string {
	return change > 0 ? `+${change}` : `${change}`;
}

/**
 * Get win rate percentage
 */
export function getWinRate(wins: number, losses: number, draws: number): number {
	const total = wins + losses + draws;
	if (total === 0) return 0;
	return Math.round((wins / total) * 100);
}

/**
 * Check if player is eligible for ranked battles
 */
export async function isEligibleForRanked(userId: string): Promise<boolean> {
	// Everyone is eligible - no minimum battle requirement
	await getPlayerRanking(userId); // Ensure they have a ranking record
	return true;
}

/**
 * Get appropriate opponent ELO range
 */
export function getOpponentEloRange(playerElo: number): { min: number; max: number } {
	const range = Math.max(100, Math.min(300, playerElo * 0.15));
	return {
		min: Math.max(0, playerElo - range),
		max: playerElo + range
	};
}
