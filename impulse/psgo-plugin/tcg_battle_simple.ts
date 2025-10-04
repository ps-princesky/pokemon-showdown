/**
 * Pokemon TCG Battle Simulator
 * Simplified but strategic battle system using real card data
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
	status?: 'normal' | 'burned' | 'poisoned' | 'paralyzed' | 'asleep' | 'confused';
}

export interface BattleAction {
	turn: number;
	attacker: string;
	defender: string;
	attackName: string;
	damage: number;
	damageBeforeModifiers: number;
	effectiveness?: string;
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
}

// ==================== BATTLE CALCULATIONS ====================

/**
 * Calculate type effectiveness multiplier
 */
function getTypeEffectiveness(attackerType: string, defenderWeaknesses: TCGCard['weaknesses'], defenderResistances: TCGCard['resistances']): {
	multiplier: number;
	effectiveness: string;
} {
	let multiplier = 1.0;
	let effectiveness = 'normal';
	
	// Check weaknesses
	if (defenderWeaknesses) {
		const weakness = defenderWeaknesses.find(w => w.type === attackerType);
		if (weakness) {
			// Parse weakness value (×2, +20, etc.)
			if (weakness.value.includes('×')) {
				const value = parseFloat(weakness.value.replace('×', ''));
				multiplier = value;
			} else if (weakness.value.includes('+')) {
				// +20 means add 20 damage (handled separately)
				multiplier = 1.0;
			}
			effectiveness = 'super effective';
		}
	}
	
	// Check resistances
	if (defenderResistances) {
		const resistance = defenderResistances.find(r => r.type === attackerType);
		if (resistance) {
			// Parse resistance value (-20, -30, etc.)
			if (resistance.value.includes('-')) {
				// Resistance is flat damage reduction (handled separately)
				multiplier = 1.0;
			}
			effectiveness = 'not very effective';
		}
	}
	
	return { multiplier, effectiveness };
}

/**
 * Calculate damage with all modifiers
 */
function calculateDamage(
	attacker: BattleParticipant,
	defender: BattleParticipant,
	attack: TCGCard['attacks'][0]
): {
	damage: number;
	damageBeforeModifiers: number;
	effectiveness: string;
} {
	let baseDamage = attack.damage;
	const damageBeforeModifiers = baseDamage;
	
	// Type effectiveness
	const attackerType = attacker.card.type || 'Colorless';
	const { multiplier, effectiveness } = getTypeEffectiveness(
		attackerType,
		defender.card.weaknesses,
		defender.card.resistances
	);
	
	baseDamage = Math.floor(baseDamage * multiplier);
	
	// Resistance damage reduction
	if (defender.card.resistances) {
		const resistance = defender.card.resistances.find(r => r.type === attackerType);
		if (resistance && resistance.value.includes('-')) {
			const reduction = parseInt(resistance.value.replace('-', ''));
			baseDamage = Math.max(0, baseDamage - reduction);
		}
	}
	
	// Weakness damage addition
	if (defender.card.weaknesses) {
		const weakness = defender.card.weaknesses.find(w => w.type === attackerType);
		if (weakness && weakness.value.includes('+')) {
			const addition = parseInt(weakness.value.replace('+', ''));
			baseDamage += addition;
		}
	}
	
	// Random variance (±5%)
	const variance = 1 + (Math.random() * 0.1 - 0.05);
	baseDamage = Math.floor(baseDamage * variance);
	
	return {
		damage: Math.max(0, baseDamage),
		damageBeforeModifiers,
		effectiveness
	};
}

/**
 * Select best available attack based on energy and damage
 */
