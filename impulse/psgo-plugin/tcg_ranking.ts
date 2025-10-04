/**
 * TCG Ranking System
 * Handles ELO rating calculations and competitive battle rankings.
 */

import { 
	PlayerRanking,
	BattleHistory,
	RankingSeason,
	DailyChallenge,
	SimulatedBattle,
	SeasonReward,
	WeeklyMilestones
} from './tcg_data';
import { 
	TCGCards,
	PlayerRankings,
	BattleHistories,
	RankingSeasons,
	DailyChallenges,
	SimulatedBattles,
	SeasonRewards,
	WeeklyMilestonesCollection
} from './tcg_collections';
import * as TCG_Economy from './tcg_economy';
import { getCardPoints } from '../../impulse/psgo-plugin/tcg_commands/shared';
import {
	RANKING_CONFIG,
	RANK_THRESHOLDS,
	RANK_COLORS,
	RANKED_BATTLE_REWARDS,
	SEASON_REWARDS,
	ELO_MILESTONE_REWARDS,
	WEEKLY_MILESTONES,
} from './tcg_config';

// Re-export constants for backward compatibility
export { RANK_THRESHOLDS, RANK_COLORS, SEASON_REWARDS };

// ==================== CORE FUNCTIONS ====================

/**
 * Calculate ELO change based on battle result
 */
function calculateEloChange(playerElo: number, opponentElo: number, result: number): number {
	const expectedScore = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
	return Math.round(RANKING_CONFIG.K_FACTOR * (result - expectedScore));
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
 * Calculate battle credit reward with diminishing returns
 */
function calculateBattleReward(battlesCompletedToday: number, baseReward: number): number {
	if (battlesCompletedToday < RANKING_CONFIG.DAILY_CREDIT_BATTLES_LIMIT) {
		return baseReward; // Full reward for first 7 battles
	} else {
		return Math.floor(baseReward * RANKING_CONFIG.REDUCED_REWARD_MULTIPLIER); // 30% reward for battles 8-10
	}
}

// ==================== ELO MILESTONE FUNCTIONS ====================

/**
 * Check and award ELO milestone rewards
 */
export async function checkEloMilestones(userId: string, newElo: number): Promise<{
	milestonesClaimed: { name: string; reward: number }[];
	totalCredits: number;
}> {
	const ranking = await getPlayerRanking(userId);
	const claimedMilestones = ranking.claimedEloMilestones || [];
	const newMilestones = [];
	let totalCredits = 0;
	
	console.log(`Checking ELO milestones for ${userId}: ELO ${newElo}, Already claimed: [${claimedMilestones.join(', ')}]`);
	
	for (const [milestoneId, milestone] of Object.entries(ELO_MILESTONE_REWARDS)) {
		if (newElo >= milestone.elo && !claimedMilestones.includes(milestoneId)) {
			console.log(`Awarding milestone ${milestoneId} (${milestone.name}) to ${userId}: ${milestone.reward} credits`);
			
			// Award the milestone
			await TCG_Economy.grantCurrency(userId, milestone.reward);
			claimedMilestones.push(milestoneId);
			newMilestones.push({ name: milestone.name, reward: milestone.reward });
			totalCredits += milestone.reward;
		}
	}
	
	// Update claimed milestones
	if (newMilestones.length > 0) {
		await PlayerRankings.updateOne(
			{ userId },
			{ $set: { claimedEloMilestones: claimedMilestones } }
		);
		console.log(`Updated claimed milestones for ${userId}: [${claimedMilestones.join(', ')}]`);
	}
	
	return {
		milestonesClaimed: newMilestones,
		totalCredits,
	};
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
			elo: RANKING_CONFIG.DEFAULT_ELO,
			wins: 0,
			losses: 0,
			draws: 0,
			winStreak: 0,
			bestWinStreak: 0,
			rank: getRankFromElo(RANKING_CONFIG.DEFAULT_ELO),
			division: 1,
			lastBattleTime: Date.now(),
			seasonWins: 0,
			seasonLosses: 0,
			seasonDraws: 0,
			totalBattles: 0,
			averagePackValue: 0,
			createdAt: Date.now(),
			updatedAt: Date.now(),
			claimedEloMilestones: [],
		};
		
		await PlayerRankings.insertOne(ranking);
	}
	
	// Ensure existing records have the field
	if (!ranking.claimedEloMilestones) {
		ranking.claimedEloMilestones = [];
		await PlayerRankings.updateOne(
			{ userId },
			{ $set: { claimedEloMilestones: [] } }
		);
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
): Promise<{
	ranking: PlayerRanking;
	eloMilestones: { name: string; reward: number }[];
	milestoneCredits: number;
}> {
	const ranking = await getPlayerRanking(userId);
	
	// Update ELO
	const oldElo = ranking.elo;
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
	
	// Save the ranking first before checking milestones
	await PlayerRankings.updateOne(
		{ userId },
		{ $set: ranking },
		{ upsert: true }
	);
	
	// Check for ELO milestones (only if ELO increased)
	let eloMilestones = [];
	let milestoneCredits = 0;
	if (ranking.elo > oldElo) {
		const milestoneResult = await checkEloMilestones(userId, ranking.elo);
		eloMilestones = milestoneResult.milestonesClaimed;
		milestoneCredits = milestoneResult.totalCredits;
	}
	
	return {
		ranking,
		eloMilestones,
		milestoneCredits,
	};
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
	player1EloMilestones: { name: string; reward: number }[];
	player2EloMilestones: { name: string; reward: number }[];
	player1MilestoneCredits: number;
	player2MilestoneCredits: number;
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
	
	// Update rankings with milestone checking
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
		player1Ranking: updatedPlayer1.ranking,
		player2Ranking: updatedPlayer2.ranking,
		battleHistory,
		player1EloMilestones: updatedPlayer1.eloMilestones,
		player2EloMilestones: updatedPlayer2.eloMilestones,
		player1MilestoneCredits: updatedPlayer1.milestoneCredits,
		player2MilestoneCredits: updatedPlayer2.milestoneCredits,
	};
}

