/**
 * Pokemon TCG Collection Plugin
 * Allows users to collect and manage Pokemon TCG cards
 * @license MIT
 */

import { MongoDB } from '../../impulse/mongodb_module';
import { POKEMON_SETS, TCGSet } from './tcg_data'; // Import the sets data

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
		totalPoints?: number; 
	};
	lastUpdated: number;
}

// Initialize collections
const TCGCards = MongoDB<TCGCard>('tcg_cards');
const UserCollections = MongoDB<UserCollection>('tcg_user_collections');

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
		'Amazing',
		'Ancient',
		'Baby',
		'Basic',
		'BREAK',
		'Crystal Pokémon',
		'Dark Pokémon',
		'ex', // Lowercase for modern Scarlet & Violet ex
		'EX', // Uppercase for older Black & White / XY EX
		'Fusion Strike',
		'Future',
		'GX',
		'LEGEND',
		'Level-Up',
		'Light Pokémon',
		'Mega',
		'Owner\'s Pokémon',
		'Prime',
		'Prism Star',
		'Radiant',
		'Rapid Strike',
		'Restored',
		'Shining',
		'Single Strike',
		'SP', // Special Pokémon from Diamond & Pearl / Platinum
		'Stage 1',
		'Stage 2',
		'TAG TEAM',
		'Team Aqua',
		'Team Magma',
		'Team Plasma',
		'Tera',
		'Ultra Beast',
		'V',
		'V-UNION',
		'VMAX',
		'VSTAR',
	],
	Trainer: [
		'ACE SPEC',
		'Ancient',
		'Fossil',
		'Future',
		'Goldenrod Game Corner',
		'Item',
		'Pokémon Tool',
		'Rocket\'s Secret Machine',
		'Stadium',
		'Supporter',
		'Technical Machine',
	],
	Energy: [
		'Basic',
		'Special',
	],
};

const RARITIES = [
	// Core Rarities
	'Common',
	'Uncommon',
	'Rare',

	// Holo Variations
	'Rare Holo',
	'Reverse Holo',

	// Classic & First Edition
	'1st Edition',
	'Shadowless',
	'Rare Holo 1st Edition',

	// Special Mechanics & Eras
	'Shining',
	'Gold Star',
	'Rare Holo LV.X',
	'Rare ex',
	'Rare SP',
	'Rare Prime',
	'LEGEND',
	'Rare BREAK',
	'Prism Star',

	// Modern "Rule Box" Pokémon
	'Rare Holo EX',
	'Rare Holo GX',
	'Rare Holo V',
	'Rare Holo VMAX',
	'Rare Holo VSTAR',
	
	// Ultra Rare Tiers (Full Arts & Alternates)
	'Full Art',
	'Rare Ultra',
	'Illustration Rare',
	'Special Illustration Rare',
	'Character Rare',
	'Character Super Rare',
	'Trainer Gallery',
	
	// Shiny Tiers
	'Shiny Rare',
	'Rare Shiny',
	'Shiny Ultra Rare',
	'Rare Shiny GX',
	'Radiant Rare',
	'Amazing Rare',

	// Secret & Gold Tiers
	'Rare Secret',
	'Rare Rainbow',
	'Gold Full Art',
	'Rare Gold',
	'Hyper Rare',

	// Miscellaneous
	'Promo',
	'Black Star Promo',
	'Classic Collection',
	'ACE SPEC Rare',
	'Rare ACE',
	'Double Rare',
];

const SPECIAL_SUBTYPES: { [key: string]: { color: string; glow?: boolean } } = {
	// Modern Mechanics
	'VMAX': { color: '#C0392B', glow: true },
	'VSTAR': { color: '#8E44AD', glow: true },
	'V-UNION': { color: '#6a5acd', glow: true },
	'V': { color: '#E74C3C', glow: true },
	'GX': { color: '#E67E22', glow: true },
	'ex': { color: '#95a5a6', glow: true },
	'Tera': { color: '#3498db', glow: true },
	'Radiant': { color: '#FF6B6B', glow: true },
	'TAG TEAM': { color: '#2980b9', glow: true },
	
	// Eras & Themes
	'Ancient': { color: '#a67b5b', glow: true },
	'Future': { color: '#8e44ad', glow: true },
	'SP': { color: '#7f8c8d', glow: true },
	'Dark Pokémon': { color: '#5d6d7e', glow: true },
	'Light Pokémon': { color: '#add8e6', glow: true },
	'Team Aqua': { color: '#3498db', glow: true },
	'Team Magma': { color: '#e74c3c', glow: true },
	'Team Plasma': { color: '#00a8ff', glow: true },

	// Other Special Types
	'EX': { color: '#d35400', glow: true },
	'BREAK': { color: '#e67e22', glow: true },
	'LEGEND': { color: '#CD853F', glow: true },
	'Prime': { color: '#e67e22', glow: true },
	'ACE SPEC': { color: '#F39C12', glow: true },
	'Prism Star': { color: '#e91e63', glow: true },
	'Amazing': { color: '#00CED1', glow: true },
	'Shining': { color: '#00BFFF', glow: true },
	'Baby': { color: '#ffb6c1', glow: true },
	'Crystal Pokémon': { color: '#AFEEEE', glow: true },
	'Level-Up': { color: '#a9a9a9', glow: true },
	'Mega': { color: '#b22222', glow: true },
	'Owner\'s Pokémon': { color: '#696969', glow: true },
	'Restored': { color: '#cd853f', glow: true },
	'Ultra Beast': { color: '#dc143c', glow: true },
	'Fusion Strike': { color: '#DA70D6', glow: true },
	'Rapid Strike': { color: '#1E90FF', glow: true },
	'Single Strike': { color: '#c23616', glow: true },
};

