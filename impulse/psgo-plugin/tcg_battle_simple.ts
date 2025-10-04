/**
 * Simple Pokemon TCG Battle Simulator
 * Used for pack battles and quick simulations
 * Simplified but strategic - uses real card data
 * For full PvP battles, see tcg_battle_pvp.ts
 */

import { TCGCard } from './tcg_data';
import { TCGCards } from './tcg_collections';
import { BATTLE_CONFIG, STATUS_CONDITIONS, EFFECTIVENESS } from './tcg_config';

// ==================== BATTLE INTERFACES ====================

export interface BattleParticipant {
	card: TCGCard;
	currentHP: number;
	maxHP: number;
	energy: number;
	status: 'normal' | 'paralyzed' | 'poisoned' | 'burned' | 'asleep' | 'confused';
	statusTurns: number;
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
	winProbability: number;
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
	let effectiveness = EFFECTIVENESS.NORMAL;
	
	// Check weaknesses
	if (BATTLE_CONFIG.ENABLE_TYPE_EFFECTIVENESS && defenderWeaknesses && defenderWeaknesses.length > 0) {
		const weakness = defenderWeaknesses.find(w => w.type === attackerType);
		if (weakness) {
			if (weakness.value.includes('×')) {
				const value = parseFloat(weakness.value.replace('×', ''));
				multiplier = value || BATTLE_CONFIG.WEAKNESS_MULTIPLIER_DEFAULT;
			} else if (weakness.value.includes('+')) {
				flatModifier = parseInt(weakness.value.replace('+', ''));
			}
			effectiveness = EFFECTIVENESS.SUPER_EFFECTIVE;
		}
	}
	
