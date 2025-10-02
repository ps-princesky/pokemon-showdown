/**
 * Pokemon TCG Collection Plugin
 * Allows users to collect, trade, and manage Pokemon TCG cards
 * @license MIT
 */

import { MongoDB } from '../../impulse/mongodb_module';

interface TCGCard {
	_id?: string;
	cardId: string;
	name: string;
	set: string;
	rarity: string;
	supertype: string;
	subtypes: string[];
	type?: string;
	hp?: number;
	stage?: string;
	imageUrl?: string;
}

interface UserCollection {
	_id?: string;
	userId: string;
	cards: {
		cardId: string;
		quantity: number;
		addedAt: number;
	}[];
	stats: {
		totalCards: number;
		uniqueCards: number;
		favoriteType?: string;
		totalCardsTraded?: number;
		totalPoints?: number; 
	};
	tradeLocked: boolean;
	lastUpdated: number;
}

interface TradeOffer {
	_id?: string;
	tradeId: string;
	fromUser: string;
	toUser: string;
	offeredCards: { cardId: string; quantity: number }[];
	requestedCards: { cardId: string; quantity: number }[];
	status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
	createdAt: number;
	expiresAt: number;
}

// Initialize collections
const TCGCards = MongoDB<TCGCard>('tcg_cards');
const UserCollections = MongoDB<UserCollection>('tcg_user_collections');
const TradeOffers = MongoDB<TradeOffer>('tcg_trade_offers');

// Pokemon TCG Data
const SUPERTYPES = [
	'Pokémon',
	'Trainer',
	'Energy',
];

const POKEMON_TYPES = [
	'Grass',
	'Fire',
	'Water',
	'Lightning',
	'Psychic',
	'Fighting',
	'Darkness',
	'Metal',
	'Fairy',
	'Dragon',
	'Colorless',
];

const SUBTYPES = {
	Pokemon: [
		'Basic',
		'Stage 1',
		'Stage 2',
		'BREAK',
		'EX',
		'GX',
		'V',
		'VMAX',
		'VSTAR',
		'V-UNION',
		'ex',
		'Mega',
		'LEGEND',
		'Restored',
		'Level-Up',
		'Prime',
		'Team Plasma',
		'Radiant',
		'Ultra Beast',
		'Baby',
		'Shining',
		'Amazing',
		'TAG TEAM',
		'Single Strike',
		'Rapid Strike',
		'Fusion Strike',
		'Prism Star',
		'ACE SPEC',
	],
	Trainer: [
		'Item',
		'Supporter',
		'Stadium',
		'Pokémon Tool',
		'Technical Machine',
		'Goldenrod Game Corner',
		'Rocket\'s Secret Machine',
		'ACE SPEC',
	],
	Energy: [
		'Basic',
		'Special',
	],
};

const RARITIES = [
	'Common',
	'Uncommon',
	'Rare',
	'Rare Holo',
	'Rare Holo EX',
	'Rare Holo GX',
	'Rare Holo V',
	'Rare Holo VMAX',
	'Rare Holo VSTAR',
	'Rare Ultra',
	'Rare Secret',
	'Rare Rainbow',
	'Rare Shiny',
	'Rare Shiny GX',
	'Amazing Rare',
	'Radiant Rare',
	'Illustration Rare',
	'Special Illustration Rare',
	'Hyper Rare',
	'Ultra Rare',
	'Double Rare',
	'Promo',
	'Classic Collection',
	'ACE SPEC Rare',
	'Rare ACE',
	'Rare BREAK',
	'Rare Holo Star',
	'Rare Prime',
	'LEGEND',
];