// ==================== HELPER FUNCTIONS ====================

function getCardPoints(card: TCGCard): number {
	switch (card.rarity) {
		// Tier 1: Common Pulls
		case 'Common':
		case '1st Edition':
		case 'Shadowless':
			return 5;
		case 'Uncommon':
			return 10;
		case 'Reverse Holo':
			return 15;

		// Tier 2: Standard Rares
		case 'Rare':
			return 20;
		case 'Double Rare':
		case 'Promo':
		case 'Black Star Promo':
			return 25;
		case 'Rare Holo':
		case 'Classic Collection':
			return 30;
		case 'Rare Holo 1st Edition':
			return 35;

		// Tier 3: Holo Rule Box Cards (V, GX, EX, etc.)
		case 'Rare SP':
			return 40;
		case 'Rare Holo EX':
		case 'Rare Holo GX':
		case 'Rare Holo V':
			return 45;
		case 'Rare BREAK':
		case 'Rare Prime':
		case 'LEGEND':
		case 'Prism Star':
			return 50;
		case 'Rare Holo VMAX':
		case 'Rare Holo VSTAR':
			return 55;
		case 'Rare ex': // Older, valuable ex cards
			return 60;
			
		// Tier 4: Special Rarity Cards
		case 'Radiant Rare':
			return 60;
		case 'Amazing Rare':
		case 'Shining':
			return 65;
		case 'ACE SPEC Rare':
		case 'Rare ACE':
			return 70;
		
		// Tier 5: Full Art & Illustration Rares
		case 'Full Art':
		case 'Rare Ultra': // Standard Full Arts
			return 75;
		case 'Rare Shiny':
		case 'Shiny Rare':
			return 80;
		case 'Trainer Gallery':
		case 'Character Rare':
		case 'Rare Shiny GX':
		case 'Shiny Ultra Rare':
			return 85;
		case 'Illustration Rare':
			return 90;
		case 'Rare Holo LV.X':
			return 95;
		case 'Rare Holo Star':
			return 100;
		case 'Character Super Rare':
			return 110;
			
		// Tier 6: Secret & Hyper Rares (Highest Value)
		case 'Rare Secret':
			return 120;
		case 'Special Illustration Rare':
			return 150;
		case 'Rare Rainbow':
			return 160;
		case 'Gold Full Art':
		case 'Rare Gold':
		case 'Hyper Rare': // Gold Cards
			return 175;
		case 'Gold Star':
			return 200;

		default:
			return 5;
	}
}

