/**
 * Pokemon TCG Collection Plugin
 * Core command logic file.
 * @license MIT
 */
import { MongoDB } from '../../impulse/mongodb_module';
import { POKEMON_SETS, TCGSet, getRarityColor, getSubtypeColor,
		  TCGCard, UserCollection, RARITIES, SUBTYPES, POKEMON_TYPES,
		  SUPERTYPES, SPECIAL_SUBTYPES } from './tcg_data';
import * as TCG_Economy from './tcg_economy';
import * as TCG_UI from './tcg_ui';
import { TCGCards, UserCollections, ShopStateCollection } from './tcg_collections';
import * as TCG_Ranking from './tcg_ranking';

// State variables
const SHOP_PACK_PRICE = 150;
const SHOP_ROTATION_HOURS = 24;
const SHOP_PACK_SLOTS = 5;

const battleChallenges: Map<string, { 
	from: string; 
	wager: number; 
	setId: string; 
	ranked?: boolean; 
}> = new Map();

// ==================== HELPER FUNCTIONS ====================

export function getCardPoints(card: TCGCard): number {
	switch (card.rarity) {
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

function hexToRgba(hex: string, alpha: number): string {
	if (!/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
		return `rgba(128, 128, 128, ${alpha})`;
	}
	let c = hex.substring(1).split('');
	if (c.length === 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]];
	const num = parseInt(c.join(''), 16);
	const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

async function generatePack(setId: string): Promise<TCGCard[] | null> {
	const setCards = await TCGCards.find({ set: setId });
	if (setCards.length === 0) return null;

	const commons = setCards.filter(c => c.rarity === 'Common');
	const uncommons = setCards.filter(c => c.rarity === 'Uncommon');
	const raresPool = setCards.filter(c => c.rarity.includes('Rare'));

	const pack: TCGCard[] = [];
	const usedCardIds = new Set<string>();

	const pickRandom = (pool: TCGCard[]): TCGCard => {
		let attempts = 0;
		while (attempts < 50) {
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

	if (commons.length === 0 || uncommons.length === 0 || raresPool.length === 0) {
		if (setCards.length < 10) {
			return setCards;
		}
		for (let i = 0; i < 10; i++) {
			pack.push(pickRandom(setCards));
		}
		return pack;
	}
	
	const reverseHoloPool = [...commons, ...uncommons];

	for (let i = 0; i < 5; i++) pack.push(pickRandom(commons));
	for (let i = 0; i < 3; i++) pack.push(pickRandom(uncommons));
	pack.push(pickRandom(reverseHoloPool));

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
			return this.parse('/help tcg');
		},

		async addcard(target, room, user) {
			this.checkCan('globalban');
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
			await TCG_Ranking.getPlayerRanking(user.id);
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
				if (!collection || !collection.cards || collection.cards.length === 0) {
					this.sendReplyBox(TCG_UI.buildPage(`${Impulse.nameColor(targetUsername, true)}'s TCG Collection`, `${targetUsername} doesn't have any cards in their collection yet!`));
					return;
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
				const cardsToDisplay = top100Cards.map(item => cardMap.get(item.cardId)).filter((c): c is TCGCard => !!c);
				const quantityMap = new Map(top100Cards.map(item => [item.cardId, item.quantity]));
				
				let content = `<p><strong>Total Cards:</strong> ${collection.stats?.totalCards || 0} | <strong>Unique Cards:</strong> ${collection.stats?.uniqueCards || 0} | <strong>Total Points:</strong> ${totalPoints}</p>`;
				content += TCG_UI.generateCardTable(cardsToDisplay, ['name', 'set', 'rarity', 'type', 'quantity'], quantityMap);

				if (filteredUserCards.length > 100) {
					content += `<p style="text-align:center; margin-top: 8px;"><em>Showing top 100 of ${filteredUserCards.length} matching cards.</em></p>`;
				}
				
				const output = TCG_UI.buildPage(`${Impulse.nameColor(targetUsername, true)}'s TCG Collection`, content);
				this.sendReplyBox(output);
			} catch (e: any) {
				return this.errorReply(`Error fetching collection: ${e.message}`);
			}
		},

		async daily(target, room, user) {
			if (!this.runBroadcast()) return;
			await TCG_Ranking.getPlayerRanking(user.id);
			const userId = user.id;
			const twentyFourHours = 24 * 60 * 60 * 1000;
			const DAILY_CURRENCY_AWARD = 50;

			try {
				let collection = await UserCollections.findOne({ userId });

				if (collection?.lastDaily && (Date.now() - collection.lastDaily < twentyFourHours)) {
					const timeLeft = collection.lastDaily + twentyFourHours - Date.now();
					const hours = Math.floor(timeLeft / (1000 * 60 * 60));
					const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
					return this.sendReply(`You have already claimed your daily pack. Please wait ${hours}h ${minutes}m.`);
				}

				const availableSets = await TCGCards.distinct('set');
				if (availableSets.length === 0) {
					return this.errorReply("There are no sets available to open packs from.");
				}
				const randomSetId = availableSets[Math.floor(Math.random() * availableSets.length)];
				
				const pack = await generatePack(randomSetId);
				if (!pack) {
					return this.errorReply(`An error occurred while generating a pack from set "${randomSetId}".`);
				}

				if (!collection) {
					collection = {
						userId,
						cards: [],
						stats: { totalCards: 0, uniqueCards: 0, totalPoints: 0 },
						lastUpdated: Date.now(),
					};
				} else {
					if (!collection.cards) collection.cards = [];
					if (!collection.stats) collection.stats = { totalCards: 0, uniqueCards: 0, totalPoints: 0 };
				}

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

				collection.stats.totalCards = collection.cards.reduce((sum, c) => sum + c.quantity, 0);
				collection.stats.uniqueCards = collection.cards.length;
				collection.stats.totalPoints = (collection.stats.totalPoints || 0) + pointsGained;
				collection.currency = (collection.currency || 0) + DAILY_CURRENCY_AWARD;
				collection.lastUpdated = Date.now();
				collection.lastDaily = Date.now();

				await UserCollections.upsert({ userId }, collection);

				const setInfo = POKEMON_SETS.find(s => toID(s.code) === toID(randomSetId));
				const displaySetName = setInfo ? setInfo.name : randomSetId;

				pack.sort((a, b) => getCardPoints(b) - getCardPoints(a));
				
				const tableHtml = TCG_UI.generateCardTable(pack, ['name', 'set', 'rarity', 'type']);
				const pageContent = `<p style="text-align:center;">You received a pack from <strong>${displaySetName}</strong> and <strong>${DAILY_CURRENCY_AWARD} Credits</strong>!</p><hr/>${tableHtml}`;
				const output = TCG_UI.buildPage(`🎁 You claimed your daily pack!`, pageContent);
				
				this.sendReplyBox(output);
			} catch (e: any) {
				return this.errorReply(`Error claiming daily pack: ${e.message}`);
			}
		},
		
		async openpack(target, room, user) {
			this.checkCan('globalban');
			await TCG_Ranking.getPlayerRanking(user.id);
			if (!target) {
				return this.errorReply("Usage: /tcg openpack [set ID]. This is an admin command.");
			}
			
			const userId = user.id;
			const setId = target.trim().toLowerCase();

			try {
				const pack = await generatePack(setId);
				if (!pack) {
					return this.errorReply(`Set with ID "${target.trim()}" not found or is missing required card rarities. Use /tcg sets to see a list of sets.`);
				}

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

				collection.stats.totalCards = collection.cards.reduce((sum, c) => sum + c.quantity, 0);
				collection.stats.uniqueCards = collection.cards.length;
				collection.stats.totalPoints = (collection.stats.totalPoints || 0) + pointsGained;
				collection.lastUpdated = Date.now();

				await UserCollections.upsert({ userId }, collection);
				
				pack.sort((a, b) => getCardPoints(b) - getCardPoints(a));

				const tableHtml = TCG_UI.generateCardTable(pack, ['name', 'set', 'rarity', 'type']);
				const output = TCG_UI.buildPage(`🎴 ${user.name} opened a ${target.trim()} Pack!`, tableHtml);

				this.sendReplyBox(output);
			} catch (e: any) {
				return this.errorReply(`Error opening pack: ${e.message}`);
			}
		},

		async card(target, room, user) {
			if (!this.runBroadcast()) return;
			await TCG_Ranking.getPlayerRanking(user.id);
			if (!target) return this.errorReply("Please specify a card ID. Usage: /tcg card [cardId]");

			const card = await TCGCards.findOne({ cardId: target.trim() });
			if (!card) return this.errorReply(`Card with ID "${target}" not found.`);

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
			await TCG_Ranking.getPlayerRanking(user.id);
			if (!this.runBroadcast()) return;
			const CARDS_PER_PAGE = 60;

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
					if (!isNaN(pageNum) && pageNum > 0) page = pageNum;
					continue; 
				}
				commandArgs.push(filter);
				searchTerms.push(`<strong>${key}</strong>: "${value}"`);
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
					default:
						return this.errorReply(`Invalid filter: "${key}".`);
				}
			}

			if (Object.keys(query).length === 0) {
				return this.errorReply('No valid filters provided.');
			}

			try {
				const { data: paginatedResults, total: totalResults, pages: totalPages } = await TCGCards.findWithPagination(
					query, { page, limit: CARDS_PER_PAGE }
				);

				if (totalResults === 0) {
					return this.sendReply(`No cards found matching your criteria.`);
				}

				paginatedResults.sort((a, b) => {
					const pointsDiff = getCardPoints(b) - getCardPoints(a);
					if (pointsDiff !== 0) return pointsDiff;
					return a.name.localeCompare(b.name);
				});

				let content = `<p><em>Searching for: ${searchTerms.join(', ')}</em></p>`;
				content += TCG_UI.generateCardTable(paginatedResults, ['id', 'name', 'set', 'rarity', 'type', 'subtypes', 'hp']);
				content += `<p style="text-align:center; margin-top: 8px;">Showing ${paginatedResults.length} of ${totalResults} results.</p>`;
				const commandString = `/tcg search ${commandArgs.join(', ')}`;
				content += `<div style="text-align: center; margin-top: 5px;">`;
				if (page > 1) {
					content += `<button name="send" value="${commandString}, page:${page - 1}" style="margin-right: 5px;">&laquo; Previous</button>`;
				}
				content += `<strong>Page ${page} of ${totalPages}</strong>`;
				if ((page * CARDS_PER_PAGE) < totalResults) {
					content += `<button name="send" value="${commandString}, page:${page + 1}" style="margin-left: 5px;">Next &raquo;</button>`;
				}
				content += `</div>`;

				const output = TCG_UI.buildPage('Search Results', content);
				this.sendReplyBox(output);
			} catch (e: any) {
				return this.errorReply(`Error searching: ${e.message}`);
			}
		},
		
		async setprogress(target, room, user) {
			await TCG_Ranking.getPlayerRanking(user.id);
			if (!this.runBroadcast()) return;
			const parts = target.split(',').map(p => p.trim());
			const targetUsername = parts[0] || user.name;
			const setId = parts[1];

			if (!setId) {
				return this.errorReply("Usage: /tcg setprogress [user], [set ID]");
			}
			const targetId = toID(targetUsername);
			const cleanSetId = toID(setId);
			
			try {
				const setInfo = POKEMON_SETS.find(s => toID(s.code) === cleanSetId);
				const displaySetName = setInfo ? setInfo.name : setId;

				const [userCollection, allSetCards] = await Promise.all([
					UserCollections.findOne({ userId: targetId }),
					TCGCards.find({ set: cleanSetId }),
				]);

				if (allSetCards.length === 0) {
					return this.errorReply(`No cards found for the set "${displaySetName}". Make sure cards are imported for this set.`);
				}
				
				const ownedCardIds = new Set(userCollection?.cards?.map(c => c.cardId) || []);
				const missingCards: TCGCard[] = [];
				let ownedCount = 0;

				for (const card of allSetCards) {
					if (ownedCardIds.has(card.cardId)) {
						ownedCount++;
					} else {
						missingCards.push(card);
					}
				}

				const totalInSet = allSetCards.length;
				const percentage = totalInSet > 0 ? Math.round((ownedCount / totalInSet) * 100) : 0;
				
				let content = `<p><strong>Collector:</strong> ${Impulse.nameColor(targetUsername, true)} | <strong>Completion:</strong> ${ownedCount} / ${totalInSet} cards</p>`;
				content += `<div style="background: #555; border-radius: 4px; overflow: hidden;"><div style="width:${percentage}%; background: #2ecc71; padding: 4px 0; text-align: center; color: #fff; font-weight: bold;">${percentage}%</div></div>`;

				if (missingCards.length > 0) {
					content += `<h4 style="margin-top: 15px;">Missing Cards:</h4>`;
					missingCards.sort((a, b) => getCardPoints(a) - getCardPoints(b));
					const missingCardsTable = TCG_UI.generateCardTable(missingCards, ['name', 'rarity']);
					content += missingCardsTable;
				} else {
					content += `<p style="text-align:center; font-weight:bold; color:#2ecc71; margin-top:15px;">🎉 Set Complete! 🎉</p>`;
				}

				const output = TCG_UI.buildPage(`Set Progress for ${displaySetName}`, content);
				this.sendReplyBox(output);

			} catch (e: any) {
				return this.errorReply(`Error fetching set progress: ${e.message}`);
			}
		},

		async stats(target, room, user) {
			await TCG_Ranking.getPlayerRanking(user.id);
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
					break;
				default:
					return this.errorReply(`Invalid sort type. Use: total, unique, or points.`);
			}

			try {
				const totalUsers = await UserCollections.count({});
				const totalCardsInDb = await TCGCards.count({});

				const topCollectors = await UserCollections.findSorted({}, sortQuery, 5);
				
				let content = `<p><strong>Total Collectors:</strong> ${totalUsers} | <strong>Unique Cards in Database:</strong> ${totalCardsInDb}</p>`;
				
				if (topCollectors.length > 0) {
					content += `<h4>Top 5 Collectors by ${sortLabel}</h4>`;
					content += `<table class="themed-table">`;
					content += `<tr class="themed-table-header"><th>Rank</th><th>User</th><th>${sortLabel}</th></tr>`;

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
						content += `<tr class="themed-table-row">`;
						content += `<td>${idx + 1}</td>`;
						content += `<td>${Impulse.nameColor(collector.userId, true)}</td>`;
						content += `<td>${statValue}</td>`;
						content += `</tr>`;
					});
					content += `</table>`;
				}
				
				this.sendReplyBox(TCG_UI.buildPage('TCG Collection Statistics', content));
			} catch (e: any) {
				return this.errorReply(`Error fetching stats: ${e.message}`);
			}
		},

		async sets(target, room, user) {
			await TCG_Ranking.getPlayerRanking(user.id);
			if (!this.runBroadcast()) return;
			let content = `<div style="max-height: 380px; overflow-y: auto;">`;
			const seriesGroups = new Map<string, TCGSet[]>();
			POKEMON_SETS.forEach(set => {
				if (!seriesGroups.has(set.series)) {
					seriesGroups.set(set.series, []);
				}
				seriesGroups.get(set.series)!.push(set);
			});

			seriesGroups.forEach((sets, series) => {
				content += `<h4 style="margin-top: 10px; margin-bottom: 5px;">${series} Series</h4>`;
				content += `<table class="themed-table">`;
				content += `<tr class="themed-table-header"><th>Code</th><th>Name</th><th>Year</th></tr>`;
				sets.forEach(set => {
					content += `<tr class="themed-table-row">`;
					content += `<td>${set.code}</td>`;
					content += `<td><strong>${set.name}</strong></td>`;
					content += `<td>${set.year}</td>`;
					content += `</tr>`;
				});
				content += `</table>`;
			});
			content += `</div>`;
			this.sendReplyBox(TCG_UI.buildPage('Pokemon TCG Sets', content));
		},

		async rarities(target, room, user) {
			await TCG_Ranking.getPlayerRanking(user.id);
			if (!this.runBroadcast()) return;
			let content = `<div style="max-height: 380px; overflow-y: auto;">`;
			content += `<ul style="list-style: none; padding: 10px;">`;
			RARITIES.forEach(rarity => {
				content += `<li><span style="color: ${getRarityColor(rarity)}; font-weight: bold;">●</span> ${rarity}</li>`;
			});
			content += `</ul></div>`;
			this.sendReplyBox(TCG_UI.buildPage('Pokemon TCG Rarities', content));
		},

		async wishlist(target, room, user) {
			await TCG_Ranking.getPlayerRanking(user.id);
			if (!this.runBroadcast()) return;
			const parts = target.split(',').map(p => p.trim());
			const action = parts.length > 1 ? toID(parts[0]) : 'view';
			
			try {
				if (action === 'add' || action === 'remove') {
					const cardId = parts[1];
					if (!cardId) return this.errorReply(`You must specify a card ID.`);
					const card = await TCGCards.findOne({ cardId: cardId });
					if (!card) return this.errorReply(`Card with ID "${cardId}" not found.`);

					if (action === 'add') {
						await UserCollections.updateOne({ userId: user.id }, { $addToSet: { wishlist: card.cardId } });
						return this.sendReply(`Added ${card.name} to your wishlist.`);
					} else { // remove
						await UserCollections.updateOne({ userId: user.id }, { $pull: { wishlist: card.cardId } });
						return this.sendReply(`Removed ${card.name} from your wishlist.`);
					}
				} else { // view
					const targetUsername = parts[0] || user.name;
					const targetId = toID(targetUsername);
					const collection = await UserCollections.findOne({ userId: targetId });
					
					if (!collection?.wishlist?.length) {
						return this.sendReplyBox(`${targetUsername} does not have a wishlist.`);
					}

					const cards = await TCGCards.find({ cardId: { $in: collection.wishlist } });
					cards.sort((a, b) => getCardPoints(b) - getCardPoints(a));

					const tableHtml = TCG_UI.generateCardTable(cards, ['name', 'set', 'rarity']);
					const output = TCG_UI.buildPage(`${Impulse.nameColor(targetUsername, true)}'s Wishlist`, tableHtml);
					this.sendReplyBox(output);
				}
			} catch (e: any) {
				return this.errorReply(`Error managing wishlist: ${e.message}`);
			}
		},

		async types(target, room, user) {
			await TCG_Ranking.getPlayerRanking(user.id);
			if (!this.runBroadcast()) return;
			let content = `<p><strong>Supertypes:</strong> ${SUPERTYPES.join(', ')}</p>`;
			content += `<p><strong>Pokemon Types:</strong> ${POKEMON_TYPES.join(', ')}</p>`;
			content += `<h4>Pokemon Subtypes</h4><p>${SUBTYPES.Pokemon.join(', ')}</p>`;
			content += `<h4>Trainer Subtypes</h4><p>${SUBTYPES.Trainer.join(', ')}</p>`;
			content += `<h4>Energy Subtypes</h4><p>${SUBTYPES.Energy.join(', ')}</p>`;
			this.sendReplyBox(TCG_UI.buildPage('Pokemon TCG Data', content));
		},

		async battle(target, room, user) {
			await TCG_Ranking.getPlayerRanking(user.id);
			const [action, ...args] = target.split(',').map(p => p.trim());

			switch (toID(action)) {
				case 'challenge':
				case 'chal': {
					if (!this.runBroadcast()) return;
					const [targetUsername, wagerStr] = args;
					if (!targetUsername || !wagerStr) {
						return this.errorReply("Usage: /tcg battle challenge, [user], [wager]");
					}
					const wager = parseInt(wagerStr);
					if (isNaN(wager) || wager <= 0) {
						return this.errorReply("The wager must be a positive number.");
					}

					const challengerId = user.id;
					const targetId = toID(targetUsername);

					if (challengerId === targetId) return this.errorReply("You cannot challenge yourself.");
					if (battleChallenges.has(targetId) || battleChallenges.has(challengerId)) {
						return this.errorReply("One of you already has a pending battle challenge.");
					}

					try {
						const challengerBalance = await TCG_Economy.getUserBalance(challengerId);
						if (challengerBalance < wager) {
							return this.errorReply("You do not have enough Credits to make that wager.");
						}

						const availableSets = await TCGCards.distinct('set');
						if (availableSets.length === 0) {
							return this.errorReply("There are no sets available for a pack battle.");
						}
						const randomSetId = availableSets[Math.floor(Math.random() * availableSets.length)];

						battleChallenges.set(targetId, { from: challengerId, wager, setId: randomSetId });
						setTimeout(() => {
							if (battleChallenges.get(targetId)?.from === challengerId) {
								battleChallenges.delete(targetId);
								this.sendReply(`Your battle challenge to ${targetUsername} has expired.`);
							}
						}, 2 * 60 * 1000);

						this.sendReply(`You have challenged ${targetUsername} to a ${wager} Credit pack battle! They have 2 minutes to accept.`);
						const targetUserObj = Users.get(targetId);
						if (targetUserObj) {
							targetUserObj.sendTo(room, `|html|<div class="infobox"><strong>${user.name} has challenged you to a ${wager} Credit Pack Battle!</strong><br/>Type <code>/tcg battle accept, ${user.name}</code> to accept.</div>`);
						}
					} catch (e: any) {
						return this.errorReply(`Error creating battle: ${e.message}`);
					}
					break;
				}

				case 'accept': {
					const broadcast = this.broadcasting;
					if (!this.runBroadcast()) return;
					const [challengerName] = args;
					if (!challengerName) return this.errorReply("Usage: /tcg battle accept, [user]");
					
					const acceptorId = user.id;
					const challengerId = toID(challengerName);
					
					const challenge = battleChallenges.get(acceptorId);
					if (!challenge || challenge.from !== challengerId) {
						return this.errorReply(`You do not have a pending battle challenge from ${challengerName}.`);
					}
					
					const { wager, setId } = challenge;
					battleChallenges.delete(acceptorId);

					try {
						const canAcceptorPay = await TCG_Economy.deductCurrency(acceptorId, wager);
						if (!canAcceptorPay) {
							return this.errorReply("You do not have enough Credits to accept this wager.");
						}

						const canChallengerPay = await TCG_Economy.deductCurrency(challengerId, wager);
						if (!canChallengerPay) {
							await TCG_Economy.grantCurrency(acceptorId, wager); // Refund acceptor
							return this.errorReply(`${challengerName} no longer has enough Credits for this wager. The battle is cancelled.`);
						}

						const [pack1, pack2] = await Promise.all([generatePack(setId), generatePack(setId)]);
						if (!pack1 || !pack2) throw new Error("Could not generate packs for the battle.");

						const points1 = pack1.reduce((sum, card) => sum + getCardPoints(card), 0);
						const points2 = pack2.reduce((sum, card) => sum + getCardPoints(card), 0);

						let winnerId = '';
						let winnerName = '';
						if (points1 > points2) {
							winnerId = challengerId;
							winnerName = challengerName;
						} else if (points2 > points1) {
							winnerId = acceptorId;
							winnerName = user.name;
						}

						if (winnerId) {
							await TCG_Economy.grantCurrency(winnerId, wager * 2);
						} else {
							await Promise.all([
								TCG_Economy.grantCurrency(challengerId, wager),
								TCG_Economy.grantCurrency(acceptorId, wager),
							]);
						}
						
						const buildPackHtml = (pack: TCGCard[]) => {
							pack.sort((a, b) => getCardPoints(b) - getCardPoints(a));
							return pack.map(c => `<tr><td><button name="send" value="/tcg card ${c.cardId}" style="background:none; border:none; padding:0; font-weight:bold; color:inherit; text-decoration:underline; cursor:pointer;">${c.name}</button></td><td><span style="color: ${getRarityColor(c.rarity)}">${c.rarity}</span></td></tr>`).join('');
						};

						let output = `<div class="infobox">`;
						output += `<h2 style="text-align:center;">Pack Battle!</h2>`;
						output += `<table style="width:100%;"><tr>`;
						output += `<td style="width:50%; vertical-align:top; padding-right:5px;">`;
						output += `<strong>${Impulse.nameColor(challengerName, true)}'s Pack (Total: ${points1} Points)</strong>`;
						output += `<table class="themed-table"> ${buildPackHtml(pack1)} </table>`;
						output += `</td><td style="width:50%; vertical-align:top; padding-left:5px;">`;
						output += `<strong>${Impulse.nameColor(user.name, true)}'s Pack (Total: ${points2} Points)</strong>`;
						output += `<table class="themed-table"> ${buildPackHtml(pack2)} </table>`;
						output += `</td></tr></table><hr/>`;

						if (winnerName) {
							output += `<h3 style="text-align:center; color:#2ecc71;">${winnerName} wins ${wager * 2} Credits!</h3>`;
						} else {
							output += `<h3 style="text-align:center; color:#f1c40f;">It's a tie! Wagers have been refunded.</h3>`;
						}
						
						output += `</div>`;
						
						this.sendReplyBox(output);

						if (!broadcast) {
							const challengerObj = Users.get(challengerId);
							if (challengerObj) {
								challengerObj.sendTo(room, `|uhtml|battle-result-${challengerId}|${output}`);
							}
						}

					} catch (e: any) {
						await TCG_Economy.grantCurrency(acceptorId, wager);
						await TCG_Economy.grantCurrency(challengerId, wager);
						return this.errorReply(`An error occurred during the battle, wagers have been refunded: ${e.message}`);
					}
					break;
				}
				
				case 'reject': {
					const [challengerName] = args;
					if (!challengerName) return this.errorReply("Usage: /tcg battle reject, [user]");
					const rejectorId = user.id;
					const challengerId = toID(challengerName);

					const challenge = battleChallenges.get(rejectorId);
					if (!challenge || challenge.from !== challengerId) {
						return this.errorReply(`You do not have a pending battle challenge from ${challengerName}.`);
					}
					
					battleChallenges.delete(rejectorId);
					this.sendReply(`You have rejected the battle challenge from ${challengerName}.`);
					const challengerObj = Users.get(challengerId);
					if (challengerObj) challengerObj.sendTo(room, `${user.name} has rejected your battle challenge.`);
					break;
				}

				case 'cancel': {
					const challengerId = user.id;
					let found = false;
					for (const [targetId, challenge] of battleChallenges.entries()) {
						if (challenge.from === challengerId) {
							battleChallenges.delete(targetId);
							found = true;
							break;
						}
					}
					if (found) {
						this.sendReply("You have cancelled your outgoing battle challenge.");
					} else {
						this.errorReply("You do not have an outgoing battle challenge.");
					}
					break;
				}

				default:
					this.errorReply("Invalid battle action. Use `challenge`, `accept`, `reject`, or `cancel`.");
			}
		},
		
		async currency(target, room, user) {
			await TCG_Ranking.getPlayerRanking(user.id);
			if (!this.runBroadcast()) return;
			const targetUser = toID(target) || user.id;
			const targetUsername = target.trim() || user.name;
			
			const balance = await TCG_Economy.getUserBalance(targetUser);
			this.sendReplyBox(`<strong>${Impulse.nameColor(targetUsername, true)}'s Balance:</strong> ${balance} Credits.`);
		},

		async givecurrency(target, room, user) {
			this.checkCan('globalban');
			const [targetUser, amountStr] = target.split(',').map(p => p.trim());
			if (!targetUser || !amountStr) {
				return this.errorReply("Usage: /tcg givecurrency [user], [amount]");
			}

			const amount = parseInt(amountStr);
			if (isNaN(amount) || amount <= 0) {
				return this.errorReply("Invalid amount. Amount must be a positive number.");
			}

			const targetId = toID(targetUser);
			const success = await TCG_Economy.grantCurrency(targetId, amount);

			if (success) {
				this.sendReply(`${targetUser} has been given ${amount} Credits.`);
				const targetUserObj = Users.get(targetId);
				if (targetUserObj) targetUserObj.send(`|raw|You have received ${amount} Credits from ${user.name}.`);
			} else {
				this.errorReply(`Failed to give currency to ${targetUser}.`);
			}
		},

		async takecurrency(target, room, user) {
			await TCG_Ranking.getPlayerRanking(user.id);
			this.checkCan('globalban');
			const [targetUser, amountStr] = target.split(',').map(p => p.trim());
			if (!targetUser || !amountStr) {
				return this.errorReply("Usage: /tcg takecurrency [user], [amount]");
			}

			const amount = parseInt(amountStr);
			if (isNaN(amount) || amount <= 0) {
				return this.errorReply("Invalid amount. Amount must be a positive number.");
			}

			const targetId = toID(targetUser);
			const success = await TCG_Economy.deductCurrency(targetId, amount);

			if (success) {
				this.sendReply(`${amount} Credits have been taken from ${targetUser}.`);
				const targetUserObj = Users.get(targetId);
				if (targetUserObj) targetUserObj.send(`|raw|${amount} Credits were taken from your account by ${user.name}.`);
			} else {
				this.errorReply(`${targetUser} does not have enough currency.`);
			}
		},

		async setcurrency(target, room, user) {
			await TCG_Ranking.getPlayerRanking(user.id);
			this.checkCan('globalban');
			const [targetUser, amountStr] = target.split(',').map(p => p.trim());
			if (!targetUser || !amountStr) {
				return this.errorReply("Usage: /tcg setcurrency [user], [amount]");
			}

			const amount = parseInt(amountStr);
			if (isNaN(amount) || amount < 0) {
				return this.errorReply("Invalid amount. Amount must be a non-negative number.");
			}

			const targetId = toID(targetUser);
			const success = await TCG_Economy.setCurrency(targetId, amount);

			if (success) {
				this.sendReply(`${targetUser}'s balance has been set to ${amount} Credits.`);
				const targetUserObj = Users.get(targetId);
				if (targetUserObj) targetUserObj.send(`|raw|Your credit balance was set to ${amount} by ${user.name}.`);
			} else {
				this.errorReply(`Failed to set currency for ${targetUser}.`);
			}
		},

		async pay(target, room, user) {
			await TCG_Ranking.getPlayerRanking(user.id);
			const [targetUser, amountStr] = target.split(',').map(p => p.trim());
			if (!targetUser || !amountStr) {
				return this.errorReply("Usage: /tcg pay [user], [amount]");
			}

			const amount = parseInt(amountStr);
			if (isNaN(amount) || amount <= 0) {
				return this.errorReply("Invalid amount. Amount must be a positive number.");
			}

			const fromUserId = user.id;
			const toUserId = toID(targetUser);

			if (fromUserId === toUserId) {
				return this.errorReply("You cannot pay yourself.");
			}

			const success = await TCG_Economy.transferCurrency(fromUserId, toUserId, amount);

			if (success) {
				this.sendReply(`You have sent ${amount} Credits to ${targetUser}.`);
				const toUserObj = Users.get(toUserId);
				if (toUserObj) toUserObj.send(`|raw|You have received ${amount} Credits from ${user.name}.`);
			} else {
				this.errorReply(`Payment failed. You may not have enough credits.`);
			}
		},

		async shop(target, room, user) {
			await TCG_Ranking.getPlayerRanking(user.id);
			const [action, ...args] = target.split(',').map(p => p.trim());
			const userId = user.id;

			// Helper function to rotate the shop stock if needed
			const rotateShopStock = async (): Promise<string[]> => {
				const now = Date.now();
		
				// Fetch current shop state from database
				let shopState = await ShopStateCollection.findOne({ _id: 'main' });
		
				// Check if rotation is needed
				if (shopState && now - shopState.lastRotation < SHOP_ROTATION_HOURS * 60 * 60 * 1000 && shopState.stock.length > 0) {
					return shopState.stock; // No rotation needed, return current stock
				}

				// Need to rotate - get available sets
				const availableSets = await TCGCards.distinct('set');
				if (availableSets.length === 0) {
					// No sets available, update database with empty stock
					await ShopStateCollection.upsert(
						{ _id: 'main' },
						{ stock: [], lastRotation: now }
					);
					return [];
				}

					// Shuffle the available sets to get a random selection
				for (let i = availableSets.length - 1; i > 0; i--) {
					const j = Math.floor(Math.random() * (i + 1));
					[availableSets[i], availableSets[j]] = [availableSets[j], availableSets[i]];
				}
		
				// Get random sets for shop slots
				const newStock = availableSets.slice(0, SHOP_PACK_SLOTS);
		
				// Update database with new stock and rotation time
				await ShopStateCollection.upsert(
					{ _id: 'main' },
					{ stock: newStock, lastRotation: now }
				);
		
				return newStock;
			};

			try {
				const currentStock = await rotateShopStock();

				if (toID(action) === 'buy') {
					const setId = toID(args[0]);
					if (!setId) {
						return this.errorReply("Usage: /tcg shop buy, [set ID]");
					}

					if (!currentStock.includes(setId)) {
						return this.errorReply(`The set "${setId}" is not currently in stock. Check /tcg shop to see the current rotation.`);
					}

					const canAfford = await TCG_Economy.deductCurrency(userId, SHOP_PACK_PRICE);
					if (!canAfford) {
						return this.errorReply(`You don't have enough credits to buy this pack. You need ${SHOP_PACK_PRICE} Credits.`);
					}
			
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

					const packEntry = collection.packs.find(p => p.setId === setId);
					if (packEntry) {
						packEntry.quantity++;
					} else {
						collection.packs.push({ setId, quantity: 1 });
					}
			
					await UserCollections.upsert({ userId }, collection);

					const setInfo = POKEMON_SETS.find(s => toID(s.code) === toID(setId));
					const displaySetName = setInfo ? setInfo.name : setId;
			
					return this.sendReply(`You have purchased one "${displaySetName}" pack! Use /tcg packs to view and open your packs.`);
			
				} else { // View the shop
					if (!this.runBroadcast()) return;
					const balance = await TCG_Economy.getUserBalance(userId);

					let content = `<p>Welcome to the TCG Shop! New packs rotate in every 24 hours.</p>`;
					content += `<p><strong>Your Balance:</strong> ${balance} Credits</p><hr/>`;
			
					if (currentStock.length === 0) {
						content += `<p>The shop is currently empty. Please check back later.</p>`;
					} else {
						content += `<h4>Booster Packs for Sale</h4>`;
						content += `<table class="themed-table">`;
						content += `<tr class="themed-table-header"><th>Set Name</th><th>Set ID</th><th>Price</th><th></th></tr>`;
						for (const setId of currentStock) {
							const setInfo = POKEMON_SETS.find(s => toID(s.code) === toID(setId));
							const setName = setInfo ? setInfo.name : setId;
							content += `<tr class="themed-table-row">`;
							content += `<td><strong>${setName}</strong></td>`;
							content += `<td>${setId}</td>`;
							content += `<td>${SHOP_PACK_PRICE} Credits</td>`;
							content += `<td><button name="send" value="/tcg shop buy, ${setId}">Buy</button></td>`;
							content += `</tr>`;
						}
						content += `</table>`;
					}
					const output = TCG_UI.buildPage('TCG Card Shop', content);
					this.sendReplyBox(output);
				}
			} catch (e: any) {
				return this.errorReply(`An error occurred in the shop: ${e.message}`);
			}
		},
		
		async packs(target, room, user) {
			await TCG_Ranking.getPlayerRanking(user.id);
			const [action, ...args] = target.split(',').map(p => p.trim());
			const userId = user.id;

			try {
				let collection = await UserCollections.findOne({ userId });
				
				if (toID(action) === 'open') {
					if (!this.runBroadcast()) return;
					const setId = toID(args[0]);
					if (!setId) return this.errorReply("Usage: /tcg packs open, [set ID]");

					if (!collection || !collection.packs?.length) {
						return this.errorReply(`You do not have any unopened packs.`);
					}
					
					const packEntry = collection.packs.find(p => p.setId === setId);
					if (!packEntry || packEntry.quantity < 1) {
						return this.errorReply(`You do not have any unopened packs from the set "${setId}".`);
					}

					// --- Pack Opening Logic ---
					const pack = await generatePack(setId);
					if (!pack) {
						return this.errorReply(`An error occurred while generating a pack for "${setId}".`);
					}

					packEntry.quantity--;
					if (packEntry.quantity <= 0) {
						collection.packs = collection.packs.filter(p => p.setId !== setId);
					}

					if (!collection.packs) collection.packs = [];
					if (!collection.cards) collection.cards = [];
					if (!collection.stats) collection.stats = { totalCards: 0, uniqueCards: 0, totalPoints: 0 };
					
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

					collection.stats.totalCards = collection.cards.reduce((sum, c) => sum + c.quantity, 0);
					collection.stats.uniqueCards = collection.cards.length;
					collection.stats.totalPoints = (collection.stats.totalPoints || 0) + pointsGained;
					collection.lastUpdated = Date.now();
					await UserCollections.upsert({ userId }, collection);
					
					const setInfo = POKEMON_SETS.find(s => toID(s.code) === toID(setId));
					const displaySetName = setInfo ? setInfo.name : setId;
					
					pack.sort((a, b) => getCardPoints(b) - getCardPoints(a));
					const tableHtml = TCG_UI.generateCardTable(pack, ['name', 'set', 'rarity', 'type']);
					const output = TCG_UI.buildPage(`🎴 ${user.name} opened a ${displaySetName} Pack!`, tableHtml);
					this.sendReplyBox(output);

				} else { // View pack inventory
					if (!this.runBroadcast()) return;

					if (!collection || !collection.packs?.length) {
						return this.sendReplyBox(TCG_UI.buildPage(`${user.name}'s Unopened Packs`, `You do not have any unopened packs. You can buy some from the <code>/tcg shop</code>.`));
					}

					let content = `<p>Click a button below to open one pack.</p><hr/>`;
					content += `<div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;">`;

					collection.packs.sort((a, b) => a.setId.localeCompare(b.setId));

					for (const pack of collection.packs) {
						const setInfo = POKEMON_SETS.find(s => toID(s.code) === toID(pack.setId));
						const setName = setInfo ? setInfo.name : pack.setId;
						content += `<button name="send" value="/tcg packs open, ${pack.setId}" class="button">${setName} (x${pack.quantity})</button>`;
					}
					content += `</div>`;
					
					const output = TCG_UI.buildPage(`${user.name}'s Unopened Packs`, content);
					this.sendReplyBox(output);
				}
			} catch (e: any) {
				return this.errorReply(`An error occurred with your packs: ${e.message}`);
			}
		},