const POKEMON_SETS = [
	// Original Series (1999-2003)
	{ code: 'BS', name: 'Base Set', year: 1999, series: 'Original' },
	{ code: 'JU', name: 'Jungle', year: 1999, series: 'Original' },
	{ code: 'FO', name: 'Fossil', year: 1999, series: 'Original' },
	{ code: 'B2', name: 'Base Set 2', year: 2000, series: 'Original' },
	{ code: 'TR', name: 'Team Rocket', year: 2000, series: 'Original' },
	{ code: 'G1', name: 'Gym Heroes', year: 2000, series: 'Original' },
	{ code: 'G2', name: 'Gym Challenge', year: 2000, series: 'Original' },
	{ code: 'N1', name: 'Neo Genesis', year: 2000, series: 'Neo' },
	{ code: 'N2', name: 'Neo Discovery', year: 2001, series: 'Neo' },
	{ code: 'N3', name: 'Neo Revelation', year: 2001, series: 'Neo' },
	{ code: 'N4', name: 'Neo Destiny', year: 2002, series: 'Neo' },
	{ code: 'LC', name: 'Legendary Collection', year: 2002, series: 'Original' },
	
	// E-Card Series (2002-2003)
	{ code: 'EX', name: 'Expedition Base Set', year: 2002, series: 'E-Card' },
	{ code: 'AQ', name: 'Aquapolis', year: 2003, series: 'E-Card' },
	{ code: 'SK', name: 'Skyridge', year: 2003, series: 'E-Card' },
	
	// EX Series (2003-2007)
	{ code: 'RS', name: 'Ruby & Sapphire', year: 2003, series: 'EX' },
	{ code: 'SS', name: 'Sandstorm', year: 2003, series: 'EX' },
	{ code: 'DR', name: 'Dragon', year: 2003, series: 'EX' },
	{ code: 'MA', name: 'Team Magma vs Team Aqua', year: 2004, series: 'EX' },
	{ code: 'HL', name: 'Hidden Legends', year: 2004, series: 'EX' },
	{ code: 'RG', name: 'FireRed & LeafGreen', year: 2004, series: 'EX' },
	{ code: 'TRR', name: 'Team Rocket Returns', year: 2004, series: 'EX' },
	{ code: 'DX', name: 'Deoxys', year: 2005, series: 'EX' },
	{ code: 'EM', name: 'Emerald', year: 2005, series: 'EX' },
	{ code: 'UF', name: 'Unseen Forces', year: 2005, series: 'EX' },
	{ code: 'DS', name: 'Delta Species', year: 2005, series: 'EX' },
	{ code: 'LM', name: 'Legend Maker', year: 2006, series: 'EX' },
	{ code: 'HP', name: 'Holon Phantoms', year: 2006, series: 'EX' },
	{ code: 'CG', name: 'Crystal Guardians', year: 2006, series: 'EX' },
	{ code: 'DF', name: 'Dragon Frontiers', year: 2006, series: 'EX' },
	{ code: 'PK', name: 'Power Keepers', year: 2007, series: 'EX' },
	
	// Diamond & Pearl Series (2007-2009)
	{ code: 'DP', name: 'Diamond & Pearl', year: 2007, series: 'Diamond & Pearl' },
	{ code: 'MT', name: 'Mysterious Treasures', year: 2007, series: 'Diamond & Pearl' },
	{ code: 'SW', name: 'Secret Wonders', year: 2007, series: 'Diamond & Pearl' },
	{ code: 'GE', name: 'Great Encounters', year: 2008, series: 'Diamond & Pearl' },
	{ code: 'MD', name: 'Majestic Dawn', year: 2008, series: 'Diamond & Pearl' },
	{ code: 'LA', name: 'Legends Awakened', year: 2008, series: 'Diamond & Pearl' },
	{ code: 'SF', name: 'Stormfront', year: 2008, series: 'Diamond & Pearl' },
	{ code: 'PL', name: 'Platinum', year: 2009, series: 'Platinum' },
	{ code: 'RR', name: 'Rising Rivals', year: 2009, series: 'Platinum' },
	{ code: 'SV', name: 'Supreme Victors', year: 2009, series: 'Platinum' },
	{ code: 'AR', name: 'Arceus', year: 2009, series: 'Platinum' },
	
	// HeartGold & SoulSilver Series (2010-2011)
	{ code: 'HGSS', name: 'HeartGold & SoulSilver', year: 2010, series: 'HGSS' },
	{ code: 'UL', name: 'Unleashed', year: 2010, series: 'HGSS' },
	{ code: 'UD', name: 'Undaunted', year: 2010, series: 'HGSS' },
	{ code: 'TM', name: 'Triumphant', year: 2010, series: 'HGSS' },
	{ code: 'CL', name: 'Call of Legends', year: 2011, series: 'HGSS' },
	
	// Black & White Series (2011-2013)
	{ code: 'BLW', name: 'Black & White', year: 2011, series: 'Black & White' },
	{ code: 'EPO', name: 'Emerging Powers', year: 2011, series: 'Black & White' },
	{ code: 'NVI', name: 'Noble Victories', year: 2011, series: 'Black & White' },
	{ code: 'NXD', name: 'Next Destinies', year: 2012, series: 'Black & White' },
	{ code: 'DEX', name: 'Dark Explorers', year: 2012, series: 'Black & White' },
	{ code: 'DRX', name: 'Dragons Exalted', year: 2012, series: 'Black & White' },
	{ code: 'BCR', name: 'Boundaries Crossed', year: 2012, series: 'Black & White' },
	{ code: 'PLS', name: 'Plasma Storm', year: 2013, series: 'Black & White' },
	{ code: 'PLF', name: 'Plasma Freeze', year: 2013, series: 'Black & White' },
	{ code: 'PLB', name: 'Plasma Blast', year: 2013, series: 'Black & White' },
	{ code: 'LTR', name: 'Legendary Treasures', year: 2013, series: 'Black & White' },
	
	// XY Series (2014-2016)
	{ code: 'XY', name: 'XY Base Set', year: 2014, series: 'XY' },
	{ code: 'FLF', name: 'Flashfire', year: 2014, series: 'XY' },
	{ code: 'FFI', name: 'Furious Fists', year: 2014, series: 'XY' },
	{ code: 'PHF', name: 'Phantom Forces', year: 2014, series: 'XY' },
	{ code: 'PRC', name: 'Primal Clash', year: 2015, series: 'XY' },
	{ code: 'ROS', name: 'Roaring Skies', year: 2015, series: 'XY' },
	{ code: 'AOR', name: 'Ancient Origins', year: 2015, series: 'XY' },
	{ code: 'BKT', name: 'BREAKthrough', year: 2015, series: 'XY' },
	{ code: 'BKP', name: 'BREAKpoint', year: 2016, series: 'XY' },
	{ code: 'GEN', name: 'Generations', year: 2016, series: 'XY' },
	{ code: 'FCO', name: 'Fates Collide', year: 2016, series: 'XY' },
	{ code: 'STS', name: 'Steam Siege', year: 2016, series: 'XY' },
	{ code: 'EVO', name: 'Evolutions', year: 2016, series: 'XY' },
	
	// Sun & Moon Series (2017-2019)
	{ code: 'SM', name: 'Sun & Moon Base Set', year: 2017, series: 'Sun & Moon' },
	{ code: 'GRI', name: 'Guardians Rising', year: 2017, series: 'Sun & Moon' },
	{ code: 'BUS', name: 'Burning Shadows', year: 2017, series: 'Sun & Moon' },
	{ code: 'SLG', name: 'Shining Legends', year: 2017, series: 'Sun & Moon' },
	{ code: 'CIN', name: 'Crimson Invasion', year: 2017, series: 'Sun & Moon' },
	{ code: 'UPR', name: 'Ultra Prism', year: 2018, series: 'Sun & Moon' },
	{ code: 'FLI', name: 'Forbidden Light', year: 2018, series: 'Sun & Moon' },
	{ code: 'CES', name: 'Celestial Storm', year: 2018, series: 'Sun & Moon' },
	{ code: 'DRM', name: 'Dragon Majesty', year: 2018, series: 'Sun & Moon' },
	{ code: 'LOT', name: 'Lost Thunder', year: 2018, series: 'Sun & Moon' },
	{ code: 'TEM', name: 'Team Up', year: 2019, series: 'Sun & Moon' },
	{ code: 'DET', name: 'Detective Pikachu', year: 2019, series: 'Sun & Moon' },
	{ code: 'UNB', name: 'Unbroken Bonds', year: 2019, series: 'Sun & Moon' },
	{ code: 'UNM', name: 'Unified Minds', year: 2019, series: 'Sun & Moon' },
	{ code: 'HIF', name: 'Hidden Fates', year: 2019, series: 'Sun & Moon' },
	{ code: 'CEC', name: 'Cosmic Eclipse', year: 2019, series: 'Sun & Moon' },
	
	// Sword & Shield Series (2020-2022)
	{ code: 'SSH', name: 'Sword & Shield Base Set', year: 2020, series: 'Sword & Shield' },
	{ code: 'RCL', name: 'Rebel Clash', year: 2020, series: 'Sword & Shield' },
	{ code: 'DAA', name: 'Darkness Ablaze', year: 2020, series: 'Sword & Shield' },
	{ code: 'CPA', name: 'Champion\'s Path', year: 2020, series: 'Sword & Shield' },
	{ code: 'VIV', name: 'Vivid Voltage', year: 2020, series: 'Sword & Shield' },
	{ code: 'SHF', name: 'Shining Fates', year: 2021, series: 'Sword & Shield' },
	{ code: 'BST', name: 'Battle Styles', year: 2021, series: 'Sword & Shield' },
	{ code: 'CRE', name: 'Chilling Reign', year: 2021, series: 'Sword & Shield' },
	{ code: 'EVS', name: 'Evolving Skies', year: 2021, series: 'Sword & Shield' },
	{ code: 'CEL', name: 'Celebrations', year: 2021, series: 'Sword & Shield' },
	{ code: 'FST', name: 'Fusion Strike', year: 2021, series: 'Sword & Shield' },
	{ code: 'BRS', name: 'Brilliant Stars', year: 2022, series: 'Sword & Shield' },
	{ code: 'ASR', name: 'Astral Radiance', year: 2022, series: 'Sword & Shield' },
	{ code: 'PGO', name: 'Pokémon GO', year: 2022, series: 'Sword & Shield' },
	{ code: 'LOR', name: 'Lost Origin', year: 2022, series: 'Sword & Shield' },
	{ code: 'SIT', name: 'Silver Tempest', year: 2022, series: 'Sword & Shield' },
	{ code: 'CRZ', name: 'Crown Zenith', year: 2023, series: 'Sword & Shield' },
	
	// Scarlet & Violet Series (2023-Present)
	{ code: 'SVI', name: 'Scarlet & Violet Base Set', year: 2023, series: 'Scarlet & Violet' },
	{ code: 'PAL', name: 'Paldea Evolved', year: 2023, series: 'Scarlet & Violet' },
	{ code: 'OBF', name: 'Obsidian Flames', year: 2023, series: 'Scarlet & Violet' },
	{ code: 'MEW', name: '151', year: 2023, series: 'Scarlet & Violet' },
	{ code: 'PAR', name: 'Paradox Rift', year: 2023, series: 'Scarlet & Violet' },
	{ code: 'PAF', name: 'Paldean Fates', year: 2024, series: 'Scarlet & Violet' },
	{ code: 'TEF', name: 'Temporal Forces', year: 2024, series: 'Scarlet & Violet' },
	{ code: 'TWM', name: 'Twilight Masquerade', year: 2024, series: 'Scarlet & Violet' },
	{ code: 'SHR', name: 'Shrouded Fable', year: 2024, series: 'Scarlet & Violet' },
	{ code: 'SCR', name: 'Stellar Crown', year: 2024, series: 'Scarlet & Violet' },
	{ code: 'SSP', name: 'Surging Sparks', year: 2024, series: 'Scarlet & Violet' },
	{ code: 'PRE', name: 'Prismatic Evolutions', year: 2025, series: 'Scarlet & Violet' },
];

