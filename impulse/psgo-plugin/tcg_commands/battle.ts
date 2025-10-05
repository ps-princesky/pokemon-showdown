/**
 * Battle TCG commands - PvE Campaign System
 */

import * as TCG_Battle from '../../../impulse/psgo-plugin/tcg_battle';
import * as TCG_Economy from '../../../impulse/psgo-plugin/tcg_economy';
import * as TCG_UI from '../../../impulse/psgo-plugin/tcg_ui';
import { TCGCards, UserCollections, BattleProgressCollection } from '../../../impulse/psgo-plugin/tcg_collections';
import { BattleProgress } from '../../../impulse/psgo-plugin/tcg_data';
import { ERROR_MESSAGES } from '../../../impulse/psgo-plugin/tcg_config';
import { generatePack, ensureUserCollection, getValidPackSets } from './shared';

// Store pending battles (in-memory, cleared on server restart)
const pendingBattles = new Map<string, {
	level: number;
	cardsRequired: number;
	timestamp: number;
}>();

export const battleCommands: Chat.ChatCommands = {
	async battle(target, room, user) {
		const [action, ...args] = target.split(',').map(p => p.trim());
		const userId = user.id;

		try {
			// Get or create battle progress
			let progress = await BattleProgressCollection.findOne({ userId });
			if (!progress) {
				progress = {
					userId,
					currentLevel: 1,
					highestLevel: 1,
					totalWins: 0,
					totalLosses: 0,
					lastUpdated: Date.now(),
				};
				await BattleProgressCollection.insertOne(progress);
			}

			// Check lockout
			const lockoutStatus = TCG_Battle.isLockedOut(progress.lastDefeatTime);
			if (lockoutStatus.locked && toID(action) !== '') {
				const timeLeft = TCG_Battle.formatTimeRemaining(lockoutStatus.timeLeft!);
				return this.errorReply(`You are locked out from battles for ${timeLeft} after your last defeat.`);
			}

			// View progress (no action specified)
			if (!action || toID(action) === 'progress' || toID(action) === 'status') {
				if (!this.runBroadcast()) return;
				return this.parse(`/tcg battle view`);
			}

			// View detailed progress
			if (toID(action) === 'view') {
				if (!this.runBroadcast()) return;
				
				const cardsRequired = TCG_Battle.getCardsRequired(progress.currentLevel);
				const creditsReward = TCG_Battle.getCreditsReward(progress.currentLevel);
				const packReward = TCG_Battle.shouldAwardPack(progress.currentLevel);
				
				let content = `<div style="text-align: center; margin-bottom: 15px;">` +
					`<h3 style="color: #e74c3c; margin: 5px 0;">⚔️ Campaign Progress ⚔️</h3>` +
					`<p style="font-size: 1.2em; margin: 5px 0;"><strong>Current Level:</strong> ${progress.currentLevel}</p>` +
					`<p style="margin: 5px 0;"><strong>Highest Level Reached:</strong> ${progress.highestLevel}</p>` +
					`<p style="margin: 5px 0;"><strong>Total Wins:</strong> ${progress.totalWins} | <strong>Total Losses:</strong> ${progress.totalLosses}</p>` +
					`</div><hr/>`;
				
				content += `<div style="margin: 15px 0; padding: 15px; background: linear-gradient(135deg, rgba(231,76,60,0.1), rgba(52,152,219,0.1)); border-radius: 8px; border: 2px solid #e74c3c;">` +
					`<h4 style="margin-top: 0; color: #e74c3c;">🎯 Next Challenge: Level ${progress.currentLevel}</h4>` +
					`<p><strong>Battle Format:</strong> ${cardsRequired}v${cardsRequired}</p>` +
					`<p><strong>Rewards:</strong> ${creditsReward} Credits` + (packReward ? ' + 🎁 Random Pack' : '') + `</p>` +
					`<p style="margin-bottom: 10px;"><strong>Difficulty:</strong> ` + 
					`<span style="color: ${progress.currentLevel <= 10 ? '#2ecc71' : progress.currentLevel <= 30 ? '#f39c12' : progress.currentLevel <= 50 ? '#e67e22' : '#c0392b'};">` +
					`${progress.currentLevel <= 10 ? 'Easy' : progress.currentLevel <= 30 ? 'Medium' : progress.currentLevel <= 50 ? 'Hard' : 'Extreme'}` +
					`</span></p>` +
					`<button name="send" value="/tcg battle challenge ${progress.currentLevel}" class="button" style="padding: 8px 16px; font-size: 1.1em;">⚔️ Start Battle</button>` +
					`</div>`;
				
				if (lockoutStatus.locked) {
					const timeLeft = TCG_Battle.formatTimeRemaining(lockoutStatus.timeLeft!);
					content += `<p style="text-align: center; color: #e74c3c; font-weight: bold; margin-top: 15px;">🔒 Battle Lockout: ${timeLeft} remaining</p>`;
				}

				const output = TCG_UI.buildPage(`${user.name}'s Battle Campaign`, content);
				return this.sendReplyBox(output);
			}

			// Challenge a level
			if (toID(action) === 'challenge' || toID(action) === 'start') {
				const levelStr = args[0];
				if (!levelStr) {
					return this.errorReply('Usage: /tcg battle challenge [level]');
				}

				const level = parseInt(levelStr);
				if (isNaN(level) || level < 1) {
					return this.errorReply('Invalid level number.');
				}

				// Check if user can challenge this level
				if (level !== progress.currentLevel) {
					return this.errorReply(`You can only challenge Level ${progress.currentLevel}. Beat previous levels to unlock higher ones.`);
				}

				const cardsRequired = TCG_Battle.getCardsRequired(level);

				// Check if user has enough cards in collection
				const collection = await UserCollections.findOne({ userId });
				if (!collection || collection.cards.length < cardsRequired) {
					return this.errorReply(`You need at least ${cardsRequired} cards in your collection to challenge this level. You have ${collection?.cards.length || 0} cards.`);
				}

				// Store pending battle
				pendingBattles.set(userId, {
					level,
					cardsRequired,
					timestamp: Date.now(),
				});

				// Show card selection interface
				const userCardIds = collection.cards.map(c => c.cardId);
				const userCards = await TCGCards.find({ cardId: { $in: userCardIds } }).toArray();

				// Sort by battle value
				userCards.sort((a, b) => (b.battleValue || 0) - (a.battleValue || 0));

				let content = `<p style="text-align: center; font-size: 1.1em; margin-bottom: 15px;">` +
					`<strong>Level ${level}:</strong> Select ${cardsRequired} card(s) for battle` +
					`</p>`;

				content += `<p style="text-align: center; margin-bottom: 10px;">` +
					`<em>Click the card IDs below to add them to your team</em>` +
					`</p>`;

				// Show top cards
				const displayCards = userCards.slice(0, 50); // Show top 50 for selection
				content += TCG_UI.generateCardTable(
					displayCards,
					['name', 'rarity', 'type', 'hp', 'battleValue']
				);

				content += `<hr/><p style="text-align: center; margin-top: 15px;">` +
					`<strong>Usage:</strong> <code>/tcg battle fight [cardId1], [cardId2], ...</code><br/>` +
					`<em>Example: /tcg battle fight ${displayCards.slice(0, cardsRequired).map(c => c.cardId).join(', ')}</em>` +
					`</p>`;

				const output = TCG_UI.buildPage(`⚔️ Level ${level} - Select Your Team`, content);
				return this.sendReplyBox(output);
			}

			// Execute battle with selected cards
			if (toID(action) === 'fight' || toID(action) === 'go' || toID(action) === 'execute') {
				const pending = pendingBattles.get(userId);
				if (!pending) {
					return this.errorReply('You need to start a battle challenge first. Use /tcg battle challenge [level]');
				}

				// Check timeout (5 minutes)
				if (Date.now() - pending.timestamp > 5 * 60 * 1000) {
					pendingBattles.delete(userId);
					return this.errorReply('Battle challenge expired. Please start a new challenge.');
				}

				const cardIds = args.map(id => id.trim()).filter(id => id);
				if (cardIds.length !== pending.cardsRequired) {
					return this.errorReply(`You must select exactly ${pending.cardsRequired} card(s) for this battle.`);
				}

				// Verify user owns all selected cards
				const collection = await UserCollections.findOne({ userId });
				if (!collection) {
					return this.errorReply('You do not have any cards in your collection.');
				}

				const ownedCardIds = new Set(collection.cards.map(c => c.cardId));
				for (const cardId of cardIds) {
					if (!ownedCardIds.has(cardId)) {
						return this.errorReply(`You do not own the card with ID: ${cardId}`);
					}
				}

				// Fetch player cards
				const playerCards = await TCGCards.find({ cardId: { $in: cardIds } }).toArray();
				if (playerCards.length !== cardIds.length) {
					return this.errorReply('One or more card IDs are invalid.');
				}

				// Generate opponent team
				const allCards = await TCGCards.find({}).toArray();
				const opponentCards = TCG_Battle.generateOpponentTeam(pending.level, pending.cardsRequired, allCards);

				if (opponentCards.length === 0) {
					return this.errorReply('Failed to generate opponent team. Please try again.');
				}

				// Execute battle
				const result = TCG_Battle.executeBattle(playerCards, opponentCards);

				// Calculate rewards
				const creditsReward = TCG_Battle.getCreditsReward(pending.level);
				const packReward = TCG_Battle.shouldAwardPack(pending.level);

				// Update progress and grant rewards
				if (result.winner === 'player') {
					progress.currentLevel++;
					progress.highestLevel = Math.max(progress.highestLevel, progress.currentLevel);
					progress.totalWins++;
					progress.lastDefeatTime = undefined; // Clear lockout

					await TCG_Economy.grantCurrency(userId, creditsReward);

					if (packReward) {
						const availableSets = await getValidPackSets();
						if (availableSets.length > 0) {
							const randomSetId = availableSets[Math.floor(Math.random() * availableSets.length)];
							let userCollection = await ensureUserCollection(userId);
							const packEntry = userCollection.packs.find(p => p.setId === randomSetId);
							if (packEntry) {
								packEntry.quantity++;
							} else {
								userCollection.packs.push({ setId: randomSetId, quantity: 1 });
							}
							await UserCollections.updateOne(
								{ userId },
								{ $set: userCollection },
								{ upsert: true }
							);
						}
					}
				} else {
					progress.totalLosses++;
					progress.lastDefeatTime = Date.now(); // Set 24h lockout
				}

				progress.lastUpdated = Date.now();
				await BattleProgressCollection.updateOne(
					{ userId },
					{ $set: progress },
					{ upsert: true }
				);

				// Clear pending battle
				pendingBattles.delete(userId);

				// Display battle results
				if (!this.runBroadcast()) return;
				
				let content = `<div style="text-align: center; margin-bottom: 15px;">` +
					`<h3 style="color: ${result.winner === 'player' ? '#2ecc71' : '#e74c3c'}; margin: 5px 0;">` +
					`${result.winner === 'player' ? '🎉 VICTORY! 🎉' : '💔 DEFEAT 💔'}` +
					`</h3>` +
					`<p style="font-size: 1.2em;"><strong>Level ${pending.level}</strong> - ${pending.cardsRequired}v${pending.cardsRequired} Battle</p>` +
					`</div>`;

				content += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">` +
					`<div style="text-align: center; padding: 15px; background: rgba(52,152,219,0.1); border-radius: 8px; border: 2px solid #3498db;">` +
					`<h4 style="margin-top: 0; color: #3498db;">👤 ${user.name}</h4>` +
					`<p style="font-size: 1.5em; font-weight: bold; color: #3498db;">${result.playerScore}</p>` +
					`</div>` +
					`<div style="text-align: center; padding: 15px; background: rgba(231,76,60,0.1); border-radius: 8px; border: 2px solid #e74c3c;">` +
					`<h4 style="margin-top: 0; color: #e74c3c;">🤖 Opponent</h4>` +
					`<p style="font-size: 1.5em; font-weight: bold; color: #e74c3c;">${result.opponentScore}</p>` +
					`</div>` +
					`</div>`;

				// Show card breakdown
				content += `<h4>Your Team Performance:</h4>` +
					`<table class="themed-table"><tr class="themed-table-header"><th>Card</th><th>Score</th></tr>`;
				
				result.breakdown.playerCards.forEach(item => {
					content += `<tr class="themed-table-row">` +
						`<td><strong>${item.card.name}</strong></td>` +
						`<td style="color: #3498db; font-weight: bold;">${item.score}</td>` +
						`</tr>`;
				});
				content += `</table>`;

				content += `<h4 style="margin-top: 15px;">Opponent Team:</h4>` +
					`<table class="themed-table"><tr class="themed-table-header"><th>Card</th><th>Score</th></tr>`;
				
				result.breakdown.opponentCards.forEach(item => {
					content += `<tr class="themed-table-row">` +
						`<td><strong>${item.card.name}</strong></td>` +
						`<td style="color: #e74c3c; font-weight: bold;">${item.score}</td>` +
						`</tr>`;
				});
				content += `</table>`;

				// Show rewards or lockout
				if (result.winner === 'player') {
					content += `<div style="margin-top: 20px; padding: 15px; background: linear-gradient(135deg, rgba(46,204,113,0.2), rgba(52,152,219,0.2)); border-radius: 8px; border: 2px solid #2ecc71; text-align: center;">` +
						`<h4 style="margin-top: 0; color: #2ecc71;">🎁 Rewards Earned!</h4>` +
						`<p style="font-size: 1.2em;"><strong>+${creditsReward} Credits</strong></p>`;
					
					if (packReward) {
						content += `<p style="font-size: 1.1em; color: #e74c3c;"><strong>🎁 Bonus: Random Booster Pack!</strong></p>`;
					}
					
					content += `<p style="margin-top: 15px;">` +
						`<button name="send" value="/tcg battle challenge ${progress.currentLevel}" class="button">⚔️ Challenge Level ${progress.currentLevel}</button>` +
						`</p>` +
						`</div>`;
				} else {
					content += `<div style="margin-top: 20px; padding: 15px; background: rgba(231,76,60,0.1); border-radius: 8px; border: 2px solid #e74c3c; text-align: center;">` +
						`<h4 style="margin-top: 0; color: #e74c3c;">🔒 Battle Lockout</h4>` +
						`<p>You cannot challenge battles for the next <strong>24 hours</strong> after a defeat.</p>` +
						`<p><em>Use this time to improve your collection!</em></p>` +
						`</div>`;
				}

				const output = TCG_UI.buildPage(`Battle Results - Level ${pending.level}`, content);
				this.sendReplyBox(output);
			}

		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async leaderboard(target, room, user) {
		if (!this.runBroadcast()) return;
		
		try {
			const topPlayers = await BattleProgressCollection.find({})
				.sort({ highestLevel: -1, totalWins: -1 })
				.limit(25)
				.toArray();

			if (topPlayers.length === 0) {
				return this.sendReplyBox('No battle records found yet. Be the first to challenge the campaign!');
			}

			let content = `<p style="text-align: center; margin-bottom: 15px;">` +
				`<strong>Top 25 Campaign Warriors</strong>` +
				`</p>`;

			const rows = topPlayers.map((player, idx) => {
				const rank = idx + 1;
				let medal = '';
				if (rank === 1) medal = '🥇';
				else if (rank === 2) medal = '🥈';
				else if (rank === 3) medal = '🥉';

				return [
					`${medal} ${rank}`,
					Impulse.nameColor(player.userId, true),
					`${player.highestLevel}`,
					`${player.totalWins}`,
					`${player.totalLosses}`,
					player.totalWins + player.totalLosses > 0 
						? `${Math.round((player.totalWins / (player.totalWins + player.totalLosses)) * 100)}%`
						: '0%'
				];
			});

			content += TCG_UI.buildTable({
				headers: ['Rank', 'Player', 'Highest Level', 'Wins', 'Losses', 'Win Rate'],
				rows,
				scrollable: true
			});

			const output = TCG_UI.buildPage('⚔️ Battle Campaign Leaderboard', content);
			this.sendReplyBox(output);
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},
};