async rankedbattle(target, room, user) {
	await TCG_Ranking.getPlayerRanking(user.id);
	const [action, ...args] = target.split(',').map(p => p.trim());

	switch (toID(action)) {
			case 'challenge': {
	const [targetUsername] = args;
	if (!targetUsername) {
		return this.errorReply("Usage: /tcg rankedbattle challenge, [user]");
	}

	const challengerId = user.id;
	const targetId = toID(targetUsername);

	if (challengerId === targetId) {
		return this.errorReply("You cannot challenge yourself.");
	}

	try {
		const result = await TCG_Ranking.executeSimulatedChallenge(challengerId, targetId);
		
		if (!result.success) {
			return this.errorReply(result.error || "Challenge failed.");
		}

		const battle = result.battle!;
		const challengerRanking = result.challengerRanking!;
		const targetRanking = result.targetRanking!;
		const challengerPack = result.challengerPack || [];
		const targetPack = result.targetPack || [];

		// Determine winner
		let resultText = '';
		let resultColor = '#f1c40f';
		if (battle.winner === challengerId) {
			resultText = 'Victory!';
			resultColor = '#2ecc71';
		} else if (battle.winner === targetId) {
			resultText = 'Defeat!';
			resultColor = '#e74c3c';
		} else {
			resultText = 'Draw!';
			resultColor = '#f1c40f';
		}

		const challengerEloChange = TCG_Ranking.formatEloChange(battle.challengerEloChange);
		const targetEloChange = TCG_Ranking.formatEloChange(battle.targetEloChange);
		const challengerColor = TCG_Ranking.getRankColor(challengerRanking.rank);
		const targetColor = TCG_Ranking.getRankColor(targetRanking.rank);

		// Helper function to build pack HTML
		const buildPackHtml = (pack: TCGCard[]) => {
			pack.sort((a, b) => getCardPoints(b) - getCardPoints(a));
			return pack.map(c => `<tr><td><button name="send" value="/tcg card ${c.cardId}" style="background:none; border:none; padding:0; font-weight:bold; color:inherit; text-decoration:underline; cursor:pointer;">${c.name}</button></td><td><span style="color: ${getRarityColor(c.rarity)}">${c.rarity}</span></td></tr>`).join('');
		};

		let output = `<div class="infobox">`;
		output += `<h2 style="text-align:center;">⚔️ Ranked Challenge Battle</h2>`;
		output += `<div style="text-align:center; margin: 10px 0;">`;
		output += `<strong>${Impulse.nameColor(user.name, true)}</strong> challenged <strong>${Impulse.nameColor(targetUsername, true)}</strong>`;
		output += `</div>`;

		// Keep the original compact layout for player info
		output += `<table style="width:100%; margin: 10px 0;"><tr>`;
		output += `<td style="width:50%; text-align:center; padding:10px; border-right: 1px solid #ddd;">`;
		output += `<strong>${user.name}</strong><br/>`;
		output += `Pack Value: <strong>${battle.challengerPackValue}</strong> pts<br/>`;
		output += `<span style="color: ${challengerColor};">${challengerRanking.rank}</span><br/>`;
		output += `<span style="color: ${battle.challengerEloChange >= 0 ? '#2ecc71' : '#e74c3c'};">${challengerRanking.elo} (${challengerEloChange})</span>`;
		output += `</td>`;
		output += `<td style="width:50%; text-align:center; padding:10px;">`;
		output += `<strong>${targetUsername}</strong><br/>`;
		output += `Pack Value: <strong>${battle.targetPackValue}</strong> pts<br/>`;
		output += `<span style="color: ${targetColor};">${targetRanking.rank}</span><br/>`;
		output += `<span style="color: ${battle.targetEloChange >= 0 ? '#2ecc71' : '#e74c3c'};">${targetRanking.elo} (${targetEloChange})</span>`;
		output += `</td></tr></table>`;

		// Add the cards section below the main info
		output += `<hr/>`;
		output += `<table style="width:100%;"><tr>`;
		output += `<td style="width:50%; vertical-align:top; padding-right:5px;">`;
		output += `<strong>${Impulse.nameColor(user.name, true)}'s Pack (Total: ${battle.challengerPackValue} Points)</strong>`;
		output += `<table class="themed-table"> ${buildPackHtml(challengerPack)} </table>`;
		output += `</td><td style="width:50%; vertical-align:top; padding-left:5px;">`;
		output += `<strong>${Impulse.nameColor(targetUsername, true)}'s Pack (Total: ${battle.targetPackValue} Points)</strong>`;
		output += `<table class="themed-table"> ${buildPackHtml(targetPack)} </table>`;
		output += `</td></tr></table><hr/>`;

		// Result
		output += `<div style="text-align:center; color: ${resultColor}; font-size: 1.3em; font-weight: bold; margin: 15px 0; padding: 10px; border: 2px solid ${resultColor}; border-radius: 8px;">`;
		output += resultText;
		output += `</div>`;

		// Challenge status
		const challengeStatus = await TCG_Ranking.getDailyChallengeStatus(challengerId);
		output += `<div style="text-align:center; margin-top: 10px; font-size: 0.9em; color: #666;">`;
		output += `Challenges remaining today: <strong>${challengeStatus.challengesRemaining}/10</strong>`;
		output += `</div>`;
		output += `</div>`;

		this.sendReplyBox(output);

	} catch (e: any) {
		return this.errorReply(`Error executing challenge: ${e.message}`);
	}
	break;
}
		case 'targets': {
			if (!this.runBroadcast()) return;
			
			try {
				const availableTargets = await TCG_Ranking.getAvailableChallengeTargets(user.id);
				const challengeStatus = await TCG_Ranking.getDailyChallengeStatus(user.id);

				let output = `<div class="infobox">`;
				output += `<h3>Available Challenge Targets</h3>`;
				output += `<p>Challenges remaining: <strong>${challengeStatus.challengesRemaining}/10</strong></p>`;

				if (availableTargets.length === 0) {
					output += `<p>No available targets. You may have challenged all eligible players today.</p>`;
				} else {
					output += `<table class="themed-table">`;
					output += `<tr class="themed-table-header">`;
					output += `<th>Rank</th><th>Player</th><th>Rating</th><th>W-L-D</th><th>Action</th>`;
					output += `</tr>`;

					availableTargets.slice(0, 20).forEach((target, index) => {
						const rankColor = TCG_Ranking.getRankColor(target.rank);
						const winRate = TCG_Ranking.getWinRate(target.wins, target.losses, target.draws);

						output += `<tr class="themed-table-row">`;
						output += `<td>${index + 1}</td>`;
						output += `<td>${Impulse.nameColor(target.userId, true)}</td>`;
						output += `<td><span style="color: ${rankColor};">${target.elo} (${target.rank})</span></td>`;
						output += `<td>${target.wins}-${target.losses}-${target.draws} (${winRate}%)</td>`;
						output += `<td><button name="send" value="/tcg rankedbattle challenge, ${target.userId}">Challenge</button></td>`;
						output += `</tr>`;
					});

					output += `</table>`;
					
					if (availableTargets.length > 20) {
						output += `<p style="text-align:center;">Showing top 20 of ${availableTargets.length} available targets.</p>`;
					}
				}

				output += `</div>`;
				this.sendReplyBox(output);

			} catch (e: any) {
				return this.errorReply(`Error fetching targets: ${e.message}`);
			}
			break;
		}

		case 'status': {
			if (!this.runBroadcast()) return;
			
			try {
				const challengeStatus = await TCG_Ranking.getDailyChallengeStatus(user.id);
				const nextReset = new Date(challengeStatus.nextReset);

				let output = `<div class="infobox">`;
				output += `<h3>Daily Challenge Status</h3>`;
				output += `<p><strong>Challenges Remaining:</strong> ${challengeStatus.challengesRemaining}/10</p>`;
				output += `<p><strong>Challenges Used:</strong> ${challengeStatus.challengesUsed}/10</p>`;
				output += `<p><strong>Next Reset:</strong> ${nextReset.toLocaleString()}</p>`;

				if (challengeStatus.recentChallenges.length > 0) {
					output += `<h4>Recent Challenges Today:</h4>`;
					output += `<ul>`;
					challengeStatus.recentChallenges.forEach(challenge => {
						const time = new Date(challenge.timestamp).toLocaleTimeString();
						output += `<li>${Impulse.nameColor(challenge.targetUserId, true)} at ${time}</li>`;
					});
					output += `</ul>`;
				}

				output += `</div>`;
				this.sendReplyBox(output);

			} catch (e: any) {
				return this.errorReply(`Error fetching challenge status: ${e.message}`);
			}
			break;
		}

		default:
			this.errorReply("Usage: /tcg rankedbattle [challenge/targets/status], [user]");
	}
},

