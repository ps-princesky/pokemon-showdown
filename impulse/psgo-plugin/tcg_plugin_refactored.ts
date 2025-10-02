/**
 * Pokemon TCG Collection Plugin
 * Allows users to collect, trade, and manage Pokemon TCG cards
 * @license MIT
 */

import { MongoDB } from '../mongodb_module';

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

// ==================== HELPER FUNCTIONS ====================

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
	} catch (e) {
		return context.errorReply(`Error creating trade: ${e.message}`);
	}
}

async function acceptTrade(context: any, user: User, tradeId: string) {
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
	} catch (e) {
		return context.errorReply(`Error listing trades: ${e.message}`);
	}
}

// ==================== COMMANDS ====================

export const commands: ChatCommands = {
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
			} catch (e) {
				return this.errorReply(`Error adding card: ${e.message}`);
			}
		},

		async collection(target, room, user) {
			const targetUser = target ? target : user.name;
			const userId = toID(targetUser);

			try {
				const collection = await UserCollections.findOne({ userId });
				
				if (!collection || collection.cards.length === 0) {
					return this.sendReplyBox(`${targetUser} doesn't have any cards in their collection yet!`);
				}

				const cardIds = collection.cards.map(c => c.cardId);
				const cards = await TCGCards.find({ cardId: { $in: cardIds } });
				
				const cardMap = new Map(cards.map(c => [c.cardId, c]));

				let output = `<div class="themed-table-container">`;
				output += `<h3 class="themed-table-title">${Impulse.nameColor(targetUser, true)}'s TCG Collection</h3>`;
				output += `<p><strong>Total Cards:</strong> ${collection.stats.totalCards} | <strong>Unique Cards:</strong> ${collection.stats.uniqueCards}</p>`;
				output += `<table class="themed-table">`;
				output += `<tr class="themed-table-header"><th>Card</th><th>Set</th><th>Rarity</th><th>Type</th><th>Quantity</th></tr>`;

				collection.cards.sort((a, b) => b.quantity - a.quantity).slice(0, 50).forEach(item => {
					const card = cardMap.get(item.cardId);
					if (!card) return;
					
					output += `<tr class="themed-table-row">`;
					output += `<td><strong>${card.name}</strong></td>`;
					output += `<td>${card.set}</td>`;
					output += `<td><span style="color: ${getRarityColor(card.rarity)}">${card.rarity.toUpperCase()}</span></td>`;
					output += `<td>${card.type || card.supertype}</td>`;
					output += `<td>${item.quantity}</td>`;
					output += `</tr>`;
				});

				output += `</table>`;
				if (collection.cards.length > 50) {
					output += `<p><em>Showing top 50 cards. Total: ${collection.cards.length} unique cards.</em></p>`;
				}
				output += `</div>`;

				return this.sendReplyBox(output);
			} catch (e) {
				return this.errorReply(`Error fetching collection: ${e.message}`);
			}
		},

		async openpack(target, room, user) {
			const userId = toID(user.name);

			try {
				const allCards = await TCGCards.find({});
				
				if (allCards.length === 0) {
					return this.errorReply('No cards available in the database. Contact an administrator.');
				}

				const pack: TCGCard[] = [];
				for (let i = 0; i < 10; i++) {
					pack.push(getRandomCard(allCards));
				}

				const collection = await UserCollections.findOne({ userId }) || {
					userId,
					cards: [],
					stats: { totalCards: 0, uniqueCards: 0 },
					tradeLocked: false,
					lastUpdated: Date.now(),
				};

				for (const card of pack) {
					const existingCard = collection.cards.find(c => c.cardId === card.cardId);
					if (existingCard) {
						existingCard.quantity++;
					} else {
						collection.cards.push({
							cardId: card.cardId,
							quantity: 1,
							addedAt: Date.now(),
						});
					}
				}

				collection.stats.totalCards += 10;
				collection.stats.uniqueCards = collection.cards.length;
				collection.lastUpdated = Date.now();

				await UserCollections.upsert({ userId }, collection);

				let output = `<div class="themed-table-container">`;
				output += `<h3 class="themed-table-title">🎴 ${user.name} opened a TCG Pack!</h3>`;
				output += `<table class="themed-table">`;
				output += `<tr class="themed-table-header"><th>Card</th><th>Set</th><th>Rarity</th><th>Type</th></tr>`;

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
			} catch (e) {
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

		async search(target, room, user) {
			if (!target) return this.errorReply('Usage: /tcg search [card name or type]');

			const searchTerm = toID(target);

			try {
				const results = await TCGCards.find({
					$or: [
						{ name: { $regex: target, $options: 'i' } },
						{ type: searchTerm },
						{ set: { $regex: target, $options: 'i' } },
						{ supertype: { $regex: target, $options: 'i' } },
						{ subtypes: { $regex: target, $options: 'i' } },
					],
				});

				if (results.length === 0) {
					return this.sendReply(`No cards found matching "${target}".`);
				}

				let output = `<div class="themed-table-container">`;
				output += `<h3 class="themed-table-title">Search Results for "${target}"</h3>`;
				output += `<table class="themed-table">`;
				output += `<tr class="themed-table-header"><th>Card ID</th><th>Name</th><th>Set</th><th>Rarity</th><th>Type</th><th>Subtypes</th></tr>`;

				results.slice(0, 20).forEach(card => {
					output += `<tr class="themed-table-row">`;
					output += `<td>${card.cardId}</td>`;
					output += `<td><strong>${card.name}</strong></td>`;
					output += `<td>${card.set}</td>`;
					output += `<td><span style="color: ${getRarityColor(card.rarity)}">${card.rarity.toUpperCase()}</span></td>`;
					output += `<td>${card.type || card.supertype}</td>`;
					output += `<td>${card.subtypes.join(', ')}</td>`;
					output += `</tr>`;
				});

				output += `</table>`;
				if (results.length > 20) {
					output += `<p><em>Showing 20 of ${results.length} results.</em></p>`;
				}
				output += `</div>`;

				return this.sendReplyBox(output);
			} catch (e) {
				return this.errorReply(`Error searching: ${e.message}`);
			}
		},

		async stats(target, room, user) {
			try {
				const totalUsers = await UserCollections.count({});
				const totalCards = await TCGCards.count({});
				const totalTrades = await TradeOffers.count({ status: 'accepted' });

				const topCollectors = await UserCollections.findSorted(
					{},
					{ 'stats.totalCards': -1 },
					5
				);

				let output = `<div class="themed-table-container">`;
				output += `<h3 class="themed-table-title">TCG Collection Statistics</h3>`;
				output += `<p><strong>Total Collectors:</strong> ${totalUsers} | <strong>Total Cards in Database:</strong> ${totalCards} | <strong>Successful Trades:</strong> ${totalTrades}</p>`;
				
				if (topCollectors.length > 0) {
					output += `<h4>Top Collectors</h4>`;
					output += `<table class="themed-table">`;
					output += `<tr class="themed-table-header"><th>Rank</th><th>User</th><th>Total Cards</th><th>Unique Cards</th></tr>`;

					topCollectors.forEach((collector, idx) => {
						output += `<tr class="themed-table-row">`;
						output += `<td>${idx + 1}</td>`;
						output += `<td>${Impulse.nameColor(collector.userId, true)}</td>`;
						output += `<td>${collector.stats.totalCards}</td>`;
						output += `<td>${collector.stats.uniqueCards}</td>`;
						output += `</tr>`;
					});

					output += `</table>`;
				}
				output += `</div>`;

				return this.sendReplyBox(output);
			} catch (e) {
				return this.errorReply(`Error fetching stats: ${e.message}`);
			}
		},

		async sets(target, room, user) {
			let output = `<div class="themed-table-container">`;
			output += `<h3 class="themed-table-title">Pokemon TCG Sets</h3>`;
			
			const seriesGroups = new Map<string, typeof POKEMON_SETS>();
			POKEMON_SETS.forEach(set => {
				if (!seriesGroups.has(set.series)) {
					seriesGroups.set(set.series, []);
				}
				seriesGroups.get(set.series)!.push(set);
			});

			seriesGroups.forEach((sets, series) => {
				output += `<h4>${series} Series</h4>`;
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
			return this.sendReplyBox(output);
		},

		async rarities(target, room, user) {
			let output = `<div class="themed-table-container">`;
			output += `<h3 class="themed-table-title">Pokemon TCG Rarities</h3>`;
			output += `<ul style="list-style: none; padding: 10px;">`;
			
			RARITIES.forEach(rarity => {
				output += `<li><span style="color: ${getRarityColor(rarity)}; font-weight: bold;">●</span> ${rarity}</li>`;
			});
			
			output += `</ul></div>`;
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
		'/tcg collection [user] - View a user\'s TCG card collection',
		'/tcg openpack - Open a pack of 10 random cards',
		'/tcg search [name/type] - Search for cards in the database',
		'/tcg trade offer, [user], [your cards], [their cards] - Offer a trade',
		'/tcg trade list - View your pending trades',
		'/tcg trade accept/reject/cancel [tradeId] - Manage trade offers',
		'/tcg stats - View global TCG statistics',
		'/tcg sets - View all Pokemon TCG sets',
		'/tcg rarities - View all card rarities',
		'/tcg types - View all supertypes, types, and subtypes',
		'% /tcg addcard [id], [name], [set], [rarity], [supertype], [subtypes], [type], [hp] - Add a card to the database',
	],
};