	// Check resistances
	if (BATTLE_CONFIG.ENABLE_TYPE_EFFECTIVENESS && defenderResistances && defenderResistances.length > 0) {
		const resistance = defenderResistances.find(r => r.type === attackerType);
		if (resistance) {
			if (resistance.value.includes('-')) {
				flatModifier = parseInt(resistance.value);
			}
			effectiveness = EFFECTIVENESS.NOT_VERY_EFFECTIVE;
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
	
	// Critical hit chance
	if (Math.random() < BATTLE_CONFIG.CRITICAL_HIT_CHANCE) {
		baseDamage = Math.floor(baseDamage * BATTLE_CONFIG.CRITICAL_HIT_MULTIPLIER);
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
	if (BATTLE_CONFIG.ENABLE_STATUS_CONDITIONS) {
		if (attacker.status === STATUS_CONDITIONS.PARALYZED) {
			baseDamage = Math.floor(baseDamage * BATTLE_CONFIG.PARALYZED_DAMAGE_MULTIPLIER);
		} else if (attacker.status === STATUS_CONDITIONS.POISONED) {
			baseDamage = Math.floor(baseDamage * BATTLE_CONFIG.POISONED_DAMAGE_MULTIPLIER);
		} else if (attacker.status === STATUS_CONDITIONS.CONFUSED) {
			if (Math.random() < BATTLE_CONFIG.CONFUSION_SELF_HIT_CHANCE) {
				baseDamage = 0;
			}
		}
	}
	
	// Random variance
	const variance = 1 - BATTLE_CONFIG.DAMAGE_VARIANCE + (Math.random() * BATTLE_CONFIG.DAMAGE_VARIANCE * 2);
	baseDamage = Math.floor(baseDamage * variance);
	
	// Minimum damage
	baseDamage = Math.max(BATTLE_CONFIG.MIN_DAMAGE, baseDamage);
	
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
	if (!BATTLE_CONFIG.ENABLE_STATUS_CONDITIONS) {
		return { damage: 0, message: '' };
	}
	
	let damage = 0;
	let message = '';
	
	switch (participant.status) {
		case STATUS_CONDITIONS.POISONED:
			damage = BATTLE_CONFIG.POISON_DAMAGE;
			message = `${participant.card.name} is hurt by poison (${damage} damage)`;
			break;
		case STATUS_CONDITIONS.BURNED:
			damage = BATTLE_CONFIG.BURN_DAMAGE;
			message = `${participant.card.name} is hurt by burn (${damage} damage)`;
			break;
		case STATUS_CONDITIONS.ASLEEP:
			if (Math.random() < BATTLE_CONFIG.SLEEP_WAKE_CHANCE) {
				participant.status = STATUS_CONDITIONS.NORMAL as any;
				participant.statusTurns = 0;
				message = `${participant.card.name} woke up!`;
			} else {
				message = `${participant.card.name} is fast asleep`;
			}
			break;
		case STATUS_CONDITIONS.PARALYZED:
			if (participant.statusTurns >= BATTLE_CONFIG.PARALYSIS_DURATION) {
				participant.status = STATUS_CONDITIONS.NORMAL as any;
				participant.statusTurns = 0;
				message = `${participant.card.name} is no longer paralyzed`;
			}
			break;
		case STATUS_CONDITIONS.CONFUSED:
			const confusionDuration = BATTLE_CONFIG.CONFUSION_MIN_DURATION + 
									 Math.floor(Math.random() * (BATTLE_CONFIG.CONFUSION_MAX_DURATION - BATTLE_CONFIG.CONFUSION_MIN_DURATION + 1));
			if (participant.statusTurns >= confusionDuration) {
				participant.status = STATUS_CONDITIONS.NORMAL as any;
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
	if (!BATTLE_CONFIG.ENABLE_STATUS_CONDITIONS) {
		return null;
	}
	
	const attackText = (attack.text || '').toLowerCase();
	
	if (attackText.includes('poison')) {
		return { status: STATUS_CONDITIONS.POISONED as any, chance: BATTLE_CONFIG.STATUS_INFLICT_CHANCE };
	}
	
	if (attackText.includes('burn')) {
		return { status: STATUS_CONDITIONS.BURNED as any, chance: BATTLE_CONFIG.STATUS_INFLICT_CHANCE };
	}
	
	if (attackText.includes('paralyze') || attackText.includes('paralysis')) {
		return { status: STATUS_CONDITIONS.PARALYZED as any, chance: BATTLE_CONFIG.STATUS_INFLICT_CHANCE };
	}
	
	if (attackText.includes('sleep') || attackText.includes('asleep')) {
		return { status: STATUS_CONDITIONS.ASLEEP as any, chance: BATTLE_CONFIG.SLEEP_WAKE_CHANCE };
	}
	
	if (attackText.includes('confuse') || attackText.includes('confusion')) {
		return { status: STATUS_CONDITIONS.CONFUSED as any, chance: BATTLE_CONFIG.STATUS_INFLICT_CHANCE };
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
	
	const availableAttacks = participant.card.attacks.filter(
		attack => attack.convertedEnergyCost <= participant.energy
	);
	
	if (availableAttacks.length === 0) {
		return participant.card.attacks.reduce((cheapest, attack) => 
			attack.convertedEnergyCost < cheapest.convertedEnergyCost ? attack : cheapest
		);
	}
	
	const opponentHPPercent = opponent.currentHP / opponent.maxHP;
	
	const scoredAttacks = availableAttacks.map(attack => {
		let score = attack.damage;
		
		// Finishing blow bonus
		if (opponentHPPercent < 0.3 && attack.damage >= opponent.currentHP) {
			score += BATTLE_CONFIG.AI_FINISHING_BLOW_BONUS;
		}
		
		// Energy efficiency
		const efficiency = attack.damage / Math.max(1, attack.convertedEnergyCost);
		score += efficiency * BATTLE_CONFIG.AI_EFFICIENCY_WEIGHT;
		
		// Status effect bonus
		const statusEffect = checkStatusInfliction(attack);
		if (statusEffect) {
			score += BATTLE_CONFIG.AI_STATUS_EFFECT_BONUS;
		}
		
		// Type advantage bonus
		const attackerType = participant.card.type || 'Colorless';
		const typeCheck = getTypeEffectiveness(
			attackerType,
			opponent.card.weaknesses,
			opponent.card.resistances
		);
		if (typeCheck.effectiveness === EFFECTIVENESS.SUPER_EFFECTIVE) {
			score += BATTLE_CONFIG.AI_TYPE_ADVANTAGE_BONUS;
		}
		
		return { attack, score };
	});
	
	scoredAttacks.sort((a, b) => b.score - a.score);
	return scoredAttacks[0].attack;
}

/**
 * Check if participant can act
 */
function canAct(participant: BattleParticipant): boolean {
	if (!BATTLE_CONFIG.ENABLE_STATUS_CONDITIONS) {
		return true;
	}
	return participant.status !== STATUS_CONDITIONS.ASLEEP;
}

// ==================== BATTLE SIMULATOR ====================

/**
 * Simulate a battle between two Pokemon cards
 */
export async function simulateBattle(card1Id: string, card2Id: string): Promise<BattleResult> {
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
	
	const player1: BattleParticipant = {
		card: card1,
		currentHP: card1.hp || 60,
		maxHP: card1.hp || 60,
		energy: BATTLE_CONFIG.STARTING_ENERGY,
		status: STATUS_CONDITIONS.NORMAL as any,
		statusTurns: 0
	};
	
	const player2: BattleParticipant = {
		card: card2,
		currentHP: card2.hp || 60,
		maxHP: card2.hp || 60,
		energy: BATTLE_CONFIG.STARTING_ENERGY,
		status: STATUS_CONDITIONS.NORMAL as any,
		statusTurns: 0
	};
	
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
	const maxTurns = BATTLE_CONFIG.MAX_TURNS;
	
	const player1Speed = card1.battleStats?.speed || 50;
	const player2Speed = card2.battleStats?.speed || 50;
	let isPlayer1Turn = player1Speed >= player2Speed;
	
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
		
		// Apply status effects
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
		
		if (attacker.currentHP <= 0) break;
		
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
		
		// Add energy
		attacker.energy += BATTLE_CONFIG.ENERGY_PER_TURN;
		attacker.energy = Math.min(BATTLE_CONFIG.MAX_ENERGY, attacker.energy);
		
		const selectedAttack = selectBestAttack(attacker, defender, currentTurn);
		
		if (!selectedAttack) {
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
		
		attacker.energy -= selectedAttack.convertedEnergyCost;
		attackerStats.energyUsed += selectedAttack.convertedEnergyCost;
		attackerStats.attacksUsed++;
		
		const damageResult = calculateDamage(attacker, defender, selectedAttack, currentTurn);
		
		defender.currentHP = Math.max(0, defender.currentHP - damageResult.damage);
		attackerStats.totalDamageDealt += damageResult.damage;
		defenderStats.totalDamageTaken += damageResult.damage;
		
		const statusInfliction = checkStatusInfliction(selectedAttack);
		let statusMessage = '';
		if (statusInfliction && defender.status === STATUS_CONDITIONS.NORMAL && Math.random() < statusInfliction.chance) {
			defender.status = statusInfliction.status;
			defender.statusTurns = 0;
			statusMessage = ` ${defenderName} is now ${statusInfliction.status}!`;
		}
		
		let description = `${attackerName} used ${selectedAttack.name}!`;
		if (damageResult.isCritical) {
			description += ' Critical hit!';
		}
		if (damageResult.effectiveness !== EFFECTIVENESS.NORMAL) {
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
 * Simulate a pack battle
 */
export async function simulatePackBattle(pack1: TCGCard[], pack2: TCGCard[]): Promise<BattleResult> {
	const pokemon1 = pack1.filter(card => card.supertype === 'Pokémon' && card.battleValue);
	const pokemon2 = pack2.filter(card => card.supertype === 'Pokémon' && card.battleValue);
	
	if (pokemon1.length === 0 || pokemon2.length === 0) {
		throw new Error('Both packs must contain at least one Pokémon');
	}
	
	const best1 = pokemon1.reduce((best, card) => 
		(card.battleValue || 0) > (best.battleValue || 0) ? card : best
	);
	
	const best2 = pokemon2.reduce((best, card) => 
		(card.battleValue || 0) > (best.battleValue || 0) ? card : best
	);
	
	return simulateBattle(best1.cardId, best2.cardId);
}

/**
 * Get battle preview
 */
export function getBattlePreview(card1: TCGCard, card2: TCGCard): BattlePreview {
	const p1Advantages: string[] = [];
	const p2Advantages: string[] = [];
	
	let player1Score = 50;
	let player2Score = 50;
	
	// Battle value comparison
	const p1BV = card1.battleValue || 0;
	const p2BV = card2.battleValue || 0;
	if (p1BV > p2BV) {
		const diff = Math.min(20, ((p1BV - p2BV) / p2BV) * 20);
		player1Score += diff * BATTLE_CONFIG.PREVIEW_BATTLE_VALUE_WEIGHT / 0.20;
		player2Score -= diff * BATTLE_CONFIG.PREVIEW_BATTLE_VALUE_WEIGHT / 0.20;
		p1Advantages.push(`Higher battle value (${p1BV} vs ${p2BV})`);
	} else if (p2BV > p1BV) {
		const diff = Math.min(20, ((p2BV - p1BV) / p1BV) * 20);
		player2Score += diff * BATTLE_CONFIG.PREVIEW_BATTLE_VALUE_WEIGHT / 0.20;
		player1Score -= diff * BATTLE_CONFIG.PREVIEW_BATTLE_VALUE_WEIGHT / 0.20;
		p2Advantages.push(`Higher battle value (${p2BV} vs ${p1BV})`);
	}
	
	// HP comparison
	const p1HP = card1.hp || 60;
	const p2HP = card2.hp || 60;
	if (p1HP > p2HP) {
		const diff = Math.min(15, ((p1HP - p2HP) / p2HP) * 15);
		player1Score += diff * BATTLE_CONFIG.PREVIEW_HP_WEIGHT / 0.15;
		player2Score -= diff * BATTLE_CONFIG.PREVIEW_HP_WEIGHT / 0.15;
		p1Advantages.push(`More HP (${p1HP} vs ${p2HP})`);
	} else if (p2HP > p1HP) {
		const diff = Math.min(15, ((p2HP - p1HP) / p1HP) * 15);
		player2Score += diff * BATTLE_CONFIG.PREVIEW_HP_WEIGHT / 0.15;
		player1Score -= diff * BATTLE_CONFIG.PREVIEW_HP_WEIGHT / 0.15;
		p2Advantages.push(`More HP (${p2HP} vs ${p1HP})`);
	}
	
	// Attack power
	const p1Attack = card1.battleStats?.attackPower || 0;
	const p2Attack = card2.battleStats?.attackPower || 0;
	if (p1Attack > p2Attack) {
		const diff = Math.min(20, ((p1Attack - p2Attack) / p2Attack) * 20);
		player1Score += diff * BATTLE_CONFIG.PREVIEW_ATTACK_WEIGHT / 0.20;
		player2Score -= diff * BATTLE_CONFIG.PREVIEW_ATTACK_WEIGHT / 0.20;
		p1Advantages.push(`Stronger attacks (${p1Attack} vs ${p2Attack})`);
	} else if (p2Attack > p1Attack) {
		const diff = Math.min(20, ((p2Attack - p1Attack) / p1Attack) * 20);
		player2Score += diff * BATTLE_CONFIG.PREVIEW_ATTACK_WEIGHT / 0.20;
		player1Score -= diff * BATTLE_CONFIG.PREVIEW_ATTACK_WEIGHT / 0.20;
		p2Advantages.push(`Stronger attacks (${p2Attack} vs ${p1Attack})`);
	}
	
	// Speed
	const p1Speed = card1.battleStats?.speed || 50;
	const p2Speed = card2.battleStats?.speed || 50;
	if (p1Speed > p2Speed) {
		const diff = Math.min(10, ((p1Speed - p2Speed) / p2Speed) * 10);
		player1Score += diff * BATTLE_CONFIG.PREVIEW_SPEED_WEIGHT / 0.10;
		player2Score -= diff * BATTLE_CONFIG.PREVIEW_SPEED_WEIGHT / 0.10;
		p1Advantages.push(`Faster (${p1Speed} vs ${p2Speed} speed)`);
	} else if (p2Speed > p1Speed) {
		const diff = Math.min(10, ((p2Speed - p1Speed) / p1Speed) * 10);
		player2Score += diff * BATTLE_CONFIG.PREVIEW_SPEED_WEIGHT / 0.10;
		player1Score -= diff * BATTLE_CONFIG.PREVIEW_SPEED_WEIGHT / 0.10;
		p2Advantages.push(`Faster (${p2Speed} vs ${p1Speed} speed)`);
	}
	
	// Type effectiveness
	if (BATTLE_CONFIG.ENABLE_TYPE_EFFECTIVENESS) {
		if (card1.type && card2.weaknesses) {
			const hasAdvantage = card2.weaknesses.some(w => w.type === card1.type);
			if (hasAdvantage) {
				const bonus = 25 * BATTLE_CONFIG.PREVIEW_TYPE_WEIGHT / 0.25;
				player1Score += bonus;
				player2Score -= bonus;
				p1Advantages.push(`Type advantage (${card1.type} vs ${card2.type})`);
			}
		}
		if (card2.type && card1.weaknesses) {
			const hasAdvantage = card1.weaknesses.some(w => w.type === card2.type);
			if (hasAdvantage) {
				const bonus = 25 * BATTLE_CONFIG.PREVIEW_TYPE_WEIGHT / 0.25;
				player2Score += bonus;
				player1Score -= bonus;
				p2Advantages.push(`Type advantage (${card2.type} vs ${card1.type})`);
			}
		}
	}
	
	// Normalize scores
	const total = player1Score + player2Score;
	player1Score = (player1Score / total) * 100;
	player2Score = (player2Score / total) * 100;
	
	let predictedWinner: 'player1' | 'player2' | 'toss-up';
	let winProbability: number;
	
	if (player1Score >= BATTLE_CONFIG.WIN_PROBABILITY_THRESHOLD) {
		predictedWinner = 'player1';
		winProbability = player1Score;
	} else if (player2Score >= BATTLE_CONFIG.WIN_PROBABILITY_THRESHOLD) {
		predictedWinner = 'player2';
		winProbability = player2Score;
	} else {
		predictedWinner = 'toss-up';
		winProbability = 50;
	}
	
	const avgHP = (p1HP + p2HP) / 2;
	const avgAttack = (p1Attack + p2Attack) / 2;
	const estimatedTurns = avgAttack > 0 ? Math.ceil(avgHP / avgAttack) * 2 : 10;
	
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
 * Simulate multiple battles
 */
export async function simulateMultipleBattles(
	card1Id: string,
	card2Id: string,
	numberOfBattles: number = BATTLE_CONFIG.DEFAULT_SIMULATION_COUNT
): Promise<{
	player1Wins: number;
	player2Wins: number;
	draws: number;
	averageTurns: number;
	player1WinRate: number;
	player2WinRate: number;
}> {
	const battles = Math.min(numberOfBattles, BATTLE_CONFIG.MAX_SIMULATION_COUNT);
	
	let player1Wins = 0;
	let player2Wins = 0;
	let draws = 0;
	let totalTurns = 0;
	
	for (let i = 0; i < battles; i++) {
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
		averageTurns: Math.round(totalTurns / battles),
		player1WinRate: Math.round((player1Wins / battles) * 100),
		player2WinRate: Math.round((player2Wins / battles) * 100)
	};
}