async ranking(target, room, user) {
	if (!this.runBroadcast()) return;
	const targetUser = target.trim() || user.name;
	const targetId = toID(targetUser);
	
	try {
		const [ranking, position] = await Promise.all([
			TCG_Ranking.getPlayerRanking(targetId),
			TCG_Ranking.getPlayerRankPosition(targetId)
		]);
		
		const rankColor = TCG_Ranking.getRankColor(ranking.rank);
		const winRate = TCG_Ranking.getWinRate(ranking.wins, ranking.losses, ranking.draws);
		
		let output = `<div class="infobox">`;
		output += `<h3>${Impulse.nameColor(targetUser, true)}'s Ranking</h3>`;
		output += `<table style="width: 100%;">`;
		output += `<tr><td><strong>Rank:</strong></td><td><span style="color: ${rankColor}; font-weight: bold;">${ranking.rank}</span></td></tr>`;
		output += `<tr><td><strong>ELO:</strong></td><td>${ranking.elo}</td></tr>`;
		output += `<tr><td><strong>Position:</strong></td><td>#${position}</td></tr>`;
		output += `<tr><td><strong>Win Rate:</strong></td><td>${winRate}%</td></tr>`;
		output += `<tr><td><strong>Record:</strong></td><td>${ranking.wins}W - ${ranking.losses}L - ${ranking.draws}D</td></tr>`;
		output += `<tr><td><strong>Win Streak:</strong></td><td>${ranking.winStreak} (Best: ${ranking.bestWinStreak})</td></tr>`;
		output += `<tr><td><strong>Total Battles:</strong></td><td>${ranking.totalBattles}</td></tr>`;
		output += `<tr><td><strong>Avg Pack Value:</strong></td><td>${ranking.averagePackValue} pts</td></tr>`;
		output += `</table>`;
		output += `</div>`;
		
		this.sendReplyBox(output);
	} catch (e: any) {
		return this.errorReply(`Error fetching ranking: ${e.message}`);
	}
},

