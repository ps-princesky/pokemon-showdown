/**
 * Shop and pack opening TCG commands
 */

import * as TCG_Economy from '../tcg_economy';
import * as TCG_Ranking from '../tcg_ranking';
import { TCGCards, UserCollections } from '../tcg_collections';
import { SHOP_CONFIG, ERROR_MESSAGES, VALIDATION_LIMITS } from '../tcg_config';
import { generatePack, getCardPoints, ensureUserCollection, addCardToCollection, updateCollectionStats, formatPackCard, getRarityColor } from './shared';

export const shopCommands: Chat.ChatCommands = {

	async shop(target, room, user) {
		if (!this.runBroadcast()) return;
		await TCG_Ranking.getPlayerRanking(user.id);
		
		try {
			const balance = await TCG_Economy.getCurrency(user.id);
			
			// Get available sets from database (handle new card structure)
			const allSets = await TCGCards.distinct('set');
			const flatSets = allSets.flat().filter(Boolean);
			const uniqueSets = [...new Set(flatSets)];
			
			if (uniqueSets.length === 0) {
				return this.sendReplyBox(`<div class="infobox">` +
					`<h2 style="text-align:center;">🛒 TCG Shop</h2>` +
					`<div style="text-align:center; margin:20px 0; color:#666;">` +
					`Shop is currently empty. Please check back later.` +
					`</div>` +
					`</div>`);
			}
			
			// Get random featured sets for the shop (simulate rotation)
			const hourOfDay = Math.floor(Date.now() / (1000 * 60 * 60)) % SHOP_CONFIG.ROTATION_HOURS;
			const shuffledSets = uniqueSets.sort(() => Math.sin(hourOfDay) - 0.5);
			const featuredSets = shuffledSets.slice(0, SHOP_CONFIG.FEATURED_SETS || 6);
			
			let output = `<div class="infobox">` +
				`<h2 style="text-align:center;">🛒 TCG Shop</h2>` +
				`<div style="text-align:center; margin:15px 0;">` +
				`<div style="font-size:1.2em; color:#f39c12; font-weight:bold;">` +
				`Your Balance: ${balance.toLocaleString()} Credits` +
				`</div>` +
				`<div style="font-size:0.9em; color:#666; margin-top:5px;">` +
				`New packs rotate every ${SHOP_CONFIG.ROTATION_HOURS} hours` +
				`</div>` +
				`</div>`;
			
			// Shop grid
			output += `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(250px, 1fr)); gap:15px; margin:20px 0;">`;
			
			for (const setId of featuredSets) {
				// Get set info
				const setCards = await TCGCards.find({
					$or: [
						{ set: setId },
						{ set: { $in: [setId] } }
					]
				}).limit(5);
				
				if (setCards.length === 0) continue;
				
				const setName = setId.toUpperCase();
				const price = SHOP_CONFIG.PACK_PRICE || 100;
				const canAfford = balance >= price;
				
				// Get rarity breakdown for preview
				const rarities = setCards.map(c => c.rarity);
				const uniqueRarities = [...new Set(rarities)];
				
				output += `<div style="border:1px solid #ddd; border-radius:8px; padding:15px; background:#f9f9f9;">` +
					`<div style="text-align:center; margin-bottom:10px;">` +
					`<div style="font-weight:bold; font-size:1.1em; color:#2c3e50;">${setName}</div>` +
					`<div style="font-size:0.9em; color:#666; margin:5px 0;">${setCards.length}+ cards available</div>` +
					`</div>`;
				
				// Rarity preview
				if (uniqueRarities.length > 0) {
					output += `<div style="margin:10px 0;">`;
					uniqueRarities.slice(0, 3).forEach(rarity => {
						output += `<span style="background:${getRarityColor(rarity)}15; color:${getRarityColor(rarity)}; border:1px solid ${getRarityColor(rarity)}; padding:2px 5px; border-radius:3px; font-size:0.7em; margin:1px;">${rarity}</span>`;
					});
					if (uniqueRarities.length > 3) {
						output += `<span style="color:#666; font-size:0.8em;">+${uniqueRarities.length - 3} more</span>`;
					}
					output += `</div>`;
				}
				
				// Price and buy button
				output += `<div style="text-align:center; margin-top:15px;">` +
					`<div style="font-size:1.1em; color:#f39c12; font-weight:bold; margin-bottom:8px;">` +
					`${price} Credits` +
					`</div>`;
				
				if (canAfford) {
					output += `<button name="send" value="/tcg open ${setId}" style="background:#27ae60; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold; width:100%;">` +
						`🎁 Buy Pack` +
						`</button>`;
				} else {
					output += `<button disabled style="background:#95a5a6; color:white; border:none; padding:8px 15px; border-radius:5px; width:100%; opacity:0.6;">` +
						`Insufficient Funds` +
						`</button>`;
				}
				
				output += `</div></div>`;
			}
			
			output += `</div>`;
			
			// Quick actions
			output += `<div style="text-align:center; margin:20px 0; padding:15px; background:#f0f8ff; border-radius:5px;">` +
				`<h4 style="margin:0 0 10px 0;">💡 Quick Actions</h4>` +
				`<div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">` +
				`<button name="send" value="/tcg daily" style="background:#3498db; color:white; border:none; padding:5px 10px; border-radius:3px; cursor:pointer;">🎁 Daily Pack</button>` +
				`<button name="send" value="/tcg currency" style="background:#f39c12; color:white; border:none; padding:5px 10px; border-radius:3px; cursor:pointer;">💰 Balance</button>` +
				`<button name="send" value="/tcg collection" style="background:#9b59b6; color:white; border:none; padding:5px 10px; border-radius:3px; cursor:pointer;">📦 Collection</button>` +
				`</div>` +
				`</div>`;
			
			output += `</div>`;
			
			this.sendReplyBox(output);
			
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async open(target, room, user) {
		if (!this.runBroadcast()) return;
		await TCG_Ranking.getPlayerRanking(user.id);
		
		if (!target) {
			return this.errorReply("Usage: /tcg open [set ID]. Use /tcg shop to see available packs.");
		}
		
		const setId = target.trim().toLowerCase();
		const userId = user.id;
		
		try {
			// Check if user can afford pack
			const balance = await TCG_Economy.getCurrency(userId);
			const packPrice = SHOP_CONFIG.PACK_PRICE || 100;
			
			if (balance < packPrice) {
				return this.errorReply(`You need ${packPrice} Credits to open a pack. Your balance: ${balance} Credits.`);
			}
			
			// Generate pack
			const pack = await generatePack(setId);
			
			if (!pack || pack.length === 0) {
				return this.errorReply(`Set "${target.trim()}" not found or has no cards available. Use /tcg shop to see available sets.`);
			}
			
			// Deduct currency
			const deductSuccess = await TCG_Economy.deductCurrency(userId, packPrice);
			if (!deductSuccess) {
				return this.errorReply("Payment failed. Please try again.");
			}
			
			// Add cards to collection
			let collection = await ensureUserCollection(userId);
			let pointsGained = 0;
			
			for (const card of pack) {
				pointsGained += getCardPoints(card);
				addCardToCollection(collection, card.cardId, 1);
			}
			
			// Update collection stats
			updateCollectionStats(collection);
			collection.stats.totalPoints = (collection.stats.totalPoints || 0) + pointsGained;
			
			await UserCollections.upsert({ userId }, collection);
			
			// Sort pack by points (highest first) for better display
			pack.sort((a, b) => getCardPoints(b) - getCardPoints(a));
			
			// Enhanced pack opening display
			let output = `<div class="infobox">` +
				`<h2 style="text-align:center;">🎁 Pack Opened!</h2>` +
				`<div style="text-align:center; margin:15px 0;">` +
				`<div style="font-size:1.2em; margin-bottom:5px;">` +
				`📦 ${setId.toUpperCase()} Pack` +
				`</div>` +
				`<div style="color:#e74c3c; font-size:1.1em; margin:5px 0;">` +
				`-${packPrice} Credits | +${pointsGained} Points` +
				`</div>` +
				`<div style="color:#f39c12; font-size:0.9em;">` +
				`New Balance: ${balance - packPrice} Credits` +
				`</div>` +
				`</div><hr/>`;
			
			// Display cards with enhanced formatting
			pack.forEach((card, index) => {
				output += formatPackCard(card, true);
				
				// Add special highlight for best card
				if (index === 0 && pack.length > 1) {
					output = output.replace('border-left:3px solid', 'border-left:5px solid');
					output = output.replace('<div style="margin:5px 0;', '<div style="margin:5px 0; position:relative;');
					output = output.replace('</div>', '<span style="position:absolute; right:5px; top:0; background:#f39c12; color:white; padding:1px 4px; border-radius:2px; font-size:0.7em;">⭐ BEST</span></div>');
				}
			});
			
			// Pack summary
			const bestCard = pack[0];
			output += `<hr/>` +
				`<div style="margin:15px 0; padding:10px; background:${getRarityColor(bestCard.rarity)}15; border-radius:5px; text-align:center;">` +
				`<strong>🌟 Best Card:</strong> ` +
				`<span style="color:${getRarityColor(bestCard.rarity)}; font-weight:bold;">${bestCard.name}</span>` +
				` (${getCardPoints(bestCard)} pts)` +
				`</div>`;
			
			// Show battle value if Pokemon
			if (bestCard.supertype === 'Pokémon' && bestCard.battleValue) {
				output += `<div style="text-align:center; margin:10px 0; padding:8px; background:#e8f5e8; border-radius:5px;">` +
					`<strong>⚔️ Battle Ready:</strong> ${bestCard.name} has ${bestCard.battleValue} Battle Value!` +
					`</div>`;
			}
			
			// Quick actions
			output += `<div style="text-align:center; margin:20px 0; padding-top:15px; border-top:2px solid #ddd;">` +
				`<div style="margin-bottom:10px; font-size:0.9em; color:#666;">Want more packs?</div>` +
				`<button name="send" value="/tcg open ${setId}" style="background:#27ae60; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold; margin:5px;">` +
				`🎁 Open Another` +
				`</button>` +
				`<button name="send" value="/tcg shop" style="background:#3498db; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold; margin:5px;">` +
				`🛒 Shop` +
				`</button>` +
				`</div>`;
			
			output += `</div>`;
			
			// Update milestones
			await TCG_Ranking.updateMilestoneProgress(userId, 'packsOpened', 1);
			if (bestCard.rarity && bestCard.rarity.includes('Rare')) {
				await TCG_Ranking.updateMilestoneProgress(userId, 'rareCardsOpened', 1);
			}
			
			this.sendReplyBox(output);
			
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async buy(target, room, user) {
		if (!this.runBroadcast()) return;
		await TCG_Ranking.getPlayerRanking(user.id);
		
		const [item, quantityStr] = target.split(',').map(p => p.trim());
		
		if (!item) {
			return this.errorReply("Usage: /tcg buy [pack/item], [quantity (optional)]");
		}
		
		const quantity = quantityStr ? parseInt(quantityStr) : 1;
		
		if (isNaN(quantity) || quantity < 1 || quantity > VALIDATION_LIMITS.MAX_PACK_QUANTITY) {
			return this.errorReply(`Quantity must be between 1 and ${VALIDATION_LIMITS.MAX_PACK_QUANTITY}.`);
		}
		
		try {
			// For now, treat all items as packs
			const setId = item.toLowerCase();
			const packPrice = SHOP_CONFIG.PACK_PRICE || 100;
			const totalCost = packPrice * quantity;
			
			const balance = await TCG_Economy.getCurrency(user.id);
			
			if (balance < totalCost) {
				return this.errorReply(`You need ${totalCost} Credits to buy ${quantity} pack(s). Your balance: ${balance} Credits.`);
			}
			
			// Deduct currency first
			const deductSuccess = await TCG_Economy.deductCurrency(user.id, totalCost);
			if (!deductSuccess) {
				return this.errorReply("Payment failed. Please try again.");
			}
			
			// Open multiple packs
			let collection = await ensureUserCollection(user.id);
			let totalPointsGained = 0;
			const allCards: any[] = [];
			
			for (let i = 0; i < quantity; i++) {
				const pack = await generatePack(setId);
				if (!pack) {
					// Refund if pack generation fails
					await TCG_Economy.grantCurrency(user.id, totalCost);
					return this.errorReply(`Set "${item}" not found or has no cards available.`);
				}
				
				allCards.push(...pack);
				
				for (const card of pack) {
					totalPointsGained += getCardPoints(card);
					addCardToCollection(collection, card.cardId, 1);
				}
			}
			
			// Update collection stats
			updateCollectionStats(collection);
			collection.stats.totalPoints = (collection.stats.totalPoints || 0) + totalPointsGained;
			
			await UserCollections.upsert({ userId: user.id }, collection);
			
			// Sort all cards by points
			allCards.sort((a, b) => getCardPoints(b) - getCardPoints(a));
			
			// Create bulk opening display
			let output = `<div class="infobox">` +
				`<h2 style="text-align:center;">🎁 Bulk Pack Opening!</h2>` +
				`<div style="text-align:center; margin:15px 0;">` +
				`<div style="font-size:1.2em; margin-bottom:5px;">` +
				`📦 ${quantity}x ${setId.toUpperCase()} Packs` +
				`</div>` +
				`<div style="color:#e74c3c; font-size:1.1em; margin:5px 0;">` +
				`-${totalCost} Credits | +${totalPointsGained} Points` +
				`</div>` +
				`<div style="color:#f39c12; font-size:0.9em;">` +
				`New Balance: ${balance - totalCost} Credits` +
				`</div>` +
				`</div><hr/>`;
			
			// Show best cards (top 10)
			output += `<h3>⭐ Best Cards (Top 10):</h3>`;
			allCards.slice(0, 10).forEach((card, index) => {
				output += `<div style="margin:5px 0; padding:5px; border-left:3px solid ${getRarityColor(card.rarity)};">` +
					`<span style="background:#f39c12; color:white; padding:1px 4px; border-radius:2px; font-size:0.7em; margin-right:5px;">#${index + 1}</span>` +
					`<span style="font-weight:bold; color:${getRarityColor(card.rarity)};">${card.name}</span> ` +
					`<span style="font-size:0.9em;">[${card.rarity}]</span>`;
				
				if (card.supertype === 'Pokémon' && card.battleValue) {
					output += ` <span style="font-size:0.8em; color:#e74c3c;">(${card.battleValue} BV)</span>`;
				}
				
				output += ` <span style="font-size:0.8em; color:#999;">(${getCardPoints(card)} pts)</span>` +
					`</div>`;
			});
			
			if (allCards.length > 10) {
				output += `<div style="text-align:center; margin:10px 0; color:#666;">` +
					`<em>... and ${allCards.length - 10} more cards</em>` +
					`</div>`;
			}
			
			// Summary stats
			const pokemonCount = allCards.filter(c => c.supertype === 'Pokémon').length;
			const rareCount = allCards.filter(c => c.rarity && c.rarity.includes('Rare')).length;
			
			output += `<div style="margin:20px 0; padding:15px; background:#f8f9fa; border-radius:5px;">` +
				`<h4 style="margin:0 0 10px 0;">📊 Opening Summary</h4>` +
				`<div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; text-align:center;">` +
				`<div>` +
				`<div style="font-weight:bold; color:#2c3e50;">${allCards.length}</div>` +
				`<div style="font-size:0.9em; color:#666;">Total Cards</div>` +
				`</div>` +
				`<div>` +
				`<div style="font-weight:bold; color:#e74c3c;">${pokemonCount}</div>` +
				`<div style="font-size:0.9em; color:#666;">Pokémon</div>` +
				`</div>` +
				`<div>` +
				`<div style="font-weight:bold; color:#f39c12;">${rareCount}</div>` +
				`<div style="font-size:0.9em; color:#666;">Rare+</div>` +
				`</div>` +
				`<div>` +
				`<div style="font-weight:bold; color:#27ae60;">${totalPointsGained}</div>` +
				`<div style="font-size:0.9em; color:#666;">Points</div>` +
				`</div>` +
				`</div>` +
				`</div>`;
			
			output += `</div>`;
			
			// Update milestones
			await TCG_Ranking.updateMilestoneProgress(user.id, 'packsOpened', quantity);
			if (rareCount > 0) {
				await TCG_Ranking.updateMilestoneProgress(user.id, 'rareCardsOpened', rareCount);
			}
			
			this.sendReplyBox(output);
			
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

};
