/**
 * Shared helper functions for TCG commands
 */

import { TCGCard, UserCollection } from '../../..impulse/psgo-plugin/tcg_data';
import { TCGCards, UserCollections } from '../../../impulse/psgo-plugin/tcg_collections';
import { PACK_CONFIG, VALIDATION_LIMITS } from '../../../impulse/psgo-plugin/tcg_config';

/**
 * Get card points - now uses pre-calculated battleValue when available
 */
export function getCardPoints(card: TCGCard): number {
	// Use pre-calculated battle value if available (more accurate)
	if (card.battleValue !== undefined) {
		return card.battleValue;
	}
	
	// Fallback to rarity-based points if no battle value
	return getCardPointsFromRarity(card.rarity);
}

/**
 * Get card points from rarity (fallback for non-Pokemon cards)
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
		case 'Rare ex': case 'Radiant Rare': return 60;
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

/**
 * Get card rarity color for UI display
 */
export function getRarityColor(rarity: string): string {
	switch (rarity) {
		case 'Common': case '1st Edition': case 'Shadowless': return '#95a5a6';
		case 'Uncommon': return '#3498db';
		case 'Reverse Holo': return '#9b59b6';
		case 'Rare': return '#f39c12';
		case 'Double Rare': case 'Promo': case 'Black Star Promo': return '#e67e22';
		case 'Rare Holo': case 'Classic Collection': return '#f1c40f';
		case 'Rare Holo 1st Edition': return '#d4af37';
		case 'Rare SP': return '#e74c3c';
		case 'Rare Holo EX': case 'Rare Holo GX': case 'Rare Holo V': return '#8e44ad';
		case 'Rare BREAK': case 'Rare Prime': case 'LEGEND': case 'Prism Star': return '#2c3e50';
		case 'Rare Holo VMAX': case 'Rare Holo VSTAR': return '#34495e';
		case 'Rare ex': case 'Radiant Rare': return '#e74c3c';
		case 'Amazing Rare': case 'Shining': return '#ff6b6b';
		case 'ACE SPEC Rare': case 'Rare ACE': return '#4ecdc4';
		case 'Full Art': case 'Rare Ultra': return '#45b7d1';
		case 'Rare Shiny': case 'Shiny Rare': return '#96ceb4';
		case 'Trainer Gallery': case 'Character Rare': case 'Rare Shiny GX': case 'Shiny Ultra Rare': return '#ffeaa7';
		case 'Illustration Rare': return '#fd79a8';
		case 'Rare Holo LV.X': return '#a29bfe';
		case 'Rare Holo Star': return '#6c5ce7';
		case 'Character Super Rare': return '#fd5e53';
		case 'Rare Secret': return '#e17055';
		case 'Special Illustration Rare': return '#00cec9';
		case 'Rare Rainbow': return '#ff7675';
		case 'Gold Full Art': case 'Rare Gold': case 'Hyper Rare': return '#fdcb6e';
		case 'Gold Star': return '#f39c12';
		default: return '#95a5a6';
	}
}

/**
 * Get card type color for UI display
 */
export function getTypeColor(type: string): string {
	switch (type) {
		case 'Fire': return '#ff4444';
		case 'Water': return '#4488ff';
		case 'Grass': return '#44aa44';
		case 'Lightning': return '#ffdd44';
		case 'Psychic': return '#aa44aa';
		case 'Fighting': return '#bb8844';
		case 'Darkness': return '#444444';
		case 'Metal': return '#888888';
		case 'Fairy': return '#ffaaff';
		case 'Dragon': return '#8844aa';
		case 'Colorless': default: return '#999999';
	}
}

/**
 * Format card display name with type info
 */
export function formatCardName(card: TCGCard): string {
	let name = card.name;
	
	if (card.supertype === 'Pokémon') {
		if (card.hp) {
			name += ` (${card.hp} HP)`;
		}
		if (card.type) {
			name += ` [${card.type}]`;
		}
	} else if (card.supertype === 'Trainer') {
		if (card.subtypes && card.subtypes.length > 0) {
			name += ` [${card.subtypes.join(', ')}]`;
		}
	}
	
	return name;
}