async leaderboard(target, room, user) {
	await TCG_Ranking.getPlayerRanking(user.id);
	if (!this.runBroadcast()) return;
	const type = toID(target) || 'elo';
	
	try {
		let leaderboard;
		let title;
		
		if (type === 'seasonal') {
			leaderboard = await TCG_Ranking.getSeasonalLeaderboard(10);
			title = 'Seasonal Leaderboard (Wins)';
		} else {
			leaderboard = await TCG_Ranking.getLeaderboard(10);
			title = 'ELO Leaderboard';
		}
		
		let output = `<div class="infobox">`;
		output += `<h3>${title}</h3>`;
		output += `<table class="themed-table">`;
		output += `<tr class="themed-table-header">`;
		output += `<th>Rank</th><th>Player</th><th>Rating/Rank</th><th>Record</th><th>Win Rate</th>`;
		output += `</tr>`;
		
		leaderboard.forEach((player, index) => {
			const rankColor = TCG_Ranking.getRankColor(player.rank);
			const winRate = TCG_Ranking.getWinRate(player.wins, player.losses, player.draws);
			const displayValue = type === 'seasonal' ? 
				`${player.seasonWins || 0} wins` : 
				`${player.elo} (${player.rank})`;
			
			output += `<tr class="themed-table-row">`;
			output += `<td>${index + 1}</td>`;
			output += `<td>${Impulse.nameColor(player.userId, true)}</td>`;
			output += `<td><span style="color: ${rankColor};">${displayValue}</span></td>`;
			output += `<td>${player.wins}W-${player.losses}L-${player.draws}D</td>`;
			output += `<td>${winRate}%</td>`;
			output += `</tr>`;
		});
		
		output += `</table>`;
		output += `<p style="text-align: center; margin-top: 10px;">`;
		output += `<button name="send" value="/tcg leaderboard elo">ELO</button> | `;
		output += `<button name="send" value="/tcg leaderboard seasonal">Seasonal</button>`;
		output += `</p>`;
		output += `</div>`;
		
		this.sendReplyBox(output);
	} catch (e: any) {
		return this.errorReply(`Error fetching leaderboard: ${e.message}`);
	}
},