// Card rarity weights for pack opening
const RARITY_WEIGHTS = {
	common: 60,
	uncommon: 25,
	rare: 10,
	'rare holo': 3,
	'rare ultra': 1.5,
	'rare secret': 0.5,
	'illustration rare': 0.8,
	'special illustration rare': 0.3,
	'hyper rare': 0.4,
};

const SPECIAL_SUBTYPES: { [key: string]: { color: string; glow?: boolean } } = {
	VMAX: { color: '#C0392B', glow: true },
	VSTAR: { color: '#8E44AD', glow: true },
	GX: { color: '#E67E22', glow: true },
	EX: { color: '#E74C3C', glow: true },
	'ACE SPEC': { color: '#F39C12', glow: true },
	'Radiant Rare': { color: '#FF6B6B', glow: true },
	'Amazing Rare': { color: '#00CED1', glow: true },
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Calculates a card's point value based on its rarity.
 * The system is tiered to create a balanced sense of value.
 */
function getCardPoints(card: TCGCard): number {
	switch (card.rarity) {
		// Tier 1: Common Pulls
		case 'Common':
			return 5;
		case 'Uncommon':
			return 10;

		// Tier 2: Standard Rares
		case 'Rare':
			return 20;
		case 'Double Rare':
		case 'Promo':
			return 25;
		case 'Rare Holo':
		case 'Classic Collection':
			return 30;

		// Tier 3: Holo Rule Box Cards (V, GX, EX, etc.)
		case 'Rare Holo EX':
		case 'Rare Holo GX':
		case 'Rare Holo V':
			return 45;
		case 'Rare BREAK':
		case 'Rare Prime':
		case 'LEGEND':
			return 50;
		case 'Rare Holo VMAX':
		case 'Rare Holo VSTAR':
			return 55;
			
		// Tier 4: Special Rarity Cards
		case 'Radiant Rare':
			return 60;
		case 'Amazing Rare':
			return 65;
		case 'ACE SPEC Rare':
		case 'Rare ACE':
			return 70;
		
		// Tier 5: Full Art & Illustration Rares
		case 'Rare Ultra': // Standard Full Arts
			return 75;
		case 'Rare Shiny':
			return 80;
		case 'Rare Shiny GX':
			return 85;
		case 'Illustration Rare':
			return 90;
		case 'Rare Holo Star': // Very rare for its era
			return 100;
			
		// Tier 6: Secret & Hyper Rares (Highest Value)
		case 'Rare Secret':
			return 120;
		case 'Special Illustration Rare':
			return 150;
		case 'Rare Rainbow':
			return 160;
		case 'Hyper Rare': // Gold Cards
			return 175;

		default:
			// Fallback for any unlisted rarities
			return 5;
	}
}

/**
 * Converts a hex color string to an RGBA string.
 */
function hexToRgba(hex: string, alpha: number): string {
	if (!/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
		return `rgba(128, 128, 128, ${alpha})`; // Return a default gray if hex is invalid
	}
	let c = hex.substring(1).split('');
	if (c.length === 3) {
		c = [c[0], c[0], c[1], c[1], c[2], c[2]];
	}
	const num = parseInt(c.join(''), 16);
	const r = (num >> 16) & 255;
	const g = (num >> 8) & 255;
	const b = num & 255;

	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getRarityColor(rarity: string): string {
	const colors: {[key: string]: string} = {
		common: '#808080',
		uncommon: '#2ECC71',
		rare: '#3498DB',
		'rare holo': '#9B59B6',
		'rare holo ex': '#E74C3C',
		'rare holo gx': '#E67E22',
		'rare holo v': '#E74C3C',
		'rare holo vmax': '#C0392B',
		'rare holo vstar': '#8E44AD',
		'rare ultra': '#E74C3C',
		'rare secret': '#F39C12',
		'rare rainbow': '#E91E63',
		'rare shiny': '#FFD700',
		'amazing rare': '#00CED1',
		'radiant rare': '#FF6B6B',
		'illustration rare': '#4ECDC4',
		'special illustration rare': '#FFE66D',
		'hyper rare': '#FF10F0',
	};
	return colors[rarity.toLowerCase()] || '#FFFFFF';
}

function getRandomCard(cards: TCGCard[]): TCGCard {
	const totalWeight = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
	const random = Math.random() * totalWeight;
	
	let cumulativeWeight = 0;
	let selectedRarity = 'common';
	
	for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS)) {
		cumulativeWeight += weight;
		if (random <= cumulativeWeight) {
			selectedRarity = rarity;
			break;
		}
	}

	const cardsOfRarity = cards.filter(c => c.rarity.toLowerCase() === selectedRarity);
	if (cardsOfRarity.length === 0) {
		return cards[Math.floor(Math.random() * cards.length)];
	}
	
	return cardsOfRarity[Math.floor(Math.random() * cardsOfRarity.length)];
}

