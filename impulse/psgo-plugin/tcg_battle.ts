/**
 * TCG Battle Module
 * Core battle logic and calculations for PvE campaign system
 */

import { TCGCard } from './tcg_data';

export interface BattleResult {
	winner: 'player' | 'opponent';
	playerScore: number;
	opponentScore: number;
	breakdown: {
		playerCards: { card: TCGCard; score: number }[];
		opponentCards: { card: TCGCard; score: number }[];
	};
	creditsAwarded: number;
	packAwarded: boolean;
}

// Battle Configuration
export const BATTLE_CONFIG = {
	MAX_CARDS_PER_BATTLE: 16,
	CARDS_INCREMENT_EVERY_LEVELS: 5,
	LOCKOUT_HOURS: 24,
	PACK_REWARD_EVERY_LEVELS: 10,
	BASE_CREDITS_REWARD: 20,
	CREDITS_PER_LEVEL: 2,
	BATTLE_CHALLENGE_TIMEOUT_MINUTES: 5,
} as const;

/**
 * Calculate number of cards required for a given level
 */
export function getCardsRequired(level: number): number {
	return Math.min(BATTLE_CONFIG.MAX_CARDS_PER_BATTLE, Math.floor((level + 4) / BATTLE_CONFIG.CARDS_INCREMENT_EVERY_LEVELS));
}

/**
 * Calculate credits reward for completing a level
 */
export function getCreditsReward(level: number): number {
	return BATTLE_CONFIG.BASE_CREDITS_REWARD + (level * BATTLE_CONFIG.CREDITS_PER_LEVEL);
}

/**
 * Check if level completion awards a pack (every 10 levels)
 */
export function shouldAwardPack(level: number): boolean {
	return level % BATTLE_CONFIG.PACK_REWARD_EVERY_LEVELS === 0;
}

/**
 * Calculate difficulty multiplier based on level
 * Higher levels = stronger opponents
 */
export function getDifficultyMultiplier(level: number): number {
	// Base 1.0, increases by 0.05 per level, caps at 3.0
	return Math.min(3.0, 1.0 + (level * 0.05));
}

/**
 * Calculate card battle score
 * Takes into account battleValue, battleStats, HP, and type advantages
 */
export function calculateCardScore(
	card: TCGCard,
	opponentCard: TCGCard,
	isPlayer: boolean = true
): number {
	let score = 0;

	// Base score from battle value (most important)
	if (card.battleValue) {
		score += card.battleValue * 2;
	}

	// Battle stats contribution
	if (card.battleStats) {
		score += card.battleStats.attackPower * 0.5;
		score += card.battleStats.defensePower * 0.3;
		score += card.battleStats.speed * 0.8;
		// Lower energy cost is better
		score += (6 - (card.battleStats.energyCost || 1)) * 5;
	}

	// HP contribution (scaled down)
	if (card.hp) {
		score += card.hp * 0.2;
	}

	// Type advantage/weakness system
	const typeMultiplier = calculateTypeAdvantage(card, opponentCard);
	score *= typeMultiplier;

	// Add small random variance (±5%) for excitement
	const variance = 0.95 + (Math.random() * 0.1);
	score *= variance;

	return Math.round(score);
}

/**
 * Calculate type advantage multiplier
 * Returns 1.5 for advantage, 0.7 for weakness, 1.0 for neutral
 */
function calculateTypeAdvantage(attackerCard: TCGCard, defenderCard: TCGCard): number {
	// Check if attacker's type matches defender's weakness
	if (defenderCard.weaknesses && defenderCard.weaknesses.length > 0 && attackerCard.type) {
		const hasAdvantage = defenderCard.weaknesses.some(w => w.type === attackerCard.type);
		if (hasAdvantage) return 1.5;
	}

	// Check if attacker's type matches defender's resistance
	if (defenderCard.resistances && defenderCard.resistances.length > 0 && attackerCard.type) {
		const hasDisadvantage = defenderCard.resistances.some(r => r.type === attackerCard.type);
		if (hasDisadvantage) return 0.7;
	}

	return 1.0;
}