async battlehistory(target, room, user) {
	if (!this.runBroadcast()) return;
	const targetUser = target.trim() || user.name;
	const targetId = toID(targetUser);
	
	try {
		const [battles, simulatedBattles] = await Promise.all([
			TCG_Ranking.getPlayerBattleHistory(targetId, 5),
			TCG_Ranking.getSimulatedBattleHistory(targetId, 5)
		]);

		let output = `<div class="infobox">`;
		output += `<h3>${Impulse.nameColor(targetUser, true)}'s Battle History</h3>`;
		
		const allBattles = [
			...battles.map(b => ({ ...b, type: 'live' })),
			...simulatedBattles.map(b => ({ ...b, type: 'simulated', battleTime: b.timestamp }))
		].sort((a, b) => b.battleTime - a.battleTime).slice(0, 10);

		if (allBattles.length === 0) {
			output += `<p>${targetUser} has no ranked battle history.</p>`;
		} else {
			output += `<table class="themed-table">`;
			output += `<tr class="themed-table-header">`;
			output += `<th>Type</th><th>Opponent</th><th>Result</th><th>ELO Change</th><th>Pack Values</th><th>Date</th>`;
			output += `</tr>`;
			
			allBattles.forEach(battle => {
				const isPlayer1 = (battle.type === 'live' ? battle.player1 : battle.challengerId) === targetId;
				const opponent = battle.type === 'live' ? 
					(isPlayer1 ? battle.player2 : battle.player1) :
					(isPlayer1 ? battle.targetId : battle.challengerId);
				
				const playerPackValue = battle.type === 'live' ?
					(isPlayer1 ? battle.player1PackValue : battle.player2PackValue) :
					(isPlayer1 ? battle.challengerPackValue : battle.targetPackValue);
				
				const opponentPackValue = battle.type === 'live' ?
					(isPlayer1 ? battle.player2PackValue : battle.player1PackValue) :
					(isPlayer1 ? battle.targetPackValue : battle.challengerPackValue);
				
				const eloChange = battle.type === 'live' ?
					(isPlayer1 ? battle.player1EloChange : battle.player2EloChange) :
					(isPlayer1 ? battle.challengerEloChange : battle.targetEloChange);
				
				let result = 'Draw';
				let resultColor = '#f1c40f';
				if (battle.winner === targetId) {
					result = 'Win';
					resultColor = '#2ecc71';
				} else if (battle.winner && battle.winner !== targetId) {
					result = 'Loss';
					resultColor = '#e74c3c';
				}
				
				const eloChangeStr = TCG_Ranking.formatEloChange(eloChange);
				const eloColor = eloChange >= 0 ? '#2ecc71' : '#e74c3c';
				const date = new Date(battle.battleTime).toLocaleDateString();
				const battleType = battle.type === 'live' ? '🎯' : '🤖';
				
				output += `<tr class="themed-table-row">`;
				output += `<td>${battleType}</td>`;
				output += `<td>${Impulse.nameColor(opponent, true)}</td>`;
				output += `<td><span style="color: ${resultColor};">${result}</span></td>`;
				output += `<td><span style="color: ${eloColor};">${eloChangeStr}</span></td>`;
				output += `<td>${playerPackValue} vs ${opponentPackValue}</td>`;
				output += `<td>${date}</td>`;
				output += `</tr>`;
			});
			
			output += `</table>`;
			output += `<p style="font-size: 0.9em; margin-top: 10px;">🎯 = Live Battle | 🤖 = Simulated Challenge</p>`;
		}
		
		output += `</div>`;
		this.sendReplyBox(output);
	} catch (e: any) {
		return this.errorReply(`Error fetching battle history: ${e.message}`);
	}
},