/**
 * Get battle-ready Pokemon from a list of cards
 */
export function getBattleReadyPokemon(cards: TCGCard[]): TCGCard[] {
	return cards.filter(card => 
		card.supertype === 'Pokémon' && 
		card.battleValue !== undefined &&
		card.hp !== undefined
	);
}

/**
 * Convert hex color to rgba
 */
export function hexToRgba(hex: string, alpha: number): string {
	if (!/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
		return `rgba(128, 128, 128, ${alpha})`;
	}
	
	let c = hex.substring(1).split('');
	if (c.length === 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]];
	const num = parseInt(c.join(''), 16);
	const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Generate a pack of cards with enhanced filtering for new card structure
 */
export async function generatePack(setId: string): Promise<TCGCard[] | null> {
	try {
		// Updated to work with new card structure where set is an array
		const setCards = await TCGCards.find({ 
			$or: [
				{ set: setId },
				{ set: { $in: [setId] } },
				{ cardId: { $regex: `^${setId}-` } }
			]
		});
		
		if (setCards.length === 0) return null;
		
		const commons = setCards.filter(c => c.rarity === 'Common');
		const uncommons = setCards.filter(c => c.rarity === 'Uncommon');
		const raresPool = setCards.filter(c => c.rarity && c.rarity.includes('Rare'));
		
		const pack: TCGCard[] = [];
		const usedCardIds = new Set<string>();
		
		const pickRandom = (pool: TCGCard[]): TCGCard => {
			let attempts = 0;
			while (attempts < PACK_CONFIG.MAX_UNIQUE_ATTEMPTS) {
				const randomCard = pool[Math.floor(Math.random() * pool.length)];
				if (!pool.length || !randomCard) break;
				
				if (!usedCardIds.has(randomCard.cardId)) {
					usedCardIds.add(randomCard.cardId);
					return randomCard;
				}
				attempts++;
			}
			return pool[Math.floor(Math.random() * pool.length)];
		};
		
		// Handle small sets
		if (commons.length === 0 || uncommons.length === 0 || raresPool.length === 0) {
			if (setCards.length < PACK_CONFIG.PACK_SIZE) {
				return setCards;
			}
			
			for (let i = 0; i < PACK_CONFIG.PACK_SIZE; i++) {
				pack.push(pickRandom(setCards));
			}
			return pack;
		}
		
		const reverseHoloPool = [...commons, ...uncommons];
		
		// Use config values
		for (let i = 0; i < PACK_CONFIG.COMMONS_PER_PACK; i++) pack.push(pickRandom(commons));
		for (let i = 0; i < PACK_CONFIG.UNCOMMONS_PER_PACK; i++) pack.push(pickRandom(uncommons));
		for (let i = 0; i < PACK_CONFIG.REVERSE_HOLO_SLOTS; i++) pack.push(pickRandom(reverseHoloPool));
		
		const hitRoll = Math.random() * 100;
		let chosenRarityTier: string;
		
		// Use config rarity rates
		if (hitRoll <= PACK_CONFIG.RARITY_RATES.RARE) chosenRarityTier = 'Rare';
		else if (hitRoll <= PACK_CONFIG.RARITY_RATES.RARE + PACK_CONFIG.RARITY_RATES.RARE_HOLO) chosenRarityTier = 'Rare Holo';
		else if (hitRoll <= PACK_CONFIG.RARITY_RATES.RARE + PACK_CONFIG.RARITY_RATES.RARE_HOLO + PACK_CONFIG.RARITY_RATES.ULTRA_RARE) {
			chosenRarityTier = PACK_CONFIG.ULTRA_RARES[Math.floor(Math.random() * PACK_CONFIG.ULTRA_RARES.length)];
		} else {
			chosenRarityTier = PACK_CONFIG.SECRET_RARES[Math.floor(Math.random() * PACK_CONFIG.SECRET_RARES.length)];
		}
		
		let hitPool = raresPool.filter(c => c.rarity === chosenRarityTier);
		if (hitPool.length === 0) hitPool = raresPool.filter(c => c.rarity === 'Rare Holo');
		if (hitPool.length === 0) hitPool = raresPool.filter(c => c.rarity === 'Rare');
		if (hitPool.length === 0) hitPool = raresPool;
		
		pack.push(pickRandom(hitPool));
		return pack;
		
	} catch (error) {
		console.error('Error generating pack:', error);
		return null;
	}
}


