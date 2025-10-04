/**
 * Simple Pokemon TCG Battle Simulator
 * Used for pack battles and quick simulations
 * Simplified but strategic - uses real card data
 * For full PvP battles, see tcg_battle_pvp.ts
 */

import { TCGCard } from './tcg_data';
import { TCGCards } from './tcg_collections';
import { BATTLE_CONFIG } from './tcg_config';

// ==================== BATTLE INTERFACES ====================

export interface BattleParticipant {
	card: TCGCard;
	currentHP: number;
	maxHP: number;
	energy: number;
	status: 'normal' | 'paralyzed' | 'poisoned' | 'burned' | 'asleep' | 'confused';
	statusTurns: number; // How many turns status has been active
}

export interface BattleAction {
	turn: number;
	attacker: string;
	defender: string;
	attackName: string;
	damage: number;
	damageBeforeModifiers: number;
	effectiveness?: string;
	statusEffect?: string;
	description: string;
}

export interface BattleResult {
	winner: 'player1' | 'player2' | 'draw';
	player1Card: TCGCard;
	player2Card: TCGCard;
	player1FinalHP: number;
	player2FinalHP: number;
	totalTurns: number;
	battleLog: BattleAction[];
	battleSummary: string;
	player1Stats: BattleStats;
	player2Stats: BattleStats;
}

export interface BattleStats {
	totalDamageDealt: number;
	totalDamageTaken: number;
	attacksUsed: number;
	energyUsed: number;
	turnsActive: number;
}