async season(target, room, user) {
	await TCG_Ranking.getPlayerRanking(user.id);
	if (!this.runBroadcast()) return;
	const [action] = target.split(',').map(p => p.trim());
	
	try {
		if (toID(action) === 'end' && this.checkCan('globalban')) {
			// Admin command to force end season
			const success = await TCG_Ranking.forceEndSeason();
			if (success) {
				this.sendReply("Current season has been ended and rewards distributed. New season started!");
			} else {
				this.errorReply("No active season found to end.");
			}
			return;
		}
		
		// Show current season info
		const seasonInfo = await TCG_Ranking.getCurrentSeasonInfo();
		if (!seasonInfo) {
			return this.sendReplyBox("No active season found.");
		}
		
		const { season, daysRemaining, hoursRemaining } = seasonInfo;
		
		let output = `<div class="infobox">`;
		output += `<h3>🏆 ${season.name}</h3>`;
		output += `<p><strong>Time Remaining:</strong> ${daysRemaining} days, ${hoursRemaining} hours</p>`;
		output += `<p><strong>Started:</strong> ${new Date(season.startTime).toLocaleDateString()}</p>`;
		output += `<p><strong>Ends:</strong> ${new Date(season.endTime).toLocaleDateString()}</p>`;
		
		output += `<h4>Season Rewards (Top 10)</h4>`;
		output += `<table class="themed-table">`;
		output += `<tr class="themed-table-header"><th>Rank</th><th>Credits</th><th>Title</th></tr>`;
		
		Object.entries(TCG_Ranking.SEASON_REWARDS).forEach(([rank, reward]) => {
			output += `<tr class="themed-table-row">`;
			output += `<td>#${rank}</td>`;
			output += `<td>${reward.credits}</td>`;
			output += `<td>${reward.title}</td>`;
			output += `</tr>`;
		});
		
		output += `</table>`;
		output += `</div>`;
		
		this.sendReplyBox(output);
	} catch (e: any) {
		return this.errorReply(`Error fetching season info: ${e.message}`);
	}
},

