/**
 * Shop and pack-related TCG commands
 */

import * as TCG_Economy from '../../../impulse/psgo-plugin/tcg_economy';
import * as TCG_UI from '../../../impulse/psgo-plugin/tcg_ui';
import * as TCG_Ranking from '../../../impulse/psgo-plugin/tcg_ranking';
import { UserCollections, ShopStateCollection, TCGCards } from '../../../impulse/psgo-plugin/tcg_collections';
import { POKEMON_SETS, getRarityColor } from '../../../impulse/psgo-plugin/tcg_data';
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
					const rows = currentStock.map(setId => {
						const setInfo = POKEMON_SETS.find(s => toID(s.code) === toID(setId));
						const setName = setInfo ? setInfo.name : setId;
						return [
							`<strong>${setName}</strong>`,
							setId,
							`${SHOP_CONFIG.PACK_PRICE} Credits`,
							`<button name="send" value="/tcg shop buy, ${setId}">Buy</button>`
						];
					});

					content += `<h4>Booster Packs for Sale</h4>` +
						TCG_UI.buildTable({
							headers: ['Set Name', 'Set ID', 'Price', ''],
							rows,
							scrollable: false
						});
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
				let totalBattleValue = 0; // NEW: Track battle value
				for (const card of pack) {
					pointsGained += getCardPoints(card);
					if (card.battleValue) {
						totalBattleValue += card.battleValue;
					}
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
				
				// NEW: Sort by battle value first, then rarity points
				pack.sort((a, b) => {
					const bvDiff = (b.battleValue || 0) - (a.battleValue || 0);
					if (bvDiff !== 0) return bvDiff;
					return getCardPoints(b) - getCardPoints(a);
				});

				// NEW: Enhanced pack opening display with battle data highlights
				let output = `<div class="themed-table-container">` +
					`<h3 class="themed-table-title">🎴 ${user.name} opened a ${displaySetName} Pack!</h3>`;

				// NEW: Pack summary stats
				output += `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin: 15px 0;">` +
					`<div style="padding: 10px; background: rgba(241,196,15,0.1); border: 2px solid #f1c40f; border-radius: 6px; text-align: center;">` +
					`<div style="font-size: 1.2em; font-weight: bold; color: #f39c12;">${pointsGained}</div>` +
					`<div style="font-size: 0.85em; color: #666;">Total Points</div>` +
					`</div>`;
				
				if (totalBattleValue > 0) {
					output += `<div style="padding: 10px; background: rgba(231,76,60,0.1); border: 2px solid #e74c3c; border-radius: 6px; text-align: center;">` +
						`<div style="font-size: 1.2em; font-weight: bold; color: #e74c3c;">⚔️ ${totalBattleValue}</div>` +
						`<div style="font-size: 0.85em; color: #666;">Battle Value</div>` +
						`</div>`;
				}
				
				output += `</div>`;

				// NEW: Find highlight cards (high battle value or high rarity)
				const highlightCards = pack.filter(card => {
					const points = getCardPoints(card);
					return (card.battleValue && card.battleValue >= 100) || points >= 60;
				});

				if (highlightCards.length > 0) {
					output += `<div style="background: linear-gradient(135deg, rgba(231,76,60,0.1), rgba(241,196,15,0.1)); border: 2px solid #e74c3c; border-radius: 8px; padding: 12px; margin-bottom: 15px;">` +
						`<strong style="color: #e74c3c; font-size: 1.1em;">✨ Highlight Pulls!</strong>` +
						`<div style="margin-top: 8px;">`;
					
					highlightCards.forEach(card => {
						const rarityColor = getRarityColor(card.rarity);
						output += `<div style="margin: 6px 0; padding: 8px; background: rgba(255,255,255,0.5); border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">` +
							`<div>` +
							`<button name="send" value="/tcg card ${card.cardId}" style="background:none; border:none; padding:0; font-weight:bold; color:inherit; text-decoration:underline; cursor:pointer; font-size: 1.05em;">${card.name}</button>` +
							` <span style="color: ${rarityColor}; font-weight: bold;">(${card.rarity})</span>` +
							`</div>`;
						
						if (card.battleValue) {
							let bvColor = '#e74c3c';
							if (card.battleValue >= 150) bvColor = '#c0392b';
							output += `<div style="color: ${bvColor}; font-weight: bold;">⚔️ ${card.battleValue} BV</div>`;
						}
						
						output += `</div>`;
					});
					
					output += `</div></div>`;
				}

				// Enhanced table with battle value
				output += `<div style="max-height: 380px; overflow-y: auto;"><table class="themed-table">` +
					`<tr class="themed-table-header">` +
					`<th>Name</th>` +
					`<th>Rarity</th>` +
					`<th>Type</th>` +
					`<th>HP</th>` +
					`<th>⚔️ BV</th>` +
					`<th>Pts</th>` +
					`</tr>`;

				for (const card of pack) {
					const rarityColor = getRarityColor(card.rarity);
					const points = getCardPoints(card);
					
					output += `<tr class="themed-table-row">` +
						`<td><button name="send" value="/tcg card ${card.cardId}" style="background:none; border:none; padding:0; font-weight:bold; color:inherit; text-decoration:underline; cursor:pointer;">${card.name}</button></td>` +
						`<td><span style="color: ${rarityColor}">${card.rarity.toUpperCase()}</span></td>` +
						`<td>${card.type || card.supertype}</td>` +
						`<td>${card.hp || '-'}</td>`;
					
					// Battle Value with color coding
					if (card.battleValue) {
						let bvColor = '#95a5a6';
						if (card.battleValue >= 150) bvColor = '#e74c3c';
						else if (card.battleValue >= 100) bvColor = '#f39c12';
						else if (card.battleValue >= 70) bvColor = '#3498db';
						
						output += `<td><strong style="color: ${bvColor}">${card.battleValue}</strong></td>`;
					} else {
						output += `<td>-</td>`;
					}
					
					output += `<td><strong>${points}</strong></td>` +
						`</tr>`;
				}

				output += `</table></div></div>`;

				await TCG_Ranking.updateMilestoneProgress(userId, 'packsOpened', 1);
				this.sendReplyBox(output);

			} else { // View pack inventory
				if (!this.runBroadcast()) return;

				if (!collection || !collection.packs?.length) {
					const output = TCG_UI.buildPage(
						`${user.name}'s Unopened Packs`,
						`You do not have any unopened packs. You can buy some from the <code>/tcg shop</code>.`
					);
					return this.sendReplyBox(output);
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