function parseCardList(str: string): { cardId: string; quantity: number }[] {
	return str.split(',').map(item => {
		const [cardId, qty] = item.trim().split(':');
		return { cardId, quantity: parseInt(qty) || 1 };
	}).filter(item => item.cardId);
}

/**
 * Generates a realistic, 10-card booster pack from a specific set.
 * This simulates rarity slots for a balanced and authentic experience.
 * @param setId The ID of the set to generate a pack from (e.g., 'base1').
 * @returns An array of TCGCard objects, or null if the set is not found.
 */
async function generatePack(setId: string): Promise<TCGCard[] | null> {
	const setCards = await TCGCards.find({ set: toID(setId) });
	if (setCards.length === 0) {
		return null; // Set not found or has no cards
	}

	// 1. Create pools of cards based on rarity
	const commons = setCards.filter(c => c.rarity === 'Common');
	const uncommons = setCards.filter(c => c.rarity === 'Uncommon');
	// Pool for the "Rare slot" - anything 'Rare' or better
	const raresPool = setCards.filter(c => c.rarity.includes('Rare'));

	// Simple fallback if pools are empty
	if (commons.length === 0 || uncommons.length === 0 || raresPool.length === 0) {
		return null; // Set is missing cards of required rarities
	}

	const pack: TCGCard[] = [];
	const usedCardIds = new Set<string>();

	// Helper to pick a random card without duplicates
	const pickRandom = (pool: TCGCard[]): TCGCard => {
		let attempts = 0;
		while (attempts < 50) {
			const randomCard = pool[Math.floor(Math.random() * pool.length)];
			if (!usedCardIds.has(randomCard.cardId)) {
				usedCardIds.add(randomCard.cardId);
				return randomCard;
			}
			attempts++;
		}
		// If we can't find a unique card after 50 tries, just return a random one
		return pool[Math.floor(Math.random() * pool.length)];
	};

	// 2. Define pack structure and fill slots
	// Modern packs are often 4 commons, 3 uncommons, 2 reverse holos, 1 rare
	// We'll simplify to 5 commons, 3 uncommons, 1 "special", 1 rare slot
	
	// 5 Commons
	for (let i = 0; i < 5; i++) pack.push(pickRandom(commons));
	// 3 Uncommons
	for (let i = 0; i < 3; i++) pack.push(pickRandom(uncommons));
	
	// 1 Reverse Holo slot (simplified: we'll pick another Uncommon)
	pack.push(pickRandom(uncommons));

	// 3. The "Rare Slot" - with weighted probabilities
	const hitRoll = Math.random() * 100;
	let chosenRarityTier: string;

	if (hitRoll <= 50) { // 50% chance for a regular Rare
		chosenRarityTier = 'Rare';
	} else if (hitRoll <= 75) { // 25% chance for a Rare Holo
		chosenRarityTier = 'Rare Holo';
	} else if (hitRoll <= 90) { // 15% chance for an "Ultra Rare" tier
		const ultraRares = ['Rare Ultra', 'Illustration Rare', 'Rare Holo V', 'Rare Holo VMAX', 'Rare Holo VSTAR'];
		chosenRarityTier = ultraRares[Math.floor(Math.random() * ultraRares.length)];
	} else { // 5% chance for a "Secret Rare" tier
		const secretRares = ['Rare Secret', 'Special Illustration Rare', 'Hyper Rare', 'Rare Rainbow'];
		chosenRarityTier = secretRares[Math.floor(Math.random() * secretRares.length)];
	}

	let hitPool = raresPool.filter(c => c.rarity === chosenRarityTier);
	// Fallback mechanism if the chosen rarity doesn't exist in the set
	if (hitPool.length === 0) hitPool = raresPool.filter(c => c.rarity === 'Rare Holo');
	if (hitPool.length === 0) hitPool = raresPool.filter(c => c.rarity === 'Rare');
	if (hitPool.length === 0) hitPool = raresPool; // Last resort

	pack.push(pickRandom(hitPool));
	
	return pack;
}


async function createTradeOffer(context: any, user: User, args: string[]) {
	const [targetUser, offeredCardsStr, requestedCardsStr] = args;
	
	if (!targetUser || !offeredCardsStr || !requestedCardsStr) {
		return context.errorReply('Usage: /tcg trade offer, [user], [cardId:qty,cardId:qty], [cardId:qty,cardId:qty]');
	}

	const userId = toID(user.name);
	const targetId = toID(targetUser);

	if (userId === targetId) {
		return context.errorReply("You can't trade with yourself!");
	}

	const offeredCards = parseCardList(offeredCardsStr);
	const requestedCards = parseCardList(requestedCardsStr);

	if (offeredCards.length === 0 || requestedCards.length === 0) {
		return context.errorReply('Invalid card format. Use: cardId:quantity,cardId:quantity');
	}

	try {
		const userCollection = await UserCollections.findOne({ userId });
		if (!userCollection) {
			return context.errorReply("You don't have any cards to trade!");
		}

		for (const offer of offeredCards) {
			const card = userCollection.cards.find(c => c.cardId === offer.cardId);
			if (!card || card.quantity < offer.quantity) {
				return context.errorReply(`You don't have enough of card ${offer.cardId}. You have ${card?.quantity || 0}, need ${offer.quantity}.`);
			}
		}

		const tradeId = Impulse.generateRandomString(8);
		const trade: TradeOffer = {
			tradeId,
			fromUser: userId,
			toUser: targetId,
			offeredCards,
			requestedCards,
			status: 'pending',
			createdAt: Date.now(),
			expiresAt: Date.now() + (24 * 60 * 60 * 1000),
		};

		await TradeOffers.insertOne(trade);

		context.sendReply(`Trade offer sent to ${targetUser}! Trade ID: ${tradeId}`);
		
		const targetUserObj = Users.get(targetId);
		if (targetUserObj) {
			targetUserObj.sendTo(
				context.room,
				`|html|${user.name} has sent you a trade offer! Use /tcg trade list to view it.`
			);
		}

		return true;
	} catch (e: any) {
		return context.errorReply(`Error creating trade: ${e.message}`);
	}
}