// ==================== WEEKLY MILESTONE FUNCTIONS ====================

/**
 * Get the start of the current week (Monday 00:00 UTC)
 */
function getWeekStart(timestamp: number): number {
	const date = new Date(timestamp);
	const dayOfWeek = date.getUTCDay();
	const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
	
	const monday = new Date(date);
	monday.setUTCDate(date.getUTCDate() - daysToMonday);
	monday.setUTCHours(0, 0, 0, 0);
	
	return monday.getTime();
}

/**
 * Get or create weekly milestone data for a user
 */
export async function getWeeklyMilestones(userId: string): Promise<WeeklyMilestones> {
	const now = Date.now();
	const weekStart = getWeekStart(now);
	
	let milestones = await WeeklyMilestonesCollection.findOne({ userId });
	
	if (!milestones || milestones.weekStartTime < weekStart) {
		// Create new week or reset for new week
		milestones = {
			userId,
			weekStartTime: weekStart,
			lastReset: now,
			rankedBattles: 0,
			rankedWins: 0,
			packsPurchased: 0,
			packsOpened: 0,
			creditsEarned: 0,
			claimedMilestones: [],
			totalMilestoneCredits: 0,
		};
		await WeeklyMilestonesCollection.updateOne(
			{ userId },
			{ $set: milestones },
			{ upsert: true }
		);
	}
	
	return milestones;
}

/**
 * Update milestone progress
 */
export async function updateMilestoneProgress(
	userId: string,
	type: 'rankedBattles' | 'rankedWins' | 'packsPurchased' | 'packsOpened' | 'creditsEarned',
	amount: number = 1
): Promise<void> {
	const milestones = await getWeeklyMilestones(userId);
	
	// Update progress
	milestones[type] += amount;
	
	// Save progress
	await WeeklyMilestonesCollection.updateOne(
		{ userId },
		{ $set: milestones },
		{ upsert: true }
	);
}

/**
 * Get available milestones to claim
 */
