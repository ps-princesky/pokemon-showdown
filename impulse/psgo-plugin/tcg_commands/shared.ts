/**
 * Shared helper functions for TCG commands
 */

import { TCGCard, UserCollection, SPECIAL_SUBTYPES } from '../../../impulse/psgo-plugin/tcg_data';
import { TCGCards, UserCollections } from '../../../impulse/psgo-plugin/tcg_collections';
import { PACK_CONFIG, VALIDATION_LIMITS } from '../../../impulse/psgo-plugin/tcg_config';

export function getCardPoints(card: any): number {
	let points = getCardPointsFromRarity(card.rarity);
	
	// Battle Value Bonus
	if (card.battleValue) {
		if (card.battleValue >= 200) points += 60;
		else if (card.battleValue >= 175) points += 50;
		else if (card.battleValue >= 150) points += 40;
		else if (card.battleValue >= 125) points += 30;
		else if (card.battleValue >= 100) points += 20;
		else if (card.battleValue >= 75) points += 10;
		else if (card.battleValue >= 50) points += 5;
	}
	
	// HP Bonus
	if (card.hp) {
		if (card.hp >= 301) points += 20;
		else if (card.hp >= 251) points += 15;
		else if (card.hp >= 201) points += 12;
		else if (card.hp >= 151) points += 8;
		else if (card.hp >= 101) points += 5;
		else if (card.hp >= 51) points += 2;
	}
	
	// Special Subtype Bonus
	if (card.subtypes && card.subtypes.length > 0) {
		card.subtypes.forEach((subtype: string) => {
			if (SPECIAL_SUBTYPES[subtype]) {
				points += 10;
			}
		});
	}
	
	// Evolution Stage Bonus
	if (card.subtypes && card.subtypes.includes('Stage 2')) {
		points += 10;
	} else if (card.subtypes && card.subtypes.includes('Stage 1')) {
		points += 5;
	}
	
	return points;
}