async function acceptTrade(context: any, user: User, tradeId: string) {
	if (!tradeId) {
		return context.errorReply("You need to specify a Trade ID to accept.");
	}
	
	const userId = user.id;
	
	// This is just a blueprint - the actual card swapping logic is complex.
	// You will need to write the logic to add/remove cards from each user's collection.
	
	try {
		const trade = await TradeOffers.findOne({ tradeId: tradeId.trim(), toUser: userId, status: 'pending' });
		if (!trade) {
			return context.errorReply(`Trade with ID "${tradeId}" not found, or it is not for you.`);
		}
		
		// --- LOGIC TO UPDATE STATS WOULD GO HERE ---

		// 1. Get the collections for both users in the trade
		const fromUserCollection = await UserCollections.findOne({ userId: trade.fromUser });
		const toUserCollection = await UserCollections.findOne({ userId: trade.toUser });

		if (!fromUserCollection || !toUserCollection) {
			return context.errorReply("Could not find collection for one of the users.");
		}
		
		// 2. Calculate the total number of cards each person is trading away
		const fromUserTradedCount = trade.offeredCards.reduce((sum, card) => sum + card.quantity, 0);
		const toUserTradedCount = trade.requestedCards.reduce((sum, card) => sum + card.quantity, 0);

		// 3. Update the `totalCardsTraded` stat for each user
		fromUserCollection.stats.totalCardsTraded = (fromUserCollection.stats.totalCardsTraded || 0) + fromUserTradedCount;
		toUserCollection.stats.totalCardsTraded = (toUserCollection.stats.totalCardsTraded || 0) + toUserTradedCount;
		
		// 4. Here you would implement the card swapping logic...
		// ... remove offeredCards from fromUser, add them to toUser
		// ... remove requestedCards from toUser, add them to fromUser

		// 5. After swapping cards, save the updated collections to the database
		await UserCollections.updateOne({ userId: trade.fromUser }, fromUserCollection);
		await UserCollections.updateOne({ userId: trade.toUser }, toUserCollection);
		
		// 6. Mark the trade as accepted
		await TradeOffers.updateOne({ tradeId: trade.tradeId }, { $set: { status: 'accepted' } });
		
		context.sendReply(`Trade with ${trade.fromUser} successfully completed!`);

	} catch (e: any) {
		context.errorReply(`An error occurred while accepting the trade: ${e.message}`);
	}
	
	// The full implementation is complex and requires careful handling of card quantities.
	// For now, this placeholder shows how the stats would be updated.
	return context.sendReply('Trade acceptance feature - implementation continues...');
}

async function rejectTrade(context: any, user: User, tradeId: string) {
	return context.sendReply('Trade rejection feature - implementation continues...');
}

async function cancelTrade(context: any, user: User, tradeId: string) {
	return context.sendReply('Trade cancellation feature - implementation continues...');
}

async function listTrades(context: any, user: User) {
	const userId = toID(user.name);

	try {
		const trades = await TradeOffers.find({
			$or: [
				{ fromUser: userId, status: 'pending' },
				{ toUser: userId, status: 'pending' },
			],
		});

		if (trades.length === 0) {
			return context.sendReply("You don't have any pending trades.");
		}

		let output = `<div class="themed-table-container">`;
		output += `<h3 class="themed-table-title">Your Pending Trades</h3>`;
		output += `<table class="themed-table">`;
		output += `<tr class="themed-table-header"><th>Trade ID</th><th>Type</th><th>With</th><th>Offered</th><th>Requested</th><th>Expires</th></tr>`;

		trades.forEach(trade => {
			const isOutgoing = trade.fromUser === userId;
			const otherUser = isOutgoing ? trade.toUser : trade.fromUser;
			const expiresIn = Math.round((trade.expiresAt - Date.now()) / (1000 * 60 * 60));

			output += `<tr class="themed-table-row">`;
			output += `<td>${trade.tradeId}</td>`;
			output += `<td>${isOutgoing ? 'Outgoing' : 'Incoming'}</td>`;
			output += `<td>${Impulse.nameColor(otherUser)}</td>`;
			output += `<td>${trade.offeredCards.length} cards</td>`;
			output += `<td>${trade.requestedCards.length} cards</td>`;
			output += `<td>${expiresIn}h</td>`;
			output += `</tr>`;
		});

		output += `</table></div>`;
		return context.sendReplyBox(output);
	} catch (e: any) {
		return context.errorReply(`Error listing trades: ${e.message}`);
	}
}

// ==================== COMMANDS ====================