export async function getAvailableMilestones(userId: string): Promise<{
	milestoneId: string;
	name: string;
	description: string;
	reward: number;
	progress: number;
	requirement: number;
	canClaim: boolean;
	alreadyClaimed: boolean;
}[]> {
	const milestones = await getWeeklyMilestones(userId);
	const available = [];
	
	for (const [milestoneId, milestone] of Object.entries(WEEKLY_MILESTONES)) {
		const progress = milestones[milestone.type];
		const alreadyClaimed = milestones.claimedMilestones.includes(milestoneId);
		const canClaim = progress >= milestone.requirement && !alreadyClaimed;
		
		available.push({
			milestoneId,
			name: milestone.name,
			description: milestone.description,
			reward: milestone.reward,
			progress,
			requirement: milestone.requirement,
			canClaim,
			alreadyClaimed,
		});
	}
	
	return available.sort((a, b) => {
		if (a.canClaim !== b.canClaim) return a.canClaim ? -1 : 1;
		return b.reward - a.reward;
	});
}		

/**
 * Claim a milestone reward
 */
export async function claimMilestone(userId: string, milestoneId: string): Promise<{
	success: boolean;
	error?: string;
	reward?: number;
	milestoneName?: string;
}> {
	const milestones = await getWeeklyMilestones(userId);
	const milestone = WEEKLY_MILESTONES[milestoneId as keyof typeof WEEKLY_MILESTONES];
	
	if (!milestone) {
		return { success: false, error: "Invalid milestone ID." };
	}
	
	if (milestones.claimedMilestones.includes(milestoneId)) {
		return { success: false, error: "Milestone already claimed." };
	}
	
	const progress = milestones[milestone.type];
	if (progress < milestone.requirement) {
		return { success: false, error: `Not enough progress. Need ${milestone.requirement}, have ${progress}.` };
	}
	
	// Mark as claimed and award credits
	milestones.claimedMilestones.push(milestoneId);
	milestones.totalMilestoneCredits += milestone.reward;
	
	await Promise.all([
		WeeklyMilestonesCollection.updateOne(
			{ userId },
			{ $set: milestones },
			{ upsert: true }
		),
		TCG_Economy.grantCurrency(userId, milestone.reward)
	]);
	
	return {
		success: true,
		reward: milestone.reward,
		milestoneName: milestone.name,
	};
}

/**
 * Get weekly milestone summary for a user
 */
