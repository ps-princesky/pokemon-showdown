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
				const newCards: string[] = []; // NEW: Track new cards
				
				for (const card of pack) {
					pointsGained += getCardPoints(card);
					if (card.battleValue) totalBattleValue += card.battleValue;
					
					const existingCard = collection.cards.find(c => c.cardId === card.cardId);
					if (existingCard) {
						existingCard.quantity++;
					} else {
						collection.cards.push({ cardId: card.cardId, quantity: 1, addedAt: Date.now() });
						newCards.push(card.cardId); // Mark as new
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
				
				// Sort by battle value first, then rarity points
				pack.sort((a, b) => {
					const bvDiff = (b.battleValue || 0) - (a.battleValue || 0);
					if (bvDiff !== 0) return bvDiff;
					return getCardPoints(b) - getCardPoints(a);
				});
				
				// NEW: Enhanced pack opening display
				const getRarityColor = (rarity: string): string => {
					const colors: {[key: string]: string} = {
						'common': '#808080','uncommon': '#2ECC71','rare': '#3498DB','double rare': '#3CB371',
						'rare holo': '#9B59B6','reverse holo': '#00CED1','rare ultra': '#E74C3C',
						'illustration rare': '#4ECDC4','special illustration rare': '#C71585',
						'rare secret': '#F39C12','rare rainbow': '#E91E63','hyper rare': '#FF10F0',
					};
					return colors[rarity.toLowerCase()] || '#808080';
				};
				
				let content = `<div style="text-align: center; margin-bottom: 15px;">` +
					`<h3 style="margin: 0;">🎴 ${displaySetName} Pack Opening!</h3>` +
					`<div style="display: flex; justify-content: center; gap: 15px; margin-top: 10px; flex-wrap: wrap;">` +
					`<div style="padding: 8px 15px; background: rgba(241,196,15,0.1); border: 2px solid #f1c40f; border-radius: 6px;">` +
					`<strong style="color: #f39c12;">${pointsGained}</strong> Points` +
					`</div>`;
				
				if (totalBattleValue > 0) {
					content += `<div style="padding: 8px 15px; background: rgba(231,76,60,0.1); border: 2px solid #e74c3c; border-radius: 6px;">` +
						`<strong style="color: #e74c3c;">⚔️ ${totalBattleValue}</strong> Battle Value` +
						`</div>`;
				}
				
				if (newCards.length > 0) {
					content += `<div style="padding: 8px 15px; background: rgba(46,204,113,0.1); border: 2px solid #2ecc71; border-radius: 6px;">` +
						`<strong style="color: #27ae60;">✨ ${newCards.length}</strong> New Card${newCards.length > 1 ? 's' : ''}` +
						`</div>`;
				}
				
				content += `</div></div><hr/>`;
				
				// NEW: Enhanced card table with highlights
				content += `<div style="max-height: 400px; overflow-y: auto;"><table class="themed-table">` +
					`<tr class="themed-table-header">` +
					`<th>Card</th>` +
					`<th>Rarity</th>` +
					`<th>Type</th>` +
					`<th>HP</th>` +
					`<th>⚔️ BV</th>` +
					`<th></th>` +
					`</tr>`;
				
				for (const card of pack) {
					const rarityColor = getRarityColor(card.rarity);
					const isNew = newCards.includes(card.cardId);
					const isHighValue = card.battleValue && card.battleValue >= 100;
					
					// Add highlight for new or high-value cards
					let rowStyle = '';
					if (isHighValue) {
						rowStyle = 'background: linear-gradient(90deg, rgba(231,76,60,0.15), transparent); border-left: 3px solid #e74c3c;';
					} else if (isNew) {
						rowStyle = 'background: linear-gradient(90deg, rgba(46,204,113,0.15), transparent); border-left: 3px solid #2ecc71;';
					}
					
					content += `<tr class="themed-table-row" style="${rowStyle}">` +
						`<td><button name="send" value="/tcg card ${card.cardId}" style="background:none; border:none; padding:0; font-weight:bold; color:inherit; text-decoration:underline; cursor:pointer;">${card.name}</button></td>` +
						`<td><span style="color: ${rarityColor}; font-weight: bold;">${card.rarity.toUpperCase()}</span></td>` +
						`<td>${card.type || card.supertype}</td>` +
						`<td>${card.hp || '-'}</td>`;
					
					// Battle Value
					if (card.battleValue) {
						let bvColor = '#95a5a6';
						if (card.battleValue >= 150) bvColor = '#e74c3c';
						else if (card.battleValue >= 100) bvColor = '#f39c12';
						else if (card.battleValue >= 70) bvColor = '#3498db';
						
						content += `<td><strong style="color: ${bvColor}; font-size: 1.1em;">${card.battleValue}</strong></td>`;
					} else {
						content += `<td>-</td>`;
					}
					
					// Badges
					let badges = '';
					if (isNew) badges += `<span style="background: #2ecc71; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.75em; font-weight: bold; margin-right: 4px;">NEW</span>`;
					if (isHighValue) badges += `<span style="background: #e74c3c; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.75em; font-weight: bold;">⚔️</span>`;
					
					content += `<td style="text-align: right;">${badges}</td>`;
					content += `</tr>`;
				}
				
				content += `</table></div>`;
				
				// NEW: Pack summary footer
				const bestCard = pack[0]; // Already sorted by battle value
				if (bestCard && bestCard.battleValue && bestCard.battleValue >= 100) {
					content += `<div style="margin-top: 15px; padding: 10px; background: rgba(231,76,60,0.1); border: 2px solid #e74c3c; border-radius: 6px; text-align: center;">` +
						`<strong style="color: #e74c3c;">🎉 Best Pull:</strong> ` +
						`<button name="send" value="/tcg card ${bestCard.cardId}" style="background:none; border:none; padding:0; font-weight:bold; color:#e74c3c; text-decoration:underline; cursor:pointer;">${bestCard.name}</button> ` +
						`(⚔️ ${bestCard.battleValue})` +
						`</div>`;
				}
				
				const output = TCG_UI.buildPage(`🎴 ${user.name} opened a ${displaySetName} Pack!`, content);
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