export const commands: Chat.ChatCommands = {
	tcg: 'pokemontcg',
	pokemontcg: {
		''(target, room, user) {
			return this.parse('/help pokemontcg');
		},

		async addcard(target, room, user) {
			if (!this.can('gdeclare')) return false;
			const parts = target.split(',').map(x => x.trim());
			
			if (parts.length < 6) {
				return this.errorReply('Usage: /tcg addcard [cardId], [name], [set], [rarity], [supertype], [subtypes], [type], [hp]');
			}

			const [cardId, name, set, rarity, supertype, subtypesStr, type, hp] = parts;

			try {
				const subtypes = subtypesStr ? subtypesStr.split('/').map(s => s.trim()) : [];
				
				await TCGCards.upsert(
					{ cardId },
					{
						cardId,
						name,
						set,
						rarity,
						supertype,
						subtypes,
						type: type || undefined,
						hp: hp ? parseInt(hp) : undefined,
						stage: subtypes.includes('Basic') ? 'basic' : subtypes.includes('Stage 1') ? 'stage1' : subtypes.includes('Stage 2') ? 'stage2' : undefined,
					}
				);
				return this.sendReply(`Card "${name}" (${cardId}) has been added to the TCG database.`);
			} catch (e: any) {
				return this.errorReply(`Error adding card: ${e.message}`);
			}
		},

		async collection(target, room, user) {
			if (!this.runBroadcast()) return;
			const parts = target.split(',').map(p => p.trim());
			const targetUsername = parts[0] || user.name;
			const targetId = toID(targetUsername);

			const query: any = {};

			// --- Filter Parsing ---
			if (parts.length > 1) {
				const filters = parts.slice(1);
				for (const filter of filters) {
					const [key, ...valueParts] = filter.split(':');
					const value = valueParts.join(':').trim();

					if (!key || !value) continue;

					// Reuse search logic for filters
					switch (toID(key)) {
						case 'name': case 'set': case 'rarity': case 'supertype': case 'stage':
							query[toID(key)] = { $regex: value, $options: 'i' };
							break;
						case 'type':
							query.type = value;
							break;
						case 'subtype':
							query.subtypes = { $regex: value, $options: 'i' };
							break;
						case 'hp':
							const match = value.match(/([<>=]+)?\s*(\d+)/);
							if (match) {
								const operator = match[1] || '=';
								const amount = parseInt(match[2]);
								if (isNaN(amount)) break;
								if (operator === '>') query.hp = { $gt: amount };
								else if (operator === '>=') query.hp = { $gte: amount };
								else if (operator === '<') query.hp = { $lt: amount };
								else if (operator === '<=') query.hp = { $lte: amount };
								else query.hp = amount;
							}
							break;
					}
				}
			}

			try {
				const collection = await UserCollections.findOne({ userId: targetId });
				if (!collection || collection.cards.length === 0) {
					return this.sendReplyBox(`${targetUsername} doesn't have any cards in their collection yet!`);
				}

				const userCardIds = collection.cards.map(c => c.cardId);
				query.cardId = { $in: userCardIds };
				
				const allOwnedCards = await TCGCards.find(query);
				const cardMap = new Map(allOwnedCards.map(c => [c.cardId, c]));

				let totalPoints = 0;
				for (const item of collection.cards) {
					const card = cardMap.get(item.cardId);
					if (card) {
						totalPoints += getCardPoints(card) * item.quantity;
					}
				}

				const filteredUserCards = collection.cards.filter(item => cardMap.has(item.cardId));

				// --- Sort by points, then rarity name ---
				filteredUserCards.sort((a, b) => {
					const cardA = cardMap.get(a.cardId);
					const cardB = cardMap.get(b.cardId);
					if (!cardA || !cardB) return 0;
					const pointsDiff = getCardPoints(cardB) - getCardPoints(cardA);
					if (pointsDiff !== 0) return pointsDiff;
					return cardA.rarity.localeCompare(cardB.rarity);
				});

				// --- Limit to the top 100 cards ---
				const top100Cards = filteredUserCards.slice(0, 100);

				let output = `<div class="themed-table-container">`;
				output += `<h3 class="themed-table-title">${Impulse.nameColor(targetUsername, true)}'s TCG Collection</h3>`;
				output += `<p><strong>Total Cards:</strong> ${collection.stats.totalCards} | <strong>Unique Cards:</strong> ${collection.stats.uniqueCards} | <strong>Total Points:</strong> ${totalPoints} | <strong>Cards Traded:</strong> ${collection.stats.totalCardsTraded || 0}</p>`;
				
				output += `<div style="max-height: 380px; overflow-y: auto;">`;
				output += `<table class="themed-table">`;
				output += `<tr class="themed-table-header"><th>Card</th><th>Set</th><th>Rarity</th><th>Type</th><th>Quantity</th></tr>`;

				top100Cards.forEach(item => {
					const card = cardMap.get(item.cardId);
					if (!card) return;
					
					output += `<tr class="themed-table-row">`;
					output += `<td><button name="send" value="/tcg card ${card.cardId}" style="background:none; border:none; padding:0; font-weight:bold; color:inherit; text-decoration:underline; cursor:pointer;">${card.name}</button></td>`;
					output += `<td>${card.set}</td>`;
					output += `<td><span style="color: ${getRarityColor(card.rarity)}">${card.rarity.toUpperCase()}</span></td>`;
					output += `<td>${card.type || card.supertype}</td>`;
					output += `<td>${item.quantity}</td>`;
					output += `</tr>`;
				});

				output += `</table>`;
				output += `</div>`;

				if (filteredUserCards.length > 100) {
					output += `<p style="text-align:center; margin-top: 8px;"><em>Showing top 100 of ${filteredUserCards.length} matching cards.</em></p>`;
				}
				
				output += `</div>`;

				return this.sendReplyBox(output);
			} catch (e: any) {
				return this.errorReply(`Error fetching collection: ${e.message}`);
			}
		},

		async openpack(target, room, user) {
			if (!target) {
				return this.errorReply("Please specify a set to open. Usage: /tcg openpack [set ID]");
			}
			
			const userId = user.id;
			const setId = toID(target);

			try {
				const pack = await generatePack(setId);
				if (!pack) {
					return this.errorReply(`Set with ID "${setId}" not found or is missing required card rarities. Use /tcg sets to see a list of sets.`);
				}

				const collection = await UserCollections.findOne({ userId }) || {
					userId,
					cards: [],
					stats: { totalCards: 0, uniqueCards: 0, totalPoints: 0, totalCardsTraded: 0 },
					tradeLocked: false,
					lastUpdated: Date.now(),
				};

				let pointsGained = 0;
				for (const card of pack) {
					pointsGained += getCardPoints(card); // Track points from this pack
					const existingCard = collection.cards.find(c => c.cardId === card.cardId);
					if (existingCard) {
						existingCard.quantity++;
					} else {
						collection.cards.push({ cardId: card.cardId, quantity: 1, addedAt: Date.now() });
					}
				}

				// Update all stats
				collection.stats.totalCards = (collection.stats.totalCards || 0) + pack.length;
				collection.stats.uniqueCards = collection.cards.length;
				collection.stats.totalPoints = (collection.stats.totalPoints || 0) + pointsGained;
				collection.lastUpdated = Date.now();

				await UserCollections.upsert({ userId }, collection);

				let output = `<div class="themed-table-container">`;
				output += `<h3 class="themed-table-title">🎴 ${user.name} opened a ${target.trim()} Pack!</h3>`;
				output += `<table class="themed-table">`;
				output += `<tr class="themed-table-header"><th>Card</th><th>Set</th><th>Rarity</th><th>Type</th></tr>`;

				pack.sort((a, b) => getCardPoints(b) - getCardPoints(a));

				pack.forEach(card => {
					output += `<tr class="themed-table-row">`;
					output += `<td><strong>${card.name}</strong></td>`;
					output += `<td>${card.set}</td>`;
					output += `<td><span style="color: ${getRarityColor(card.rarity)}">${card.rarity.toUpperCase()}</span></td>`;
					output += `<td>${card.type || card.supertype}</td>`;
					output += `</tr>`;
				});

				output += `</table></div>`;

				return this.sendReplyBox(output);
			} catch (e: any) {
				return this.errorReply(`Error opening pack: ${e.message}`);
			}
		},

		async trade(target, room, user) {
			const [action, ...args] = target.split(',').map(x => x.trim());

			if (!action) {
				return this.errorReply('Usage: /tcg trade [offer/accept/reject/cancel/list], [user], [your cards], [their cards]');
			}

			switch (toID(action)) {
				case 'offer':
					return this.runBroadcast(() => createTradeOffer(this, user, args));
				case 'accept':
					return this.runBroadcast(() => acceptTrade(this, user, args[0]));
				case 'reject':
					return this.runBroadcast(() => rejectTrade(this, user, args[0]));
				case 'cancel':
					return this.runBroadcast(() => cancelTrade(this, user, args[0]));
				case 'list':
					return this.runBroadcast(() => listTrades(this, user));
				default:
					return this.errorReply('Invalid trade action. Use: offer, accept, reject, cancel, or list.');
			}
		},

		async viewcard(target, room, user) {
			if (!this.runBroadcast()) return;
			if (!target) return this.errorReply("Please specify a card ID. Usage: /tcg viewcard [cardId]");

			const card = await TCGCards.findOne({ cardId: target.trim() });

			if (!card) {
				return this.errorReply(`Card with ID "${target}" not found.`);
			}

			const rarityColorHex = getRarityColor(card.rarity);
			const startColor = hexToRgba(rarityColorHex, 0.25);
			const endColor = hexToRgba(rarityColorHex, 0.1);
			const backgroundStyle = `background: linear-gradient(135deg, ${startColor}, ${endColor});`;

			const cardNumber = card.cardId.split('-')[1] || '??';
			const points = getCardPoints(card);

			let borderColor = rarityColorHex;
			let glowEffect = '';
			const specialSubtype = card.subtypes.find(s => SPECIAL_SUBTYPES[s]);
			if (specialSubtype && SPECIAL_SUBTYPES[specialSubtype]) {
				borderColor = SPECIAL_SUBTYPES[specialSubtype].color;
				if (SPECIAL_SUBTYPES[specialSubtype].glow) {
					glowEffect = `box-shadow: 0 0 12px ${borderColor}50;`;
				}
			}

			let output = `<div style="border: 2px solid ${borderColor}; ${glowEffect} border-radius: 8px; padding: 16px; overflow: hidden; ${backgroundStyle}">`;
			output += `<table style="width: 100%; border-collapse: collapse;"><tr>`;
			
			if (card.imageUrl) {
				output += `<td style="width: 210px; vertical-align: top; padding-right: 24px;">`;
				output += `<img src="${card.imageUrl}" alt="${card.name}" width="200" style="display: block; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">`;
				output += `</td>`;
			}

			output += `<td style="vertical-align: top; line-height: 1.7;">`;
			output += `<div style="font-size: 2em; font-weight: bold; margin-bottom: 8px;">${card.name}</div>`;
			output += `<div style="color: ${rarityColorHex}; font-weight: bold; font-size: 1.2em; margin-bottom: 20px;">${card.rarity}</div>`;
			output += `<div style="margin-bottom: 10px;"><strong>Set:</strong> ${card.set} #${cardNumber}</div>`;
			output += `<div style="margin-bottom: 10px;"><strong>ID:</strong> ${card.cardId}</div>`;
			output += `<div style="margin-bottom: 10px;"><strong>Type:</strong> ${card.type || card.supertype}</div>`;
			if (card.hp) {
				output += `<div style="margin-bottom: 10px;"><strong>HP:</strong> ${card.hp}</div>`;
			}
			output += `<div style="margin-top: 16px; font-size: 1.1em;"><strong>Points:</strong> ${points}</div>`;
			output += `</td>`;

			output += `</tr></table>`;
			output += `</div>`;

			return this.sendReplyBox(output);
		},

		async search(target, room, user) {
			if (!this.runBroadcast()) return;
			const CARDS_PER_PAGE = 20;

			if (!target) {
				return this.errorReply(`Usage: /tcg search [filter]:[value], [filter]:[value], ...`);
			}

			const filters = target.split(',').map(f => f.trim());
			const query: any = {};
			const searchTerms: string[] = [];
			let page = 1;

			const commandArgs = [];
			for (const filter of filters) {
				const [key, ...valueParts] = filter.split(':');
				const value = valueParts.join(':').trim();

				if (!key || !value) continue;

				if (toID(key) === 'page') {
					const pageNum = parseInt(value);
					if (!isNaN(pageNum) && pageNum > 0) {
						page = pageNum;
					}
					continue; 
				}

				commandArgs.push(filter);
				searchTerms.push(`<strong>${key}</strong>: "${value}"`);

				switch (toID(key)) {
					case 'name':
					case 'set':
					case 'rarity':
					case 'supertype':
					case 'stage':
						query[toID(key)] = { $regex: value, $options: 'i' };
						break;
					case 'type':
						query.type = value;
						break;
					case 'subtype':
						query.subtypes = { $regex: value, $options: 'i' };
						break;
					case 'hp':
						const match = value.match(/([<>=]+)?\s*(\d+)/);
						if (match) {
							const operator = match[1] || '=';
							const amount = parseInt(match[2]);
							if (isNaN(amount)) break;

							if (operator === '>') query.hp = { $gt: amount };
							else if (operator === '>=') query.hp = { $gte: amount };
							else if (operator === '<') query.hp = { $lt: amount };
							else if (operator === '<=') query.hp = { $lte: amount };
							else query.hp = amount;
						}
						break;
					default:
						return this.errorReply(`Invalid filter: "${key}". Valid filters are: name, set, rarity, type, supertype, subtype, hp, stage.`);
				}
			}

			if (Object.keys(query).length === 0) {
				return this.errorReply('No valid filters provided. Usage: /tcg search [filter]:[value]');
			}

			try {
				const allResults = await TCGCards.find(query);
				
				// --- NEW: Default sort by rarity (points) then by name ---
				allResults.sort((a, b) => {
					const pointsDiff = getCardPoints(b) - getCardPoints(a);
					if (pointsDiff !== 0) return pointsDiff;
					return a.name.localeCompare(b.name);
				});

				const totalResults = allResults.length;

				if (totalResults === 0) {
					return this.sendReply(`No cards found matching your criteria.`);
				}

				const startIndex = (page - 1) * CARDS_PER_PAGE;
				const paginatedResults = allResults.slice(startIndex, startIndex + CARDS_PER_PAGE);
				const totalPages = Math.ceil(totalResults / CARDS_PER_PAGE);

				let output = `<div class="themed-table-container">`;
				output += `<h3 class="themed-table-title">Search Results</h3>`;
				output += `<p><em>Searching for: ${searchTerms.join(', ')}</em></p>`;

				output += `<div style="max-height: 370px; overflow-y: auto;">`;
				output += `<table class="themed-table">`;
				output += `<tr class="themed-table-header"><th>Card ID</th><th>Name</th><th>Set</th><th>Rarity</th><th>Type</th><th>Subtypes</th><th>HP</th></tr>`;

				paginatedResults.forEach(card => {
					output += `<tr class="themed-table-row">`;
					output += `<td>${card.cardId}</td>`;
					output += `<td><button name="send" value="/tcg card ${card.cardId}" style="background:none; border:none; padding:0; font-weight:bold; color:inherit; text-decoration:underline; cursor:pointer;">${card.name}</button></td>`;
					output += `<td>${card.set}</td>`;
					output += `<td><span style="color: ${getRarityColor(card.rarity)}">${card.rarity.toUpperCase()}</span></td>`;
					output += `<td>${card.type || card.supertype}</td>`;
					output += `<td>${card.subtypes.join(', ')}</td>`;
					output += `<td>${card.hp || 'N/A'}</td>`;
					output += `</tr>`;
				});

				output += `</table>`;
				output += `</div>`;

				output += `<p style="text-align:center; margin-top: 8px;">`;
				output += `Showing ${paginatedResults.length} of ${totalResults} results.`;
				output += `</p>`;

				const commandString = `/tcg search ${commandArgs.join(', ')}`;

				output += `<div style="text-align: center; margin-top: 5px;">`;
				if (page > 1) {
					output += `<button name="send" value="${commandString}, page:${page - 1}" style="margin-right: 5px;">&laquo; Previous</button>`;
				}
				output += `<strong>Page ${page} of ${totalPages}</strong>`;
				if (startIndex + CARDS_PER_PAGE < totalResults) {
					output += `<button name="send" value="${commandString}, page:${page + 1}" style="margin-left: 5px;">Next &raquo;</button>`;
				}
				output += `</div>`;

				output += `</div>`;

				return this.sendReplyBox(output);
			} catch (e: any) {
				return this.errorReply(`Error searching: ${e.message}`);
			}
		},

		async stats(target, room, user) {
			if (!this.runBroadcast()) return;
			const sortBy = toID(target) || 'total';
			let sortQuery: any = { 'stats.totalCards': -1 };
			let sortLabel = 'Total Cards';

			switch (sortBy) {
				case 'unique':
					sortQuery = { 'stats.uniqueCards': -1 };
					sortLabel = 'Unique Cards';
					break;
				case 'points':
					sortQuery = { 'stats.totalPoints': -1 };
					sortLabel = 'Total Points';
					break;
				case 'traded':
					sortQuery = { 'stats.totalCardsTraded': -1 };
					sortLabel = 'Cards Traded';
					break;
				case 'total':
					// Default is already set
					break;
				default:
					return this.errorReply(`Invalid sort type. Use: total, unique, points, or traded.`);
			}

			try {
				const totalUsers = await UserCollections.count({});
				const totalCardsInDb = await TCGCards.count({});
				const totalTrades = await TradeOffers.count({ status: 'accepted' });

				const topCollectors = await UserCollections.findSorted({}, sortQuery, 5);

				let output = `<div class="themed-table-container">`;
				output += `<h3 class="themed-table-title">TCG Collection Statistics</h3>`;
				output += `<p><strong>Total Collectors:</strong> ${totalUsers} | <strong>Unique Cards in Database:</strong> ${totalCardsInDb} | <strong>Successful Trades:</strong> ${totalTrades}</p>`;
				
				if (topCollectors.length > 0) {
					output += `<h4>Top 5 Collectors by ${sortLabel}</h4>`;
					output += `<table class="themed-table">`;
					output += `<tr class="themed-table-header"><th>Rank</th><th>User</th><th>${sortLabel}</th></tr>`;

					topCollectors.forEach((collector, idx) => {
						let statValue = 0;
						switch (sortBy) {
							case 'unique':
								statValue = collector.stats.uniqueCards;
								break;
							case 'points':
								statValue = collector.stats.totalPoints || 0;
								break;
							case 'traded':
								statValue = collector.stats.totalCardsTraded || 0;
								break;
							default:
								statValue = collector.stats.totalCards;
								break;
						}

						output += `<tr class="themed-table-row">`;
						output += `<td>${idx + 1}</td>`;
						output += `<td>${Impulse.nameColor(collector.userId, true)}</td>`;
						output += `<td>${statValue}</td>`;
						output += `</tr>`;
					});

					output += `</table>`;
				}
				output += `</div>`;

				return this.sendReplyBox(output);
			} catch (e: any) {
				return this.errorReply(`Error fetching stats: ${e.message}`);
			}
		},

		async sets(target, room, user) {
			if (!this.runBroadcast()) return;
			let output = `<div class="themed-table-container">`;
			output += `<h3 class="themed-table-title">Pokemon TCG Sets</h3>`;
			
			output += `<div style="max-height: 380px; overflow-y: auto;">`;
			
			const seriesGroups = new Map<string, typeof POKEMON_SETS>();
			POKEMON_SETS.forEach(set => {
				if (!seriesGroups.has(set.series)) {
					seriesGroups.set(set.series, []);
				}
				seriesGroups.get(set.series)!.push(set);
			});

			seriesGroups.forEach((sets, series) => {
				output += `<h4 style="margin-top: 10px; margin-bottom: 5px;">${series} Series</h4>`;
				output += `<table class="themed-table">`;
				output += `<tr class="themed-table-header"><th>Code</th><th>Name</th><th>Year</th></tr>`;
				
				sets.forEach(set => {
					output += `<tr class="themed-table-row">`;
					output += `<td>${set.code}</td>`;
					output += `<td><strong>${set.name}</strong></td>`;
					output += `<td>${set.year}</td>`;
					output += `</tr>`;
				});
				
				output += `</table>`;
			});

			output += `</div>`;

			output += `</div>`;
			return this.sendReplyBox(output);
		},

		async rarities(target, room, user) {
			let output = `<div class="themed-table-container">`;
			output += `<h3 class="themed-table-title">Pokemon TCG Rarities</h3>`;
			
			output += `<div style="max-height: 380px; overflow-y: auto;">`;
			
			output += `<ul style="list-style: none; padding: 10px;">`;
			
			RARITIES.forEach(rarity => {
				output += `<li><span style="color: ${getRarityColor(rarity)}; font-weight: bold;">●</span> ${rarity}</li>`;
			});
			
			output += `</ul>`;
			
			output += `</div>`;
			
			output += `</div>`;
			return this.sendReplyBox(output);
		},

		async types(target, room, user) {
			let output = `<div class="themed-table-container">`;
			output += `<h3 class="themed-table-title">Pokemon TCG Data</h3>`;
			
			output += `<h4>Supertypes</h4>`;
			output += `<p>${SUPERTYPES.join(', ')}</p>`;
			
			output += `<h4>Pokemon Types</h4>`;
			output += `<p>${POKEMON_TYPES.join(', ')}</p>`;
			
			output += `<h4>Pokemon Subtypes</h4>`;
			output += `<p>${SUBTYPES.Pokemon.join(', ')}</p>`;
			
			output += `<h4>Trainer Subtypes</h4>`;
			output += `<p>${SUBTYPES.Trainer.join(', ')}</p>`;
			
			output += `<h4>Energy Subtypes</h4>`;
			output += `<p>${SUBTYPES.Energy.join(', ')}</p>`;
			
			output += `</div>`;
			return this.sendReplyBox(output);
		},
	},

	tcghelp: [
		'/tcg collection [user] - View a user\'s TCG card collection.',
		'/tcg card [cardId] - View the details of a specific card.',
		'/tcg openpack [set ID] - Open a pack of 10 cards from a specific set.',
		'/tcg search [filter]:[value] - Search for cards in the database.',
		'/tcg trade offer, [user], [your cards], [their cards] - Offer a trade.',
		'/tcg trade list - View your pending trades.',
		'/tcg trade accept/reject/cancel [tradeId] - Manage trade offers.',
		'/tcg stats - View global TCG statistics.',
		'/tcg sets - View all Pokemon TCG sets.',
		'/tcg rarities - View all card rarities.',
		'/tcg types - View all supertypes, types, and subtypes.',
		'% /tcg addcard [id], [name], [set], [rarity], [supertype], [subtypes], [type], [hp] - Add a card to the database.',
	],
};