export function getCardPointsFromRarity(rarity: string): number {
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

// ==================== PERMANENT IN-MEMORY CACHING ====================

// Cache valid sets permanently (cleared only manually)
let validSetsCache: string[] | null = null;

// Cache set card distributions permanently (cleared only manually)
let setCardsCache: Map<string, {
	commons: TCGCard[],
	uncommons: TCGCard[],
	rares: TCGCard[],
	reverseHoloPool: TCGCard[]
}> = new Map();

/**
 * Get all valid sets for pack generation (PERMANENTLY CACHED)
 */
export async function getValidPackSets(): Promise<string[]> {
	// Return cached result if available
	if (validSetsCache !== null) {
		console.log(`Using cached valid sets (${validSetsCache.length} sets)`);
		return validSetsCache;
	}
	
	console.log('Building valid sets cache (first time or after clear)...');
	const startTime = Date.now();
	
	// Use aggregation pipeline to count rarities per set (MUCH faster)
	const pipeline = [
		{
			$group: {
				_id: '$set',
				totalCards: { $sum: 1 },
				commons: {
					$sum: { $cond: [{ $eq: ['$rarity', 'Common'] }, 1, 0] }
				},
				uncommons: {
					$sum: { $cond: [{ $eq: ['$rarity', 'Uncommon'] }, 1, 0] }
				},
				rares: {
					$sum: { 
						$cond: [
							{ $regexMatch: { input: '$rarity', regex: /Rare/ } }, 
							1, 
							0
						] 
					}
				}
			}
		},
		{
			$match: {
				commons: { $gte: 5 },
				uncommons: { $gte: 3 },
				rares: { $gt: 0 }
			}
		}
	];
	
	const validSetsData = await TCGCards.aggregate(pipeline).toArray();
	const validSets = validSetsData.map((doc: any) => doc._id);
	
	// Cache the result permanently
	validSetsCache = validSets;
	
	const elapsed = Date.now() - startTime;
	console.log(`✅ Valid sets cached: ${validSets.length} sets (took ${elapsed}ms)`);
	
	return validSets;
}

/**
 * Get cards for a set (PERMANENTLY CACHED)
 */
async function getSetCards(setId: string): Promise<{
	commons: TCGCard[],
	uncommons: TCGCard[],
	rares: TCGCard[],
	reverseHoloPool: TCGCard[]
}> {
	const cached = setCardsCache.get(setId);
	
	// Return cached if available
	if (cached) {
		return cached;
	}
	
	console.log(`Caching cards for set: ${setId}`);
	const startTime = Date.now();
	
	// Fetch from DB with projection (only needed fields)
	const setCards = await TCGCards.find(
		{ set: setId },
		{ 
			projection: { 
				cardId: 1, 
				name: 1, 
				set: 1, 
				rarity: 1, 
				type: 1, 
				supertype: 1,
				hp: 1,
				battleValue: 1,
				subtypes: 1
			} 
		}
	).toArray();
	
	const commons = setCards.filter(c => c.rarity === 'Common');
	const uncommons = setCards.filter(c => c.rarity === 'Uncommon');
	const rares = setCards.filter(c => c.rarity && c.rarity.includes('Rare'));
	
	const result = {
		commons,
		uncommons,
		rares,
		reverseHoloPool: [...commons, ...uncommons] // Pre-compute this
	};
	
	setCardsCache.set(setId, result);
	
	const elapsed = Date.now() - startTime;
	console.log(`✅ Set ${setId} cached: ${setCards.length} cards (took ${elapsed}ms)`);
	
	return result;
}

/**
 * Generate a pack of cards (OPTIMIZED)
 */
export async function generatePack(setId: string): Promise<TCGCard[] | null> {
	const { commons, uncommons, rares, reverseHoloPool } = await getSetCards(setId);
	
	// Check if set has valid rarity distribution
	if (commons.length < 5 || uncommons.length < 3 || rares.length === 0) {
		return null;
	}

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

	let hitPool = rares.filter(c => c.rarity === chosenRarityTier);
	if (hitPool.length === 0) hitPool = rares.filter(c => c.rarity === 'Rare Holo');
	if (hitPool.length === 0) hitPool = rares.filter(c => c.rarity === 'Rare');
	if (hitPool.length === 0) hitPool = rares;

	pack.push(pickRandom(hitPool));
	
	return pack;
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
 * Clear caches (call this when importing new cards)
 * Returns statistics about what was cleared
 */
export function clearPackCaches(): { validSets: number; cachedSets: number } {
	const stats = {
		validSets: validSetsCache?.length || 0,
		cachedSets: setCardsCache.size
	};
	
	validSetsCache = null;
	setCardsCache.clear();
	
	console.log(`🗑️  Pack caches cleared: ${stats.validSets} valid sets, ${stats.cachedSets} cached set card pools`);
	
	return stats;
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
	validSetsLoaded: boolean;
	validSetsCount: number;
	cachedSetsCount: number;
	estimatedMemoryMB: number;
} {
	const cachedSetsCount = setCardsCache.size;
	
	// Rough estimate: each card ~1KB, average 200 cards per set
	const estimatedMemoryMB = Math.round((cachedSetsCount * 200 * 1024) / (1024 * 1024));
	
	return {
		validSetsLoaded: validSetsCache !== null,
		validSetsCount: validSetsCache?.length || 0,
		cachedSetsCount,
		estimatedMemoryMB
	};
}

/**
 * Preload all set caches (call on server startup for instant performance)
 */
export async function preloadSetCaches(): Promise<void> {
	console.log('🚀 Preloading TCG set caches...');
	const startTime = Date.now();
	
	// Load valid sets first
	const validSets = await getValidPackSets();
	
	// Preload the most common sets (or all if you have RAM)
	const setsToPreload = validSets.slice(0, 20); // Top 20 sets
	
	for (const setId of setsToPreload) {
		await getSetCards(setId);
	}
	
	const elapsed = Date.now() - startTime;
	const stats = getCacheStats();
	
	console.log(`✅ TCG caches preloaded in ${elapsed}ms`);
	console.log(`   - Valid sets: ${stats.validSetsCount}`);
	console.log(`   - Cached set pools: ${stats.cachedSetsCount}`);
	console.log(`   - Est. memory: ~${stats.estimatedMemoryMB}MB`);
}