export async function getWeeklyMilestoneSummary(userId: string): Promise<{
	weekNumber: number;
	daysRemaining: number;
	totalCreditsEarned: number;
	milestonesCompleted: number;
	totalMilestones: number;
}> {
	const milestones = await getWeeklyMilestones(userId);
	const now = Date.now();
	const weekEnd = milestones.weekStartTime + (7 * 24 * 60 * 60 * 1000);
	const daysRemaining = Math.ceil((weekEnd - now) / (24 * 60 * 60 * 1000));
	
	const weekNumber = Math.floor((now - new Date('2025-01-01').getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
	
	return {
		weekNumber,
		daysRemaining: Math.max(0, daysRemaining),
		totalCreditsEarned: milestones.totalMilestoneCredits,
		milestonesCompleted: milestones.claimedMilestones.length,
		totalMilestones: Object.keys(WEEKLY_MILESTONES).length,
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
			challengesRemaining: RANKING_CONFIG.DAILY_CHALLENGES_LIMIT,
			lastReset: todayStart,
			challengeHistory: [],
			totalCreditsEarnedToday: 0,
		};
		await DailyChallenges.insertOne(dailyChallenge);
	} else if (dailyChallenge.lastReset < todayStart) {
		// Reset daily challenges
		dailyChallenge.challengesRemaining = RANKING_CONFIG.DAILY_CHALLENGES_LIMIT;
		dailyChallenge.lastReset = todayStart;
		dailyChallenge.challengeHistory = [];
		dailyChallenge.totalCreditsEarnedToday = 0;
		await DailyChallenges.updateOne(
			{ userId },
			{ $set: dailyChallenge },
			{ upsert: true }
		);
	}
	
	return dailyChallenge;
}

/**
 * Get available targets for challenges
 */
export async function getAvailableChallengeTargets(challengerId: string): Promise<PlayerRanking[]> {
	const dailyChallenge = await getDailyChallenges(challengerId);
	const challengedToday = new Set(dailyChallenge.challengeHistory.map(h => h.targetUserId));
	
	const allPlayers = await PlayerRankings.find(
		{ userId: { $ne: challengerId } },
		{ sort: { elo: -1 }, limit: RANKING_CONFIG.LEADERBOARD_CHALLENGE_RANGE }
	).toArray();  // ← FIXED
	
	if (allPlayers.length === 0) {
		await getPlayerRanking(challengerId);
		return [];
	}
	
	return allPlayers.filter(player => !challengedToday.has(player.userId));
}

/**
 * Simulate a pack opening for battle with comprehensive point calculation
 */
async function simulatePackOpening(setId: string): Promise<{ pack: any[], totalValue: number }> {
	const setCards = await TCGCards.find({ set: setId }).toArray();  // ← FIXED
	if (setCards.length === 0) {
		throw new Error(`No cards found for set ${setId}`);
	}
	
	const pack = [];
	let totalValue = 0;
	
	const commons = setCards.filter((c: any) => c.rarity === 'Common');
	const uncommons = setCards.filter((c: any) => c.rarity === 'Uncommon');
	const rares = setCards.filter((c: any) => c.rarity && c.rarity.includes('Rare'));
	
	const allCards = [...commons, ...uncommons, ...rares];
	
	if (allCards.length === 0) {
		throw new Error(`No valid cards found for set ${setId}`);
	}
	
	// Generate 10 random cards
	for (let i = 0; i < 10; i++) {
		const randomCard = allCards[Math.floor(Math.random() * allCards.length)];
		if (randomCard) {
			pack.push(randomCard);
			// Use comprehensive point calculation including battle value, HP, subtypes, evolution stage
			const points = getCardPoints(randomCard);
			totalValue += points;
		}
	}
	
	// Add variance to reduce draws: ±15% random modifier
	const variance = (Math.random() - 0.5) * 0.3;
	totalValue = Math.round(totalValue * (1 + variance));
	
	// Ensure minimum value
	totalValue = Math.max(totalValue, 50);
	
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
	challengerPack?: any[];
	targetPack?: any[];
	challengerCredits?: number;
	targetCredits?: number;
	player1EloMilestones?: { name: string; reward: number }[];
	player2EloMilestones?: { name: string; reward: number }[];
}> {
	try {
		const dailyChallenge = await getDailyChallenges(challengerId);
		if (dailyChallenge.challengesRemaining <= 0) {
			return { success: false, error: "No challenges remaining today." };
		}
		
		const alreadyChallenged = dailyChallenge.challengeHistory.some(h => h.targetUserId === targetId);
		if (alreadyChallenged) {
			return { success: false, error: "You have already challenged this player today." };
		}
		
		const [challengerRanking, targetRanking] = await Promise.all([
			getPlayerRanking(challengerId),
			getPlayerRanking(targetId)
		]);
		
		const availableSets = await TCGCards.distinct('set');
		if (availableSets.length === 0) {
			return { success: false, error: "No sets available for battles." };
		}
		const randomSetId = availableSets[Math.floor(Math.random() * availableSets.length)];
		
		const [challengerResult, targetResult] = await Promise.all([
			simulatePackOpening(randomSetId),
			simulatePackOpening(randomSetId)
		]);
		
		// Determine battle result
		let winner: string | null = null;
		let challengerResult_battle: 'win' | 'loss' | 'draw';
		let targetResult_battle: 'win' | 'loss' | 'draw';
		let resultScore1: number;
		let resultScore2: number;
		
		if (challengerResult.totalValue > targetResult.totalValue) {
			winner = challengerId;
			challengerResult_battle = 'win';
			targetResult_battle = 'loss';
			resultScore1 = 1;
			resultScore2 = 0;
		} else if (targetResult.totalValue > challengerResult.totalValue) {
			winner = targetId;
			challengerResult_battle = 'loss';
			targetResult_battle = 'win';
			resultScore1 = 0;
			resultScore2 = 1;
		} else {
			winner = null;
			challengerResult_battle = 'draw';
			targetResult_battle = 'draw';
			resultScore1 = 0.5;
			resultScore2 = 0.5;
		}
		
		const challengerEloChange = calculateEloChange(challengerRanking.elo, targetRanking.elo, resultScore1);
		const targetEloChange = calculateEloChange(targetRanking.elo, challengerRanking.elo, resultScore2);
		
		const [updatedChallenger, updatedTarget] = await Promise.all([
			updatePlayerRanking(challengerId, challengerEloChange, challengerResult_battle, challengerResult.totalValue),
			updatePlayerRanking(targetId, targetEloChange, targetResult_battle, targetResult.totalValue)
		]);
		
		const simulatedBattle: SimulatedBattle = {
			battleId: `${challengerId}_vs_${targetId}_${Date.now()}`,
			challengerId,
			targetId,
			challengerPackValue: challengerResult.totalValue,
			targetPackValue: targetResult.totalValue,
			winner,
			challengerEloChange,
			targetEloChange,
			wager: 0,
			setId: randomSetId,
			timestamp: Date.now(),
			isSimulated: true,
		};
		
		await SimulatedBattles.insertOne(simulatedBattle);
		
		// Calculate credit rewards
		const targetDailyChallenge = await getDailyChallenges(targetId);
		const challengerBattlesToday = dailyChallenge.challengeHistory.length;
		const targetBattlesToday = targetDailyChallenge.challengeHistory.length;

		let challengerCredits = 0;
		let targetCredits = 0;

		if (simulatedBattle.winner === challengerId) {
			challengerCredits = calculateBattleReward(challengerBattlesToday, RANKED_BATTLE_REWARDS.win);
			targetCredits = calculateBattleReward(targetBattlesToday, RANKED_BATTLE_REWARDS.loss);
		} else if (simulatedBattle.winner === targetId) {
			challengerCredits = calculateBattleReward(challengerBattlesToday, RANKED_BATTLE_REWARDS.loss);
			targetCredits = calculateBattleReward(targetBattlesToday, RANKED_BATTLE_REWARDS.win);
		} else {
			challengerCredits = calculateBattleReward(challengerBattlesToday, RANKED_BATTLE_REWARDS.draw);
			targetCredits = calculateBattleReward(targetBattlesToday, RANKED_BATTLE_REWARDS.draw);
		}

		await Promise.all([
			TCG_Economy.grantCurrency(challengerId, challengerCredits),
			TCG_Economy.grantCurrency(targetId, targetCredits)
		]);

		await Promise.all([
			updateMilestoneProgress(challengerId, 'rankedBattles', 1),
			updateMilestoneProgress(targetId, 'rankedBattles', 1),
			updateMilestoneProgress(challengerId, 'creditsEarned', challengerCredits),
			updateMilestoneProgress(targetId, 'creditsEarned', targetCredits)
		]);

		if (simulatedBattle.winner === challengerId) {
			await updateMilestoneProgress(challengerId, 'rankedWins', 1);
		} else if (simulatedBattle.winner === targetId) {
			await updateMilestoneProgress(targetId, 'rankedWins', 1);
		}
		
		dailyChallenge.challengesRemaining--;
		dailyChallenge.totalCreditsEarnedToday = (dailyChallenge.totalCreditsEarnedToday || 0) + challengerCredits;
		dailyChallenge.challengeHistory.push({
			targetUserId: targetId,
			battleId: simulatedBattle.battleId,
			timestamp: Date.now(),
			creditsEarned: challengerCredits,
		});
		await DailyChallenges.updateOne(
			{ userId: challengerId },
			{ $set: dailyChallenge },
			{ upsert: true }
		);
		
		return {
			success: true,
			battle: simulatedBattle,
			challengerRanking: updatedChallenger.ranking,
			targetRanking: updatedTarget.ranking,
			challengerPack: challengerResult.pack,
			targetPack: targetResult.pack,
			challengerCredits,
			targetCredits,
			player1EloMilestones: updatedChallenger.eloMilestones,
			player2EloMilestones: updatedTarget.eloMilestones,
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
		challengesUsed: RANKING_CONFIG.DAILY_CHALLENGES_LIMIT - dailyChallenge.challengesRemaining,
		nextReset: tomorrow.getTime(),
		recentChallenges: dailyChallenge.challengeHistory.slice(-5),
	};
}

// ==================== LEADERBOARD FUNCTIONS ====================

/**
 * Get top players by ELO
 */
export async function getLeaderboard(limit: number = 10): Promise<PlayerRanking[]> {
	return PlayerRankings.find({}, { sort: { elo: -1 }, limit }).toArray();  // ← FIXED
}

/**
 * Get player's rank position
 */
export async function getPlayerRankPosition(userId: string): Promise<number> {
	const playerRanking = await getPlayerRanking(userId);
	const higherRankedCount = await PlayerRankings.countDocuments({ elo: { $gt: playerRanking.elo } });
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
	}).toArray();  // ← FIXED
}

