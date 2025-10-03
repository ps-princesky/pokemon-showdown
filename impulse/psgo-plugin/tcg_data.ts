/**
 * TCG Data File
 * Contains static data arrays, type interfaces, and data-related display functions.
 */

// --- TYPE INTERFACES ---
export interface TCGCard {
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

export interface UserCollection {
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
		totalPoints?: number; 
	};
	currency?: number;
	wishlist?: string[];
	lastUpdated: number;
	lastDaily?: number;
}

export interface TCGSet {
	code: string;
	name: string;
	year: number;
	series: string;
}

// --- DATA CONSTANTS ---
export const SUPERTYPES = [
	'Pokémon',
	'Trainer',
	'Energy',
];

export const POKEMON_TYPES = [
	'Grass', 'Fire', 'Water', 'Lightning', 'Psychic', 'Fighting',
	'Darkness', 'Metal', 'Fairy', 'Dragon', 'Colorless',
];

export const SUBTYPES = {
	Pokemon: [
		'Amazing', 'Ancient', 'Baby', 'Basic', 'BREAK', 'Crystal Pokémon',
		'Dark Pokémon', 'ex', 'EX', 'Fusion Strike', 'Future', 'GX', 'LEGEND',
		'Level-Up', 'Light Pokémon', 'Mega', 'Owner\'s Pokémon', 'Prime', 'Prism Star',
		'Radiant', 'Rapid Strike', 'Restored', 'Shining', 'Single Strike', 'SP',
		'Stage 1', 'Stage 2', 'TAG TEAM', 'Team Aqua', 'Team Magma', 'Team Plasma',
		'Tera', 'Ultra Beast', 'V', 'V-UNION', 'VMAX', 'VSTAR',
	],
	Trainer: [
		'ACE SPEC', 'Ancient', 'Fossil', 'Future', 'Goldenrod Game Corner', 'Item',
		'Pokémon Tool', 'Rocket\'s Secret Machine', 'Stadium', 'Supporter', 'Technical Machine',
	],
	Energy: [
		'Basic', 'Special',
	],
};

export const RARITIES = [
	'Common', 'Uncommon', 'Rare', 'Rare Holo', 'Reverse Holo', '1st Edition',
	'Shadowless', 'Rare Holo 1st Edition', 'Shining', 'Gold Star', 'Rare Holo LV.X',
	'Rare ex', 'Rare SP', 'Rare Prime', 'LEGEND', 'Rare BREAK', 'Prism Star', 'Rare Holo EX',
	'Rare Holo GX', 'Rare Holo V', 'Rare Holo VMAX', 'Rare Holo VSTAR', 'Full Art',
	'Rare Ultra', 'Illustration Rare', 'Special Illustration Rare', 'Character Rare',
	'Character Super Rare', 'Trainer Gallery', 'Shiny Rare', 'Rare Shiny', 'Shiny Ultra Rare',
	'Rare Shiny GX', 'Radiant Rare', 'Amazing Rare', 'Rare Secret', 'Rare Rainbow',
	'Gold Full Art', 'Rare Gold', 'Hyper Rare', 'Promo', 'Black Star Promo',
	'Classic Collection', 'ACE SPEC Rare', 'Rare ACE', 'Double Rare',
];

export const SPECIAL_SUBTYPES: { [key: string]: { color: string; glow?: boolean } } = {
	'VMAX': { color: '#C0392B', glow: true }, 'VSTAR': { color: '#8E44AD', glow: true },
	'V-UNION': { color: '#6a5acd', glow: true }, 'V': { color: '#E74C3C', glow: true },
	'GX': { color: '#E67E22', glow: true }, 'ex': { color: '#95a5a6', glow: true },
	'Tera': { color: '#3498db', glow: true }, 'Radiant': { color: '#FF6B6B', glow: true },
	'TAG TEAM': { color: '#2980b9', glow: true }, 'Ancient': { color: '#a67b5b', glow: true },
	'Future': { color: '#8e44ad', glow: true }, 'SP': { color: '#7f8c8d', glow: true },
	'Dark Pokémon': { color: '#5d6d7e', glow: true }, 'Light Pokémon': { color: '#add8e6', glow: true },
	'Team Aqua': { color: '#3498db', glow: true }, 'Team Magma': { color: '#e74c3c', glow: true },
	'Team Plasma': { color: '#00a8ff', glow: true }, 'EX': { color: '#d35400', glow: true },
	'BREAK': { color: '#e67e22', glow: true }, 'LEGEND': { color: '#CD853F', glow: true },
	'Prime': { color: '#e67e22', glow: true }, 'ACE SPEC': { color: '#F39C12', glow: true },
	'Prism Star': { color: '#e91e63', glow: true }, 'Amazing': { color: '#00CED1', glow: true },
	'Shining': { color: '#00BFFF', glow: true }, 'Baby': { color: '#ffb6c1', glow: true },
	'Crystal Pokémon': { color: '#AFEEEE', glow: true }, 'Level-Up': { color: '#a9a9a9', glow: true },
	'Mega': { color: '#b22222', glow: true }, 'Owner\'s Pokémon': { color: '#696969', glow: true },
	'Restored': { color: '#cd853f', glow: true }, 'Ultra Beast': { color: '#dc143c', glow: true },
	'Fusion Strike': { color: '#DA70D6', glow: true }, 'Rapid Strike': { color: '#1E90FF', glow: true },
	'Single Strike': { color: '#c23616', glow: true },
};