function selectBestAttack(participant: BattleParticipant): TCGCard['attacks'][0] | null {
	if (!participant.card.attacks || participant.card.attacks.length === 0) {
		return null;
	}
	
	// Filter attacks that can be used with current energy
	const availableAttacks = participant.card.attacks.filter(
		attack => attack.convertedEnergyCost <= participant.energy
	);
	
	if (availableAttacks.length === 0) {
		// If no attacks available, use the cheapest one (even if not enough energy)
		return participant.card.attacks.reduce((cheapest, attack) => 
			attack.convertedEnergyCost < cheapest.convertedEnergyCost ? attack : cheapest
		);
	}
	
	// Sort by damage output, then by energy efficiency
	return availableAttacks.sort((a, b) => {
		const aDamagePerEnergy = a.damage / Math.max(1, a.convertedEnergyCost);
		const bDamagePerEnergy = b.damage / Math.max(1, b.convertedEnergyCost);
		
		// Prefer higher total damage first
		if (b.damage !== a.damage) {
			return b.damage - a.damage;
		}
		
		// Then prefer better energy efficiency
		return bDamagePerEnergy - aDamagePerEnergy;
	})[0];
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
		status: 'normal'
	};
	
	const player2: BattleParticipant = {
		card: card2,
		currentHP: card2.hp || 60,
		maxHP: card2.hp || 60,
		energy: BATTLE_CONFIG.STARTING_ENERGY || 3,
		status: 'normal'
	};
	
	const battleLog: BattleAction[] = [];
	let currentTurn = 1;
	const maxTurns = BATTLE_CONFIG.MAX_TURNS || 10;
	
	// Determine who goes first (based on speed)
	const player1Speed = card1.battleStats?.speed || 50;
	const player2Speed = card2.battleStats?.speed || 50;
	let firstAttacker = player1Speed >= player2Speed ? 'player1' : 'player2';
	
	// Battle loop
	while (currentTurn <= maxTurns && player1.currentHP > 0 && player2.currentHP > 0) {
		// Determine attacker and defender
		const isPlayer1Turn = (currentTurn % 2 === 1 && firstAttacker === 'player1') || 
							  (currentTurn % 2 === 0 && firstAttacker === 'player2');
		
		const attacker = isPlayer1Turn ? player1 : player2;
		const defender = isPlayer1Turn ? player2 : player1;
		const attackerName = isPlayer1Turn ? card1.name : card2.name;
		const defenderName = isPlayer1Turn ? card2.name : card1.name;
		
		// Add energy at start of turn
		attacker.energy += BATTLE_CONFIG.ENERGY_PER_TURN || 1;
		attacker.energy = Math.min(10, attacker.energy); // Max 10 energy
		
		// Select attack
		const selectedAttack = selectBestAttack(attacker);
		
		if (!selectedAttack) {
			// No attacks available (shouldn't happen with real cards)
			battleLog.push({
				turn: currentTurn,
				attacker: attackerName,
				defender: defenderName,
				attackName: 'Pass',
				damage: 0,
				damageBeforeModifiers: 0,
				description: `${attackerName} has no attacks available!`
			});
			currentTurn++;
			continue;
		}
		
		// Check if enough energy
		if (selectedAttack.convertedEnergyCost > attacker.energy) {
			// Not enough energy, pass turn
			battleLog.push({
				turn: currentTurn,
				attacker: attackerName,
				defender: defenderName,
				attackName: 'Charge',
				damage: 0,
				damageBeforeModifiers: 0,
				description: `${attackerName} doesn't have enough energy. Charging up... (${attacker.energy}/${selectedAttack.convertedEnergyCost} energy)`
			});
			currentTurn++;
			continue;
		}
		
		// Use energy
		attacker.energy -= selectedAttack.convertedEnergyCost;
		
		// Calculate damage
		const { damage, damageBeforeModifiers, effectiveness } = calculateDamage(attacker, defender, selectedAttack);
		
		// Apply damage
		defender.currentHP = Math.max(0, defender.currentHP - damage);
		
		// Build action description
		let description = `${attackerName} used ${selectedAttack.name}!`;
		if (effectiveness !== 'normal') {
			description += ` It's ${effectiveness}!`;
		}
		if (damage !== damageBeforeModifiers) {
			description += ` (${damageBeforeModifiers} → ${damage} damage)`;
		} else {
			description += ` (${damage} damage)`;
		}
		if (selectedAttack.text) {
			description += ` [${selectedAttack.text}]`;
		}
		
		battleLog.push({
			turn: currentTurn,
			attacker: attackerName,
			defender: defenderName,
			attackName: selectedAttack.name,
			damage,
			damageBeforeModifiers,
			effectiveness,
			description
		});
		
		// Check for knockout
		if (defender.currentHP <= 0) {
			break;
		}
		
		currentTurn++;
	}
	
	// Determine winner
	let winner: 'player1' | 'player2' | 'draw';
	let battleSummary: string;
	
	if (player1.currentHP > 0 && player2.currentHP <= 0) {
		winner = 'player1';
		battleSummary = `${card1.name} wins!`;
	} else if (player2.currentHP > 0 && player1.currentHP <= 0) {
		winner = 'player2';
		battleSummary = `${card2.name} wins!`;
	} else if (currentTurn > maxTurns) {
		// Time limit reached, higher HP wins
		if (player1.currentHP > player2.currentHP) {
			winner = 'player1';
			battleSummary = `${card1.name} wins by HP! (${player1.currentHP} HP vs ${player2.currentHP} HP)`;
		} else if (player2.currentHP > player1.currentHP) {
			winner = 'player2';
			battleSummary = `${card2.name} wins by HP! (${player2.currentHP} HP vs ${player1.currentHP} HP)`;
		} else {
			winner = 'draw';
			battleSummary = `Draw! Both Pokémon have ${player1.currentHP} HP remaining.`;
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
		battleSummary
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
 * Get battle preview (what would happen without simulating)
 */
export function getBattlePreview(card1: TCGCard, card2: TCGCard): {
	predictedWinner: 'player1' | 'player2' | 'toss-up';
	player1Advantages: string[];
	player2Advantages: string[];
	reasoning: string;
} {
	const p1Advantages: string[] = [];
	const p2Advantages: string[] = [];
	
	// Compare stats
	const p1BV = card1.battleValue || 0;
	const p2BV = card2.battleValue || 0;
	
	if (p1BV > p2BV) {
		p1Advantages.push(`Higher battle value (${p1BV} vs ${p2BV})`);
	} else if (p2BV > p1BV) {
		p2Advantages.push(`Higher battle value (${p2BV} vs ${p1BV})`);
	}
	
	// HP comparison
	const p1HP = card1.hp || 60;
	const p2HP = card2.hp || 60;
	if (p1HP > p2HP) {
		p1Advantages.push(`More HP (${p1HP} vs ${p2HP})`);
	} else if (p2HP > p1HP) {
		p2Advantages.push(`More HP (${p2HP} vs ${p1HP})`);
	}
	
	// Attack power
	const p1Attack = card1.battleStats?.attackPower || 0;
	const p2Attack = card2.battleStats?.attackPower || 0;
	if (p1Attack > p2Attack) {
		p1Advantages.push(`Stronger attacks (${p1Attack} vs ${p2Attack})`);
	} else if (p2Attack > p1Attack) {
		p2Advantages.push(`Stronger attacks (${p2Attack} vs ${p1Attack})`);
	}
	
	// Speed
	const p1Speed = card1.battleStats?.speed || 50;
	const p2Speed = card2.battleStats?.speed || 50;
	if (p1Speed > p2Speed) {
		p1Advantages.push(`Faster (${p1Speed} vs ${p2Speed})`);
	} else if (p2Speed > p1Speed) {
		p2Advantages.push(`Faster (${p2Speed} vs ${p1Speed})`);
	}
	
	// Type effectiveness
	if (card1.type && card2.weaknesses) {
		const hasAdvantage = card2.weaknesses.some(w => w.type === card1.type);
		if (hasAdvantage) {
			p1Advantages.push(`Type advantage (${card1.type} vs ${card2.type})`);
		}
	}
	if (card2.type && card1.weaknesses) {
		const hasAdvantage = card1.weaknesses.some(w => w.type === card2.type);
		if (hasAdvantage) {
			p2Advantages.push(`Type advantage (${card2.type} vs ${card1.type})`);
		}
	}
	
	// Determine predicted winner
	let predictedWinner: 'player1' | 'player2' | 'toss-up';
	const advantageDiff = p1Advantages.length - p2Advantages.length;
	
	if (advantageDiff >= 2) {
		predictedWinner = 'player1';
	} else if (advantageDiff <= -2) {
		predictedWinner = 'player2';
	} else {
		predictedWinner = 'toss-up';
	}
	
	const reasoning = advantageDiff === 0 
		? 'This battle is evenly matched!'
		: advantageDiff > 0 
			? `${card1.name} has the edge with ${p1Advantages.length} advantages`
			: `${card2.name} has the edge with ${p2Advantages.length} advantages`;
	
	return {
		predictedWinner,
		player1Advantages: p1Advantages,
		player2Advantages: p2Advantages,
		reasoning
	};
}
  