/**
 * Generate opponent team based on level and available cards pool
 */
export function generateOpponentTeam(
	level: number,
	cardsRequired: number,
	availableCards: TCGCard[]
): TCGCard[] {
	if (availableCards.length === 0) return [];

	const difficultyMultiplier = getDifficultyMultiplier(level);
	const opponentTeam: TCGCard[] = [];

	// Sort cards by battle value
	const sortedCards = [...availableCards].sort((a, b) => {
		const aValue = a.battleValue || 0;
		const bValue = b.battleValue || 0;
		return bValue - aValue;
	});

	// Select cards based on difficulty
	// Higher difficulty = better cards selected
	const poolSize = sortedCards.length;
	const selectionStart = Math.max(0, Math.floor(poolSize * (1 - (difficultyMultiplier / 3))));
	const selectionEnd = Math.min(poolSize, selectionStart + Math.floor(poolSize * 0.4));

	const selectionPool = sortedCards.slice(selectionStart, selectionEnd);

	// Randomly select required number of cards from pool
	for (let i = 0; i < cardsRequired && selectionPool.length > 0; i++) {
		const randomIndex = Math.floor(Math.random() * selectionPool.length);
		opponentTeam.push(selectionPool[randomIndex]);
		selectionPool.splice(randomIndex, 1);
	}

	return opponentTeam;
}

/**
 * Execute battle between player team and opponent team
 */
export function executeBattle(
	playerCards: TCGCard[],
	opponentCards: TCGCard[]
): BattleResult {
	const playerBreakdown: { card: TCGCard; score: number }[] = [];
	const opponentBreakdown: { card: TCGCard; score: number }[] = [];

	let playerTotalScore = 0;
	let opponentTotalScore = 0;

	// Calculate scores for each matchup
	const maxCards = Math.max(playerCards.length, opponentCards.length);

	for (let i = 0; i < maxCards; i++) {
		const playerCard = playerCards[i];
		const opponentCard = opponentCards[i];

		if (playerCard && opponentCard) {
			const playerScore = calculateCardScore(playerCard, opponentCard, true);
			const opponentScore = calculateCardScore(opponentCard, playerCard, false);

			playerBreakdown.push({ card: playerCard, score: playerScore });
			opponentBreakdown.push({ card: opponentCard, score: opponentScore });

			playerTotalScore += playerScore;
			opponentTotalScore += opponentScore;
		} else if (playerCard) {
			// Player has more cards
			const playerScore = calculateCardScore(playerCard, playerCard, true);
			playerBreakdown.push({ card: playerCard, score: playerScore });
			playerTotalScore += playerScore;
		} else if (opponentCard) {
			// Opponent has more cards (shouldn't happen in normal flow)
			const opponentScore = calculateCardScore(opponentCard, opponentCard, false);
			opponentBreakdown.push({ card: opponentCard, score: opponentScore });
			opponentTotalScore += opponentScore;
		}
	}

	const winner = playerTotalScore > opponentTotalScore ? 'player' : 'opponent';

	return {
		winner,
		playerScore: playerTotalScore,
		opponentScore: opponentTotalScore,
		breakdown: {
			playerCards: playerBreakdown,
			opponentCards: opponentBreakdown,
		},
		creditsAwarded: 0, // Will be set by command handler
		packAwarded: false, // Will be set by command handler
	};
}

/**
 * Check if user is locked out from battles
 */
export function isLockedOut(lastDefeatTime?: number): { locked: boolean; timeLeft?: number } {
	if (!lastDefeatTime) return { locked: false };

	const lockoutDuration = BATTLE_CONFIG.LOCKOUT_HOURS * 60 * 60 * 1000;
	const timeLeft = (lastDefeatTime + lockoutDuration) - Date.now();

	if (timeLeft > 0) {
		return { locked: true, timeLeft };
	}

	return { locked: false };
}

/**
 * Format time remaining for lockout
 */
export function formatTimeRemaining(ms: number): string {
	const hours = Math.floor(ms / (1000 * 60 * 60));
	const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
	return `${hours}h ${minutes}m`;
}