/**
 * Get seasonal leaderboard
 */
export async function getSeasonalLeaderboard(limit: number = 10): Promise<PlayerRanking[]> {
	return PlayerRankings.find(
		{ seasonWins: { $gt: 0 } },
		{ sort: { seasonWins: -1, elo: -1 }, limit }
	).toArray();  // ← FIXED
}

// ==================== BATTLE HISTORY FUNCTIONS ====================

/**
 * Get battle history for a player
 */
export async function getPlayerBattleHistory(userId: string, limit: number = 10): Promise<BattleHistory[]> {
	return BattleHistories.find(
		{ $or: [{ player1: userId }, { player2: userId }] },
		{ sort: { battleTime: -1 }, limit }
	).toArray();  // ← FIXED
}

/**
 * Get recent battles across all players
 */
export async function getRecentBattles(limit: number = 20): Promise<BattleHistory[]> {
	return BattleHistories.find({}, { sort: { battleTime: -1 }, limit }).toArray();  // ← FIXED
}

/**
 * Get recent simulated battles for a user
 */
export async function getSimulatedBattleHistory(userId: string, limit: number = 10): Promise<SimulatedBattle[]> {
	return SimulatedBattles.find(
		{ $or: [{ challengerId: userId }, { targetId: userId }] },
		{ sort: { timestamp: -1 }, limit }
	).toArray();  // ← FIXED
}