export interface BattlePreview {
	predictedWinner: 'player1' | 'player2' | 'toss-up';
	winProbability: number; // 0-100
	player1Advantages: string[];
	player2Advantages: string[];
	reasoning: string;
	estimatedTurns: number;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Get type effectiveness multiplier
 */
function getTypeEffectiveness(
	attackerType: string,
	defenderWeaknesses?: TCGCard['weaknesses'],
	defenderResistances?: TCGCard['resistances']
): {
	multiplier: number;
	flatModifier: number;
	effectiveness: string;
} {
	let multiplier = 1.0;
	let flatModifier = 0;
	let effectiveness = 'normal';
	
	// Check weaknesses
	if (defenderWeaknesses && defenderWeaknesses.length > 0) {
		const weakness = defenderWeaknesses.find(w => w.type === attackerType);
		if (weakness) {
			if (weakness.value.includes('×')) {
				const value = parseFloat(weakness.value.replace('×', ''));
				multiplier = value;
			} else if (weakness.value.includes('+')) {
				flatModifier = parseInt(weakness.value.replace('+', ''));
			}
			effectiveness = 'super effective';
		}
	}
	
	// Check resistances
	if (defenderResistances && defenderResistances.length > 0) {
		const resistance = defenderResistances.find(r => r.type === attackerType);
		if (resistance) {
			if (resistance.value.includes('-')) {
				flatModifier = parseInt(resistance.value); // Already negative
			}
			effectiveness = 'not very effective';
		}
	}
	
	return { multiplier, flatModifier, effectiveness };
}

/**
 * Calculate damage with all modifiers
 */
function calculateDamage(
	attacker: BattleParticipant,
	defender: BattleParticipant,
	attack: NonNullable<TCGCard['attacks']>[0],
	turnNumber: number
): {
	damage: number;
	damageBeforeModifiers: number;
	effectiveness: string;
	isCritical: boolean;
} {
	let baseDamage = attack.damage;
	const damageBeforeModifiers = baseDamage;
	let isCritical = false;
	
	// Critical hit chance (5%)
	if (Math.random() < 0.05) {
		baseDamage = Math.floor(baseDamage * 1.5);
		isCritical = true;
	}
	
	// Type effectiveness
	const attackerType = attacker.card.type || 'Colorless';
	const { multiplier, flatModifier, effectiveness } = getTypeEffectiveness(
		attackerType,
		defender.card.weaknesses,
		defender.card.resistances
	);
	
	baseDamage = Math.floor(baseDamage * multiplier);
	baseDamage += flatModifier;
	
	// Status effects on attacker
	if (attacker.status === 'paralyzed') {
		// Paralyzed Pokemon deal 50% damage
		baseDamage = Math.floor(baseDamage * 0.5);
	} else if (attacker.status === 'poisoned') {
		// Poisoned Pokemon deal 75% damage
		baseDamage = Math.floor(baseDamage * 0.75);
	} else if (attacker.status === 'confused') {
		// 50% chance to hit itself
		if (Math.random() < 0.5) {
			baseDamage = 0; // Confused and hurt itself
		}
	}
	
	// Random variance (±10%)
	const variance = 0.9 + Math.random() * 0.2;
	baseDamage = Math.floor(baseDamage * variance);
	
	// Minimum 0 damage
	baseDamage = Math.max(0, baseDamage);
	
	return {
		damage: baseDamage,
		damageBeforeModifiers,
		effectiveness,
		isCritical
	};
}

/**
 * Apply status condition effects
 */
function applyStatusEffects(participant: BattleParticipant): {
	damage: number;
	message: string;
} {
	let damage = 0;
	let message = '';
	
	switch (participant.status) {
		case 'poisoned':
			damage = 10;
			message = `${participant.card.name} is hurt by poison (10 damage)`;
			break;
		case 'burned':
			damage = 20;
			message = `${participant.card.name} is hurt by burn (20 damage)`;
			break;
		case 'asleep':
			// 50% chance to wake up
			if (Math.random() < 0.5) {
				participant.status = 'normal';
				participant.statusTurns = 0;
				message = `${participant.card.name} woke up!`;
			} else {
				message = `${participant.card.name} is fast asleep`;
			}
			break;
		case 'paralyzed':
			// Paralysis wears off after 1 turn
			if (participant.statusTurns >= 1) {
				participant.status = 'normal';
				participant.statusTurns = 0;
				message = `${participant.card.name} is no longer paralyzed`;
			}
			break;
		case 'confused':
			// Confusion wears off after 2-4 turns
			if (participant.statusTurns >= 2 + Math.floor(Math.random() * 3)) {
				participant.status = 'normal';
				participant.statusTurns = 0;
				message = `${participant.card.name} snapped out of confusion`;
			}
			break;
	}
	
	participant.statusTurns++;
	return { damage, message };
}

/**
 * Check for status condition infliction from attack
 */
function checkStatusInfliction(attack: NonNullable<TCGCard['attacks']>[0]): {
	status: BattleParticipant['status'];
	chance: number;
} | null {
	const attackText = (attack.text || '').toLowerCase();
	
	// Poison
	if (attackText.includes('poison')) {
		return { status: 'poisoned', chance: 0.3 };
	}
	
	// Burn
	if (attackText.includes('burn')) {
		return { status: 'burned', chance: 0.3 };
	}
	
	// Paralyze
	if (attackText.includes('paralyze') || attackText.includes('paralysis')) {
		return { status: 'paralyzed', chance: 0.3 };
	}
	
	// Sleep
	if (attackText.includes('sleep') || attackText.includes('asleep')) {
		return { status: 'asleep', chance: 0.5 };
	}
	
	// Confuse
	if (attackText.includes('confuse') || attackText.includes('confusion')) {
		return { status: 'confused', chance: 0.3 };
	}
	
	return null;
}

/**
 * Select best available attack based on energy and strategy
 */
function selectBestAttack(
	participant: BattleParticipant,
	opponent: BattleParticipant,
	turnNumber: number
): NonNullable<TCGCard['attacks']>[0] | null {
	if (!participant.card.attacks || participant.card.attacks.length === 0) {
		return null;
	}
	
	// Filter attacks that can be used with current energy
	const availableAttacks = participant.card.attacks.filter(
		attack => attack.convertedEnergyCost <= participant.energy
	);
	
	if (availableAttacks.length === 0) {
		// Return cheapest attack to show energy requirement
		return participant.card.attacks.reduce((cheapest, attack) => 
			attack.convertedEnergyCost < cheapest.convertedEnergyCost ? attack : cheapest
		);
	}
	
	// Strategy: Choose attack based on situation
	const opponentHPPercent = opponent.currentHP / opponent.maxHP;
	
	// Sort attacks by effectiveness
	const scoredAttacks = availableAttacks.map(attack => {
		let score = attack.damage;
		
		// Bonus for high damage when opponent is low HP
		if (opponentHPPercent < 0.3 && attack.damage >= opponent.currentHP) {
			score += 100; // Prioritize finishing blow
		}
		
		// Bonus for energy efficiency
		const efficiency = attack.damage / Math.max(1, attack.convertedEnergyCost);
		score += efficiency * 10;
		
		// Bonus for status effects
		const statusEffect = checkStatusInfliction(attack);
		if (statusEffect) {
			score += 20;
		}
		
		// Bonus for type advantage
		const attackerType = participant.card.type || 'Colorless';
		const typeCheck = getTypeEffectiveness(
			attackerType,
			opponent.card.weaknesses,
			opponent.card.resistances
		);
		if (typeCheck.effectiveness === 'super effective') {
			score += 30;
		}
		
		return { attack, score };
	});
	
	// Return highest scoring attack
	scoredAttacks.sort((a, b) => b.score - a.score);
	return scoredAttacks[0].attack;
}

/**
 * Check if participant can act (not asleep)
 */
function canAct(participant: BattleParticipant): boolean {
	return participant.status !== 'asleep';
}

// ==================== BATTLE SIMULATOR ====================

/**
 * Simulate a battle between two Pokemon cards
 */
export async function simulateBattle(card1Id: string, card2Id: string): Promise<BattleResult> {
	// Fetch cards from database
	const [card1, card2] = await Promise.all([
		TCGCards.findOne({ cardId: card1Id }),
		TCGCards.findOne({ cardId: card2Id })
	]);
	
	if (!card1 || !card2) {
		throw new Error('One or both cards not found');
	}
	
	if (card1.supertype !== 'Pokémon' || card2.supertype !== 'Pokémon') {
		throw new Error('Both cards must be Pokémon');
	}
	
	// Initialize battle participants
	const player1: BattleParticipant = {
		card: card1,
		currentHP: card1.hp || 60,
		maxHP: card1.hp || 60,
		energy: BATTLE_CONFIG.STARTING_ENERGY || 3,
		status: 'normal',
		statusTurns: 0
	};
	
	const player2: BattleParticipant = {
		card: card2,
		currentHP: card2.hp || 60,
		maxHP: card2.hp || 60,
		energy: BATTLE_CONFIG.STARTING_ENERGY || 3,
		status: 'normal',
		statusTurns: 0
	};
	
	// Initialize stats tracking
	const player1Stats: BattleStats = {
		totalDamageDealt: 0,
		totalDamageTaken: 0,
		attacksUsed: 0,
		energyUsed: 0,
		turnsActive: 0
	};
	
	const player2Stats: BattleStats = {
		totalDamageDealt: 0,
		totalDamageTaken: 0,
		attacksUsed: 0,
		energyUsed: 0,
		turnsActive: 0
	};
	
	const battleLog: BattleAction[] = [];
	let currentTurn = 1;
	const maxTurns = BATTLE_CONFIG.MAX_TURNS || 15;
	
	// Determine who goes first (based on speed)
	const player1Speed = card1.battleStats?.speed || 50;
	const player2Speed = card2.battleStats?.speed || 50;
	let isPlayer1Turn = player1Speed >= player2Speed;
	
	// Add battle start log
	battleLog.push({
		turn: 0,
		attacker: 'System',
		defender: 'System',
		attackName: 'Battle Start',
		damage: 0,
		damageBeforeModifiers: 0,
		description: `${card1.name} (${player1.maxHP} HP) vs ${card2.name} (${player2.maxHP} HP)! ${isPlayer1Turn ? card1.name : card2.name} goes first!`
	});
	
	// Battle loop
	while (currentTurn <= maxTurns && player1.currentHP > 0 && player2.currentHP > 0) {
		const attacker = isPlayer1Turn ? player1 : player2;
		const defender = isPlayer1Turn ? player2 : player1;
		const attackerStats = isPlayer1Turn ? player1Stats : player2Stats;
		const defenderStats = isPlayer1Turn ? player2Stats : player1Stats;
		const attackerName = attacker.card.name;
		const defenderName = defender.card.name;
		
		attackerStats.turnsActive++;
		
		// Apply status effects at start of turn
		const statusEffect = applyStatusEffects(attacker);
		if (statusEffect.message) {
			battleLog.push({
				turn: currentTurn,
				attacker: attackerName,
				defender: defenderName,
				attackName: 'Status Effect',
				damage: statusEffect.damage,
				damageBeforeModifiers: statusEffect.damage,
				statusEffect: attacker.status,
				description: statusEffect.message
			});
			
			attacker.currentHP -= statusEffect.damage;
			attackerStats.totalDamageTaken += statusEffect.damage;
		}
		
		// Check if knocked out by status
		if (attacker.currentHP <= 0) {
			break;
		}
		
		// Check if can act
		if (!canAct(attacker)) {
			battleLog.push({
				turn: currentTurn,
				attacker: attackerName,
				defender: defenderName,
				attackName: 'Cannot Act',
				damage: 0,
				damageBeforeModifiers: 0,
				statusEffect: attacker.status,
				description: `${attackerName} cannot act due to ${attacker.status}!`
			});
			isPlayer1Turn = !isPlayer1Turn;
			currentTurn++;
			continue;
		}
		
		// Add energy at start of turn
		attacker.energy += BATTLE_CONFIG.ENERGY_PER_TURN || 1;
		attacker.energy = Math.min(10, attacker.energy);
		
		// Select attack
		const selectedAttack = selectBestAttack(attacker, defender, currentTurn);
		
		if (!selectedAttack) {
			// No attacks available
			battleLog.push({
				turn: currentTurn,
				attacker: attackerName,
				defender: defenderName,
				attackName: 'No Attack',
				damage: 0,
				damageBeforeModifiers: 0,
				description: `${attackerName} has no available attacks!`
			});
			isPlayer1Turn = !isPlayer1Turn;
			currentTurn++;
			continue;
		}
		
		// Check if enough energy
		if (selectedAttack.convertedEnergyCost > attacker.energy) {
			battleLog.push({
				turn: currentTurn,
				attacker: attackerName,
				defender: defenderName,
				attackName: 'Charging',
				damage: 0,
				damageBeforeModifiers: 0,
				description: `${attackerName} is charging energy... (${attacker.energy}/${selectedAttack.convertedEnergyCost})`
			});
			isPlayer1Turn = !isPlayer1Turn;
			currentTurn++;
			continue;
		}
		
		// Use energy
		attacker.energy -= selectedAttack.convertedEnergyCost;
		attackerStats.energyUsed += selectedAttack.convertedEnergyCost;
		attackerStats.attacksUsed++;
		
		// Calculate damage
		const damageResult = calculateDamage(attacker, defender, selectedAttack, currentTurn);
		
		// Apply damage
		defender.currentHP = Math.max(0, defender.currentHP - damageResult.damage);
		attackerStats.totalDamageDealt += damageResult.damage;
		defenderStats.totalDamageTaken += damageResult.damage;
		
		// Check for status infliction
		const statusInfliction = checkStatusInfliction(selectedAttack);
		let statusMessage = '';
		if (statusInfliction && defender.status === 'normal' && Math.random() < statusInfliction.chance) {
			defender.status = statusInfliction.status;
			defender.statusTurns = 0;
			statusMessage = ` ${defenderName} is now ${statusInfliction.status}!`;
		}
		
		// Build action description
		let description = `${attackerName} used ${selectedAttack.name}!`;
		if (damageResult.isCritical) {
			description += ' Critical hit!';
		}
		if (damageResult.effectiveness !== 'normal') {
			description += ` It's ${damageResult.effectiveness}!`;
		}
		if (damageResult.damage === 0 && damageResult.damageBeforeModifiers > 0) {
			description += ' But it had no effect!';
		} else {
			description += ` (${damageResult.damage} damage)`;
		}
		if (selectedAttack.text) {
			description += ` [${selectedAttack.text}]`;
		}
		description += statusMessage;
		
		battleLog.push({
			turn: currentTurn,
			attacker: attackerName,
			defender: defenderName,
			attackName: selectedAttack.name,
			damage: damageResult.damage,
			damageBeforeModifiers: damageResult.damageBeforeModifiers,
			effectiveness: damageResult.effectiveness,
			statusEffect: statusInfliction?.status,
			description
		});
		
		// Check for knockout
		if (defender.currentHP <= 0) {
			battleLog.push({
				turn: currentTurn,
				attacker: attackerName,
				defender: defenderName,
				attackName: 'Knockout',
				damage: 0,
				damageBeforeModifiers: 0,
				description: `${defenderName} was knocked out!`
			});
			break;
		}
		
		// Switch turns
		isPlayer1Turn = !isPlayer1Turn;
		currentTurn++;
	}
	
	// Determine winner
	let winner: 'player1' | 'player2' | 'draw';
	let battleSummary: string;
	
	if (player1.currentHP > 0 && player2.currentHP <= 0) {
		winner = 'player1';
		battleSummary = `${card1.name} wins! (${player1.currentHP}/${player1.maxHP} HP remaining)`;
	} else if (player2.currentHP > 0 && player1.currentHP <= 0) {
		winner = 'player2';
		battleSummary = `${card2.name} wins! (${player2.currentHP}/${player2.maxHP} HP remaining)`;
	} else if (currentTurn > maxTurns) {
		// Time limit reached
		if (player1.currentHP > player2.currentHP) {
			winner = 'player1';
			battleSummary = `${card1.name} wins by HP! (${player1.currentHP} vs ${player2.currentHP})`;
		} else if (player2.currentHP > player1.currentHP) {
			winner = 'player2';
			battleSummary = `${card2.name} wins by HP! (${player2.currentHP} vs ${player1.currentHP})`;
		} else {
			winner = 'draw';
			battleSummary = `Draw! Both Pokémon have ${player1.currentHP} HP.`;
		}
	} else {
		winner = 'draw';
		battleSummary = 'Draw!';
	}
	
	return {
		winner,
		player1Card: card1,
		player2Card: card2,
		player1FinalHP: player1.currentHP,
		player2FinalHP: player2.currentHP,
		totalTurns: currentTurn - 1,
		battleLog,
		battleSummary,
		player1Stats,
		player2Stats
	};
}

/**
 * Simulate a pack battle (uses best card from each pack)
 */
export async function simulatePackBattle(pack1: TCGCard[], pack2: TCGCard[]): Promise<BattleResult> {
	// Filter Pokemon only
	const pokemon1 = pack1.filter(card => card.supertype === 'Pokémon' && card.battleValue);
	const pokemon2 = pack2.filter(card => card.supertype === 'Pokémon' && card.battleValue);
	
	if (pokemon1.length === 0 || pokemon2.length === 0) {
		throw new Error('Both packs must contain at least one Pokémon');
	}
	
	// Select strongest Pokemon from each pack
	const best1 = pokemon1.reduce((best, card) => 
		(card.battleValue || 0) > (best.battleValue || 0) ? card : best
	);
	
	const best2 = pokemon2.reduce((best, card) => 
		(card.battleValue || 0) > (best.battleValue || 0) ? card : best
	);
	
	// Simulate battle between best Pokemon
	return simulateBattle(best1.cardId, best2.cardId);
}

/**
 * Get battle preview (predict outcome without simulating)
 */
export function getBattlePreview(card1: TCGCard, card2: TCGCard): BattlePreview {
	const p1Advantages: string[] = [];
	const p2Advantages: string[] = [];
	
	let player1Score = 50; // Start at 50% each
	let player2Score = 50;
	
	// Battle value comparison (20% weight)
	const p1BV = card1.battleValue || 0;
	const p2BV = card2.battleValue || 0;
	if (p1BV > p2BV) {
		const diff = Math.min(20, ((p1BV - p2BV) / p2BV) * 20);
		player1Score += diff;
		player2Score -= diff;
		p1Advantages.push(`Higher battle value (${p1BV} vs ${p2BV})`);
	} else if (p2BV > p1BV) {
		const diff = Math.min(20, ((p2BV - p1BV) / p1BV) * 20);
		player2Score += diff;
		player1Score -= diff;
		p2Advantages.push(`Higher battle value (${p2BV} vs ${p1BV})`);
	}
	
	// HP comparison (15% weight)
	const p1HP = card1.hp || 60;
	const p2HP = card2.hp || 60;
	if (p1HP > p2HP) {
		const diff = Math.min(15, ((p1HP - p2HP) / p2HP) * 15);
		player1Score += diff;
		player2Score -= diff;
		p1Advantages.push(`More HP (${p1HP} vs ${p2HP})`);
	} else if (p2HP > p1HP) {
		const diff = Math.min(15, ((p2HP - p1HP) / p1HP) * 15);
		player2Score += diff;
		player1Score -= diff;
		p2Advantages.push(`More HP (${p2HP} vs ${p1HP})`);
	}
	
	// Attack power (20% weight)
	const p1Attack = card1.battleStats?.attackPower || 0;
	const p2Attack = card2.battleStats?.attackPower || 0;
	if (p1Attack > p2Attack) {
		const diff = Math.min(20, ((p1Attack - p2Attack) / p2Attack) * 20);
		player1Score += diff;
		player2Score -= diff;
		p1Advantages.push(`Stronger attacks (${p1Attack} vs ${p2Attack})`);
	} else if (p2Attack > p1Attack) {
		const diff = Math.min(20, ((p2Attack - p1Attack) / p1Attack) * 20);
		player2Score += diff;
		player1Score -= diff;
		p2Advantages.push(`Stronger attacks (${p2Attack} vs ${p1Attack})`);
	}
	
	// Speed (10% weight)
	const p1Speed = card1.battleStats?.speed || 50;
	const p2Speed = card2.battleStats?.speed || 50;
	if (p1Speed > p2Speed) {
		const diff = Math.min(10, ((p1Speed - p2Speed) / p2Speed) * 10);
		player1Score += diff;
		player2Score -= diff;
		p1Advantages.push(`Faster (${p1Speed} vs ${p2Speed} speed)`);
	} else if (p2Speed > p1Speed) {
		const diff = Math.min(10, ((p2Speed - p1Speed) / p1Speed) * 10);
		player2Score += diff;
		player1Score -= diff;
		p2Advantages.push(`Faster (${p2Speed} vs ${p1Speed} speed)`);
	}
	
	// Type effectiveness (25% weight)
	if (card1.type && card2.weaknesses) {
		const hasAdvantage = card2.weaknesses.some(w => w.type === card1.type);
		if (hasAdvantage) {
			player1Score += 25;
			player2Score -= 25;
			p1Advantages.push(`Type advantage (${card1.type} vs ${card2.type})`);
		}
	}
	if (card2.type && card1.weaknesses) {
		const hasAdvantage = card1.weaknesses.some(w => w.type === card2.type);
		if (hasAdvantage) {
			player2Score += 25;
			player1Score -= 25;
			p2Advantages.push(`Type advantage (${card2.type} vs ${card1.type})`);
		}
	}
	
	// Normalize scores
	const total = player1Score + player2Score;
	player1Score = (player1Score / total) * 100;
	player2Score = (player2Score / total) * 100;
	
	// Determine predicted winner
	let predictedWinner: 'player1' | 'player2' | 'toss-up';
	let winProbability: number;
	
	if (player1Score >= 60) {
		predictedWinner = 'player1';
		winProbability = player1Score;
	} else if (player2Score >= 60) {
		predictedWinner = 'player2';
		winProbability = player2Score;
	} else {
		predictedWinner = 'toss-up';
		winProbability = 50;
	}
	
	// Estimate turns based on HP and attack power
	const avgHP = (p1HP + p2HP) / 2;
	const avgAttack = (p1Attack + p2Attack) / 2;
	const estimatedTurns = avgAttack > 0 ? Math.ceil(avgHP / avgAttack) * 2 : 10;
	
	// Generate reasoning
	let reasoning: string;
	if (predictedWinner === 'player1') {
		reasoning = `${card1.name} has the advantage with ${p1Advantages.length} key factors in their favor (${Math.round(player1Score)}% win probability)`;
	} else if (predictedWinner === 'player2') {
		reasoning = `${card2.name} has the advantage with ${p2Advantages.length} key factors in their favor (${Math.round(player2Score)}% win probability)`;
	} else {
		reasoning = 'This battle is evenly matched! Both Pokémon have similar strengths.';
	}
	
	return {
		predictedWinner,
		winProbability: Math.round(winProbability),
		player1Advantages: p1Advantages,
		player2Advantages: p2Advantages,
		reasoning,
		estimatedTurns
	};
}

/**
 * Simulate multiple battles and get win statistics
 */
export async function simulateMultipleBattles(
	card1Id: string,
	card2Id: string,
	numberOfBattles: number = 100
): Promise<{
	player1Wins: number;
	player2Wins: number;
	draws: number;
	averageTurns: number;
	player1WinRate: number;
	player2WinRate: number;
}> {
	let player1Wins = 0;
	let player2Wins = 0;
	let draws = 0;
	let totalTurns = 0;
	
	for (let i = 0; i < numberOfBattles; i++) {
		const result = await simulateBattle(card1Id, card2Id);
		
		if (result.winner === 'player1') player1Wins++;
		else if (result.winner === 'player2') player2Wins++;
		else draws++;
		
		totalTurns += result.totalTurns;
	}
	
	return {
		player1Wins,
		player2Wins,
		draws,
		averageTurns: Math.round(totalTurns / numberOfBattles),
		player1WinRate: Math.round((player1Wins / numberOfBattles) * 100),
		player2WinRate: Math.round((player2Wins / numberOfBattles) * 100)
	};
}