/**
 * Ensure user has a collection record
 */
export async function ensureUserCollection(userId: string): Promise<UserCollection> {
	let collection = await UserCollections.findOne({ userId });
	
	if (!collection) {
		collection = {
			userId,
			cards: [],
			packs: [],
			stats: { totalCards: 0, uniqueCards: 0, totalPoints: 0 },
			lastUpdated: Date.now(),
		};
	} else {
		if (!collection.cards) collection.cards = [];
		if (!collection.packs) collection.packs = [];
		if (!collection.stats) collection.stats = { totalCards: 0, uniqueCards: 0, totalPoints: 0 };
	}
	
	return collection;
}

/**
 * Calculate pack value using new battleValue system
 */
export function calculatePackValue(cards: TCGCard[]): number {
	return cards.reduce((total, card) => total + getCardPoints(card), 0);
}

/**
 * Get the best card from a list (highest point value)
 */
export function getBestCard(cards: TCGCard[]): TCGCard {
	return cards.reduce((best, card) => 
		getCardPoints(card) > getCardPoints(best) ? card : best
	);
}

/**
 * Get the best Pokemon from a list (highest battle value)
 */
export function getBestPokemon(cards: TCGCard[]): TCGCard | null {
	const pokemon = getBattleReadyPokemon(cards);
	if (pokemon.length === 0) return null;
	
	return pokemon.reduce((best, card) => 
		(card.battleValue || 0) > (best.battleValue || 0) ? card : best
	);
}

/**
 * Format card for pack display
 */
export function formatPackCard(card: TCGCard, showBattleInfo: boolean = true): string {
	let cardHtml = `<div style="margin:5px 0; padding:5px; border-left:3px solid ${getRarityColor(card.rarity)};">`;
	cardHtml += `<span style="font-weight:bold; color:${getRarityColor(card.rarity)};">${card.name}</span>`;
	cardHtml += ` <span style="font-size:0.9em;">[${card.rarity}]</span>`;
	
	if (card.supertype === 'Pokémon' && showBattleInfo) {
		if (card.hp) {
			cardHtml += ` <span style="font-size:0.8em; color:#666;">(${card.hp} HP)</span>`;
		}
		if (card.type) {
			cardHtml += ` <span style="font-size:0.8em; color:${getTypeColor(card.type)};">[${card.type}]</span>`;
		}
		if (card.battleValue) {
			cardHtml += ` <span style="font-size:0.8em; color:#e74c3c;">(${card.battleValue} BV)</span>`;
		}
	}
	
	cardHtml += ` <span style="font-size:0.8em; color:#999;">(${getCardPoints(card)} pts)</span>`;
	cardHtml += `</div>`;
	
	return cardHtml;
}

/**
 * Update collection stats
 */
export function updateCollectionStats(collection: UserCollection): void {
	collection.stats.totalCards = collection.cards.reduce((sum, c) => sum + c.quantity, 0);
	collection.stats.uniqueCards = collection.cards.length;
	collection.stats.totalPoints = 0; // Will be calculated on-demand
	collection.lastUpdated = Date.now();
}

/**
 * Add card to collection
 */
export function addCardToCollection(collection: UserCollection, cardId: string, quantity: number = 1): void {
	const existingCard = collection.cards.find(c => c.cardId === cardId);
	
	if (existingCard) {
		existingCard.quantity += quantity;
	} else {
		collection.cards.push({
			cardId,
			quantity,
			addedAt: Date.now()
		});
	}
	
	updateCollectionStats(collection);
}