function hexToRgba(hex: string, alpha: number): string {
	if (!/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
		return `rgba(128, 128, 128, ${alpha})`;
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

function getSubtypeColor(subtype: string): string {
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

async function generatePack(setId: string): Promise<TCGCard[] | null> {
	const setCards = await TCGCards.find({ set: setId });
	if (setCards.length === 0) return null;

	const commons = setCards.filter(c => c.rarity === 'Common');
	const uncommons = setCards.filter(c => c.rarity === 'Uncommon');
	const raresPool = setCards.filter(c => c.rarity.includes('Rare'));

	if (commons.length === 0 || uncommons.length === 0 || raresPool.length === 0) return null;

	const pack: TCGCard[] = [];
	const usedCardIds = new Set<string>();

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
		return pool[Math.floor(Math.random() * pool.length)];
	};

	for (let i = 0; i < 5; i++) pack.push(pickRandom(commons));
	for (let i = 0; i < 3; i++) pack.push(pickRandom(uncommons));
	pack.push(pickRandom(uncommons));

	const hitRoll = Math.random() * 100;
	let chosenRarityTier: string;

	if (hitRoll <= 50) chosenRarityTier = 'Rare';
	else if (hitRoll <= 75) chosenRarityTier = 'Rare Holo';
	else if (hitRoll <= 90) {
		const ultraRares = ['Rare Ultra', 'Illustration Rare', 'Rare Holo V', 'Rare Holo VMAX', 'Rare Holo VSTAR'];
		chosenRarityTier = ultraRares[Math.floor(Math.random() * ultraRares.length)];
	} else {
		const secretRares = ['Rare Secret', 'Special Illustration Rare', 'Hyper Rare', 'Rare Rainbow'];
		chosenRarityTier = secretRares[Math.floor(Math.random() * secretRares.length)];
	}

	let hitPool = raresPool.filter(c => c.rarity === chosenRarityTier);
	if (hitPool.length === 0) hitPool = raresPool.filter(c => c.rarity === 'Rare Holo');
	if (hitPool.length === 0) hitPool = raresPool.filter(c => c.rarity === 'Rare');
	if (hitPool.length === 0) hitPool = raresPool;

	pack.push(pickRandom(hitPool));
	
	return pack;
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
						cardId, name, set, rarity, supertype, subtypes,
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

			if (parts.length > 1) {
				const filters = parts.slice(1);
				for (const filter of filters) {
					const [key, ...valueParts] = filter.split(':');
					const value = valueParts.join(':').trim();
					if (!key || !value) continue;
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

				query.cardId = { $in: collection.cards.map(c => c.cardId) };
				
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

				filteredUserCards.sort((a, b) => {
					const cardA = cardMap.get(a.cardId);
					const cardB = cardMap.get(b.cardId);
					if (!cardA || !cardB) return 0;
					const pointsDiff = getCardPoints(cardB) - getCardPoints(cardA);
					if (pointsDiff !== 0) return pointsDiff;
					return cardA.rarity.localeCompare(cardB.rarity);
				});

				const top100Cards = filteredUserCards.slice(0, 100);

				let output = `<div class="themed-table-container">`;
				output += `<h3 class="themed-table-title">${Impulse.nameColor(targetUsername, true)}'s TCG Collection</h3>`;
				output += `<p><strong>Total Cards:</strong> ${collection.stats.totalCards} | <strong>Unique Cards:</strong> ${collection.stats.uniqueCards} | <strong>Total Points:</strong> ${totalPoints}</p>`;
				
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

				this.sendReplyBox(output);
			} catch (e: any) {
				return this.errorReply(`Error fetching collection: ${e.message}`);
			}
		},

		async openpack(target, room, user) {
			if (!this.runBroadcast()) return;
			if (!target) {
				return this.errorReply("Please specify a set to open. Usage: /tcg openpack [set ID]");
			}
			
			const userId = user.id;
			const setId = target.trim().toLowerCase();

			try {
				const pack = await generatePack(setId);
				if (!pack) {
					return this.errorReply(`Set with ID "${target.trim()}" not found or is missing required card rarities. Use /tcg sets to see a list of sets.`);
				}

				const collection = await UserCollections.findOne({ userId }) || {
					userId,
					cards: [],
					stats: { totalCards: 0, uniqueCards: 0, totalPoints: 0 },
					lastUpdated: Date.now(),
				};

				let pointsGained = 0;
				for (const card of pack) {
					pointsGained += getCardPoints(card);
					const existingCard = collection.cards.find(c => c.cardId === card.cardId);
					if (existingCard) {
						existingCard.quantity++;
					} else {
						collection.cards.push({ cardId: card.cardId, quantity: 1, addedAt: Date.now() });
					}
				}

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
					output += `<td><button name="send" value="/tcg card ${card.cardId}" style="background:none; border:none; padding:0; font-weight:bold; color:inherit; text-decoration:underline; cursor:pointer;">${card.name}</button></td>`;
					output += `<td>${card.set}</td>`;
					output += `<td><span style="color: ${getRarityColor(card.rarity)}">${card.rarity.toUpperCase()}</span></td>`;
					output += `<td>${card.type || card.supertype}</td>`;
					output += `</tr>`;
				});

				output += `</table></div>`;

				this.sendReplyBox(output);
			} catch (e: any) {
				return this.errorReply(`Error opening pack: ${e.message}`);
			}
		},

		async card(target, room, user) {
			if (!this.runBroadcast()) return;
			if (!target) return this.errorReply("Please specify a card ID. Usage: /tcg card [cardId]");

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
			
			const formattedSubtypes = card.subtypes.map(s => {
				const color = getSubtypeColor(s);
				return color ? `<strong style="color: ${color}">${s}</strong>` : s;
			}).join(', ');

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
			if (card.subtypes.length > 0) {
				output += `<div style="margin-bottom: 10px;"><strong>Subtypes:</strong> ${formattedSubtypes}</div>`;
			}
			if (card.hp) {
				output += `<div style="margin-bottom: 10px;"><strong>HP:</strong> ${card.hp}</div>`;
			}
			output += `<div style="margin-top: 16px; font-size: 1.1em;"><strong>Points:</strong> ${points}</div>`;
			output += `</td>`;

			output += `</tr></table>`;
			output += `</div>`;

			this.sendReplyBox(output);
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
				const { data: paginatedResults, total: totalResults, pages: totalPages } = await TCGCards.findWithPagination(
					query,
					{
						page: page,
						limit: CARDS_PER_PAGE,
					}
				);

				if (totalResults === 0) {
					return this.sendReply(`No cards found matching your criteria.`);
				}

				paginatedResults.sort((a, b) => {
					const pointsDiff = getCardPoints(b) - getCardPoints(a);
					if (pointsDiff !== 0) return pointsDiff;
					return a.name.localeCompare(b.name);
				});


				let output = `<div class="themed-table-container">`;
				output += `<h3 class="themed-table-title">Search Results</h3>`;
				output += `<p><em>Searching for: ${searchTerms.join(', ')}</em></p>`;

				output += `<div style="max-height: 370px; overflow-y: auto;">`;
				output += `<table class="themed-table">`;
				output += `<tr class="themed-table-header"><th>Card ID</th><th>Name</th><th>Set</th><th>Rarity</th><th>Type</th><th>Subtypes</th><th>HP</th></tr>`;

				paginatedResults.forEach(card => {
					const formattedSubtypes = card.subtypes.map(s => {
						const color = getSubtypeColor(s);
						return color ? `<strong style="color: ${color}">${s}</strong>` : s;
					}).join(', ');

					output += `<tr class="themed-table-row">`;
					output += `<td>${card.cardId}</td>`;
					output += `<td><button name="send" value="/tcg card ${card.cardId}" style="background:none; border:none; padding:0; font-weight:bold; color:inherit; text-decoration:underline; cursor:pointer;">${card.name}</button></td>`;
					output += `<td>${card.set}</td>`;
					output += `<td><span style="color: ${getRarityColor(card.rarity)}">${card.rarity.toUpperCase()}</span></td>`;
					output += `<td>${card.type || card.supertype}</td>`;
					output += `<td>${formattedSubtypes}</td>`;
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
				if ((page * CARDS_PER_PAGE) < totalResults) {
					output += `<button name="send" value="${commandString}, page:${page + 1}" style="margin-left: 5px;">Next &raquo;</button>`;
				}
				output += `</div>`;

				output += `</div>`;

				this.sendReplyBox(output);
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
				case 'total':
					// Default is already set
					break;
				default:
					return this.errorReply(`Invalid sort type. Use: total, unique, or points.`);
			}

			try {
				const totalUsers = await UserCollections.count({});
				const totalCardsInDb = await TCGCards.count({});

				const topCollectors = await UserCollections.findSorted({}, sortQuery, 5);

				let output = `<div class="themed-table-container">`;
				output += `<h3 class="themed-table-title">TCG Collection Statistics</h3>`;
				output += `<p><strong>Total Collectors:</strong> ${totalUsers} | <strong>Unique Cards in Database:</strong> ${totalCardsInDb}</p>`;
				
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

				this.sendReplyBox(output);
			} catch (e: any) {
				return this.errorReply(`Error fetching stats: ${e.message}`);
			}
		},

		async sets(target, room, user) {
			if (!this.runBroadcast()) return;
			let output = `<div class="themed-table-container">`;
			output += `<h3 class="themed-table-title">Pokemon TCG Sets</h3>`;
			
			output += `<div style="max-height: 380px; overflow-y: auto;">`;
			
			const seriesGroups = new Map<string, TCGSet[]>();
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
			this.sendReplyBox(output);
		},

		async rarities(target, room, user) {
			if (!this.runBroadcast()) return;
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
			this.sendReplyBox(output);
		},

		async types(target, room, user) {
			if (!this.runBroadcast()) return;
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
			this.sendReplyBox(output);
		},
	},

	tcghelp: [
		'/tcg collection [user] - View a user\'s TCG card collection.',
		'/tcg card [cardId] - View the details of a specific card.',
		'/tcg openpack [set ID] - Open a pack of 10 cards from a specific set.',
		'/tcg search [filter]:[value] - Search for cards in the database.',
		'/tcg stats [total|unique|points] - View global TCG statistics.',
		'/tcg sets - View all Pokemon TCG sets.',
		'/tcg rarities - View all card rarities.',
		'/tcg types - View all supertypes, types, and subtypes.',
		'% /tcg addcard [id], [name], [set], [rarity], [supertype], [subtypes], [type], [hp] - Add a card to the database.',
	],
};