// ==================== SEASON MANAGEMENT ====================

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
	const seasonNumber = await RankingSeasons.countDocuments({}) + 1;
	
	const season: RankingSeason = {
		seasonId: `season_${seasonNumber}_${now}`,
		name: `Season ${seasonNumber}`,
		startTime: now,
		endTime: now + (RANKING_CONFIG.SEASON_DURATION_DAYS * 24 * 60 * 60 * 1000),
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
	
	const finalLeaderboard = await getSeasonalLeaderboard(100);
	
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
			
			rewardPromises.push(
				TCG_Economy.grantCurrency(player.userId, reward.credits)
			);
			
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
	
	await RankingSeasons.updateOne(
		{ seasonId: currentSeason.seasonId },
		{
			$set: {
				isActive: false,
				isCompleted: true,
				rewardsDistributed: true,
				finalLeaderboard: finalLeaderboardData,
				endTime: Date.now(),
			}
		}
	);
	
	console.log(`Season ${currentSeason.name} completed. Rewards distributed to top 10 players.`);
	
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
	return SeasonRewards.find({ userId }, { sort: { claimedAt: -1 }, limit: 10 }).toArray();  // ← FIXED
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
	return RankingSeasons.find(
		{ isCompleted: true },
		{ sort: { endTime: -1 }, limit }
	).toArray();  // ← FIXED
}

/**
 * Run season maintenance (should be called periodically)
 */
export async function runSeasonMaintenance(): Promise<void> {
	try {
		await initializeSeasonSystem();
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
	await getPlayerRanking(userId);
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