async seasonhistory(target, room, user) {
	await TCG_Ranking.getPlayerRanking(user.id);
	if (!this.runBroadcast()) return;
	const targetUser = target.trim() || user.name;
	const targetId = toID(targetUser);
	
	try {
		const seasonRewards = await TCG_Ranking.getUserSeasonRewards(targetId);
		
		let output = `<div class="infobox">`;
		output += `<h3>${Impulse.nameColor(targetUser, true)}'s Season History</h3>`;
		
		if (seasonRewards.length === 0) {
			output += `<p>${targetUser} has not received any season rewards yet.</p>`;
		} else {
			output += `<table class="themed-table">`;
			output += `<tr class="themed-table-header"><th>Season</th><th>Rank</th><th>Credits</th><th>Title</th><th>Date</th></tr>`;
			
			seasonRewards.forEach(reward => {
				const date = new Date(reward.claimedAt).toLocaleDateString();
				output += `<tr class="themed-table-row">`;
				output += `<td>${reward.seasonId.replace(/season_(\d+)_.*/, 'Season $1')}</td>`;
				output += `<td>#${reward.rank}</td>`;
				output += `<td>${reward.credits}</td>`;
				output += `<td>${reward.title || '-'}</td>`;
				output += `<td>${date}</td>`;
				output += `</tr>`;
			});
			
			output += `</table>`;
		}
		
		output += `</div>`;
		this.sendReplyBox(output);
	} catch (e: any) {
		return this.errorReply(`Error fetching season history: ${e.message}`);
	}
},					
	},
	
	tcghelp: [
		'/tcg daily - Claim your free random pack of the day and some credits.',
		'/tcg currency [user] - Check your or another user\'s credit balance.',
		'/tcg pay [user], [amount] - Give credits to another user.',
		'/tcg shop - View the daily rotating card pack shop.',
		'/tcg shop buy, [set ID] - Buy a booster pack from the shop.',
		'/tcg packs - View and open your saved packs.',
		'/tcg battle challenge, [user], [wager] - Challenge a user to a pack battle.',
		'/tcg battle accept, [user] - Accept a pack battle challenge.',
		'/tcg collection [user], [filters] - View a user\'s TCG card collection.',
		'/tcg card [cardId] - View the details of a specific card.',
		'/tcg search [filter]:[value] - Search for cards in the database.',
		'/tcg setprogress [user], [set ID] - Check collection progress for a set.',
		'/tcg wishlist [user] - View a user\'s wishlist.',
		'/tcg wishlist add, [cardId] - Add a card to your wishlist.',
		'/tcg wishlist remove, [cardId] - Remove a card from your wishlist.',
		'/tcg stats [total|unique|points] - View global TCG statistics.',
		'/tcg sets - View all Pokemon TCG sets.',
		'/tcg rarities - View all card rarities.',
		'/tcg types - View all supertypes, types, and subtypes.',
		'@ /tcg givecurrency [user], [amount] - Give credits to a user.',
		'@ /tcg takecurrency [user], [amount] - Take credits from a user.',
		'@ /tcg setcurrency [user], [amount] - Set a user\'s credit balance.',
		'@ /tcg openpack [set ID] - Open a pack of cards from a specific set.',
		'@ /tcg addcard [id], [name], [set]... - Add a card to the database.',
		'/tcg rankedbattle challenge, [user] - Challenge a user to a simulated ranked battle (10 daily, no wager).',
		'/tcg rankedbattle targets - View available players you can challenge today.',
		'/tcg rankedbattle status - Check your daily challenge status and history.',
		'/tcg season - View current season information and rewards.',
		'/tcg seasonhistory [user] - View season reward history for a user.',
		'/tcg ranking [user] - View ranking information for a user.',
		'/tcg leaderboard [elo|seasonal] - View the ELO or seasonal leaderboards.',
		'/tcg battlehistory [user] - View ranked battle history for a user.',
		'@ /tcg season end - Force end the current season (admin only).',
	],
};