export const POKEMON_SETS: TCGSet[] = [
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
	
	// ... (rest of sets array) ...
];

// --- HELPER FUNCTIONS ---
export function getRarityColor(rarity: string): string {
	const colors: {[key: string]: string} = {
		'common': '#808080','uncommon': '#2ECC71','rare': '#3498DB','double rare': '#3CB371',
		'rare holo': '#9B59B6','reverse holo': '#00CED1','classic collection': '#4682B4','1st edition': '#34495e',
		'shadowless': '#7f8c8d','rare holo 1st edition': '#8e44ad','shining': '#00BFFF','gold star': '#CD853F',
		'rare holo star': '#CD853F','rare holo lv.x': '#95a5a6','rare ex': '#bdc3c7','rare sp': '#a1a1a1',
		'rare prime': '#e67e22','legend': '#CD853F','rare break': '#CD853F','prism star': '#e91e63',
		'rare holo ex': '#d35400','rare holo gx': '#E67E22','rare holo v': '#E74C3C','rare holo vmax': '#C0392B',
		'rare holo vstar': '#8E44AD','full art': '#E74C3C','rare ultra': '#E74C3C','illustration rare': '#4ECDC4',
		'special illustration rare': '#C71585','character rare': '#ff9ff3','character super rare': '#ff69b4',
		'trainer gallery': '#1abc9c','shiny rare': '#CD853F','rare shiny': '#CD853F','shiny ultra rare': '#9932CC',
		'rare shiny gx': '#1E90FF','radiant rare': '#FF6B6B','amazing rare': '#00CED1','rare secret': '#F39C12',
		'rare rainbow': '#E91E63','gold full art': '#CD853F','rare gold': '#CD853F','hyper rare': '#FF10F0',
		'promo': '#c0392b','black star promo': '#2c3e50','ace spec rare': '#F39C12','rare ace': '#F39C12',
	};
	return colors[rarity.toLowerCase()] || '';
}

export function getSubtypeColor(subtype: string): string {
	const colors: {[key: string]: string} = {
		'VMAX': '#C0392B','VSTAR': '#8E44AD','V-UNION': '#6a5acd','V': '#E74C3C','GX': '#E67E22',
		'EX': '#d35400','ex': '#95a5a6','Tera': '#3498db','Radiant': '#FF6B6B','TAG TEAM': '#2980b9',
		'Ancient': '#a67b5b','Future': '#8e44ad','SP': '#7f8c8d','Dark Pokémon': '#5d6d7e','Light Pokémon': '#add8e6',
		'Team Aqua': '#3498db','Team Magma': '#e74c3c','Team Plasma': '#00a8ff','BREAK': '#e67e22','LEGEND': '#CD853F',
		'Prime': '#e67e22','ACE SPEC': '#F39C12','Prism Star': '#e91e63','Shining': '#00BFFF','Amazing': '#00CED1',
		'Baby': '#ffb6c1','Crystal Pokémon': '#AFEEEE','Level-Up': '#a9a9a9','Mega': '#b22222',
		'Owner\'s Pokémon': '#696969','Restored': '#cd853f','Ultra Beast': '#dc143c','Fusion Strike': '#DA70D6',
		'Rapid Strike': '#1E90FF','Single Strike': '#c23616',
	};
	return colors[subtype] || '';
}
