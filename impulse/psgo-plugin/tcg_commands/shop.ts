/**
 * Shop and pack-related TCG commands
 */

import * as TCG_Economy from '../../../impulse/psgo-plugin/tcg_economy';
import * as TCG_UI from '../../../impulse/psgo-plugin/tcg_ui';
import * as TCG_Ranking from '../../../impulse/psgo-plugin/tcg_ranking';
import { UserCollections, ShopStateCollection, TCGCards } from '../../../impulse/psgo-plugin/tcg_collections';
import { POKEMON_SETS } from '../../../impulse/psgo-plugin/tcg_data';
import { SHOP_CONFIG, ERROR_MESSAGES } from '../../../impulse/psgo-plugin/tcg_config';
import { generatePack, getCardPoints, ensureUserCollection } from './shared';

export const shopCommands: Chat.ChatCommands = {
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
			if (shopState && now - shopState.lastRotation < SHOP_CONFIG.ROTATION_HOURS * 60 * 60 * 1000 && shopState.stock.length > 0) {
				return shopState.stock; // No rotation needed, return current stock
			}

			// Need to rotate - get available sets
			const availableSets = await TCGCards.distinct('set');
			if (availableSets.length === 0) {
				// No sets available, update database with empty stock
				await ShopStateCollection.updateOne(
					{ _id: 'main' },
					{ $set: { stock: [], lastRotation: now } },
					{ upsert: true }
				);
				return [];
			}

			// Shuffle the available sets to get a random selection
			for (let i = availableSets.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[availableSets[i], availableSets[j]] = [availableSets[j], availableSets[i]];
			}

			// Get random sets for shop slots
			const newStock = availableSets.slice(0, SHOP_CONFIG.PACK_SLOTS);

			// Update database with new stock and rotation time
			await ShopStateCollection.updateOne(
				{ _id: 'main' },
				{ $set: { stock: newStock, lastRotation: now } },
				{ upsert: true }
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

				const canAfford = await TCG_Economy.deductCurrency(userId, SHOP_CONFIG.PACK_PRICE);
				if (!canAfford) {
					return this.errorReply(`${ERROR_MESSAGES.INSUFFICIENT_CREDITS}. You need ${SHOP_CONFIG.PACK_PRICE} Credits.`);
				}
		
				let collection = await ensureUserCollection(userId);

				const packEntry = collection.packs.find(p => p.setId === setId);
				if (packEntry) {
					packEntry.quantity++;
				} else {
					collection.packs.push({ setId, quantity: 1 });
				}
		
				await UserCollections.updateOne(
					{ userId },
					{ $set: collection },
					{ upsert: true }
				);
				await TCG_Ranking.updateMilestoneProgress(userId, 'packsPurchased', 1);

				const setInfo = POKEMON_SETS.find(s => toID(s.code) === toID(setId));
				const displaySetName = setInfo ? setInfo.name : setId;
		
				return this.sendReply(`You have purchased one "${displaySetName}" pack! Use /tcg packs to view and open your packs.`);
				
			} else { // View the shop
				if (!this.runBroadcast()) return;
				const balance = await TCG_Economy.getUserBalance(userId);

				let content = `<p>Welcome to the TCG Shop! New packs rotate in every ${SHOP_CONFIG.ROTATION_HOURS} hours.</p>` +
					`<p><strong>Your Balance:</strong> ${balance} Credits</p><hr/>`;
		
				if (currentStock.length === 0) {
					content += `<p>${ERROR_MESSAGES.SHOP_EMPTY}. Please check back later.</p>`;
				} else {
					content += `<h4>Booster Packs for Sale</h4>` +
						`<table class="themed-table">` +
						`<tr class="themed-table-header"><th>Set Name</th><th>Set ID</th><th>Price</th><th></th></tr>`;
					for (const setId of currentStock) {
						const setInfo = POKEMON_SETS.find(s => toID(s.code) === toID(setId));
						const setName = setInfo ? setInfo.name : setId;
						content += `<tr class="themed-table-row">` +
							`<td><strong>${setName}</strong></td>` +
							`<td>${setId}</td>` +
							`<td>${SHOP_CONFIG.PACK_PRICE} Credits</td>` +
							`<td><button name="send" value="/tcg shop buy, ${setId}">Buy</button></td>` +
							`</tr>`;
					}
					content += `</table>`;
				}
				const output = TCG_UI.buildPage('TCG Card Shop', content);
				this.sendReplyBox(output);
			}
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
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
					return this.errorReply(ERROR_MESSAGES.NO_PACKS);
				}
				
				const packEntry = collection.packs.find(p => p.setId === setId);
				if (!packEntry || packEntry.quantity < 1) {
					return this.errorReply(`You do not have any unopened packs from the set "${setId}".`);
				}

				// --- Pack Opening Logic ---
				const pack = await generatePack(setId);
				if (!pack) {
					return this.errorReply(`${ERROR_MESSAGES.PACK_GENERATION_FAILED} for "${setId}".`);
				}

				packEntry.quantity--;
				if (packEntry.quantity <= 0) {
					collection.packs = collection.packs.filter(p => p.setId !== setId);
				}

				collection = await ensureUserCollection(userId);
				
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
				await UserCollections.updateOne(
					{ userId },
					{ $set: collection },
					{ upsert: true }
				);
				
				const setInfo = POKEMON_SETS.find(s => toID(s.code) === toID(setId));
				const displaySetName = setInfo ? setInfo.name : setId;
				
				pack.sort((a, b) => getCardPoints(b) - getCardPoints(a));
				const tableHtml = TCG_UI.generateCardTable(pack, ['name', 'set', 'rarity', 'type']);
				const output = TCG_UI.buildPage(`🎴 ${user.name} opened a ${displaySetName} Pack!`, tableHtml);
				await TCG_Ranking.updateMilestoneProgress(userId, 'packsOpened', 1);
				this.sendReplyBox(output);

			} else { // View pack inventory
				if (!this.runBroadcast()) return;

				if (!collection || !collection.packs?.length) {
					return this.sendReplyBox(TCG_UI.buildPage(`${user.name}'s Unopened Packs`, `You do not have any unopened packs. You can buy some from the <code>/tcg shop</code>.`));
				}

				let content = `<p>Click a button below to open one pack.</p><hr/>` +
					`<div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;">`;

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
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},
};
