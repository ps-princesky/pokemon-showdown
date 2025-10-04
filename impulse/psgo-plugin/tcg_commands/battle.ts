/**
 * Battle-related TCG commands
 */

import * as TCG_Economy from '../../../impulse/psgo-plugin/tcg_economy';
import * as TCG_UI from '../../../impulse/psgo-plugin/tcg_ui';
import * as TCG_Ranking from '../../../impulse/psgo-plugin/tcg_ranking';
import { TCGCards } from '../../../impulse/psgo-plugin/tcg_collections';
import { getRarityColor } from '../../../impulse/psgo-plugin/tcg_data';
import { BATTLE_CONFIG, VALIDATION_LIMITS, ERROR_MESSAGES } from '../../../impulse/psgo-plugin/tcg_config';
import { generatePack, getCardPoints } from './shared';
import * as TCG_Battle from '../../../impulse/tcg_battle_simple';
import { getCardPoints } from './shared';

// Battle challenges map
const battleChallenges: Map<string, { 
	from: string; 
	wager: number; 
	setId: string; 
	ranked?: boolean; 
}> = new Map();

export const battleCommands: Chat.ChatCommands = {
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
				if (isNaN(wager) || wager < VALIDATION_LIMITS.MIN_CURRENCY_AMOUNT || wager > BATTLE_CONFIG.MAX_WAGER) {
					return this.errorReply(`The wager must be between ${VALIDATION_LIMITS.MIN_CURRENCY_AMOUNT} and ${BATTLE_CONFIG.MAX_WAGER}.`);
				}

				const challengerId = user.id;
				const targetId = toID(targetUsername);

				if (challengerId === targetId) return this.errorReply(ERROR_MESSAGES.SELF_ACTION_ERROR);
				if (battleChallenges.has(targetId) || battleChallenges.has(challengerId)) {
					return this.errorReply("One of you already has a pending battle challenge.");
				}

				try {
					const challengerBalance = await TCG_Economy.getUserBalance(challengerId);
					if (challengerBalance < wager) {
						return this.errorReply(ERROR_MESSAGES.INSUFFICIENT_CREDITS);
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
					}, BATTLE_CONFIG.TIMEOUT_MINUTES * 60 * 1000);

					this.sendReply(`You have challenged ${targetUsername} to a ${wager} Credit pack battle! They have ${BATTLE_CONFIG.TIMEOUT_MINUTES} minutes to accept.`);
					const targetUserObj = Users.get(targetId);
					if (targetUserObj) {
						targetUserObj.sendTo(room, `|html|<div class="infobox"><strong>${user.name} has challenged you to a ${wager} Credit Pack Battle!</strong><br/>Type <code>/tcg battle accept, ${user.name}</code> to accept.</div>`);
					}
				} catch (e: any) {
					return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
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
						return this.errorReply(ERROR_MESSAGES.INSUFFICIENT_CREDITS);
					}

					const canChallengerPay = await TCG_Economy.deductCurrency(challengerId, wager);
					if (!canChallengerPay) {
						await TCG_Economy.grantCurrency(acceptorId, wager); // Refund acceptor
						return this.errorReply(`${challengerName} no longer has enough credits for this wager. The battle is cancelled.`);
					}

					const [pack1, pack2] = await Promise.all([generatePack(setId), generatePack(setId)]);
					if (!pack1 || !pack2) throw new Error(ERROR_MESSAGES.PACK_GENERATION_FAILED);

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

					let output = `<div class="infobox">` +
						`<h2 style="text-align:center;">Pack Battle!</h2>` +
						`<table style="width:100%;"><tr>` +
						`<td style="width:50%; vertical-align:top; padding-right:5px;">` +
						`<strong>${Impulse.nameColor(challengerName, true)}'s Pack (Total: ${points1} Points)</strong>` +
						`<table class="themed-table"> ${buildPackHtml(pack1)} </table>` +
						`</td><td style="width:50%; vertical-align:top; padding-left:5px;">` +
						`<strong>${Impulse.nameColor(user.name, true)}'s Pack (Total: ${points2} Points)</strong>` +
						`<table class="themed-table"> ${buildPackHtml(pack2)} </table>` +
						`</td></tr></table><hr/>`;

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
				return this.errorReply(ERROR_MESSAGES.SELF_ACTION_ERROR);
			}

			try {
				// Execute the challenge
				const result = await TCG_Ranking.executeSimulatedChallenge(challengerId, targetId);
				
				if (!result.success) {
					return this.errorReply(result.error || "Challenge failed.");
				}

				const battle = result.battle!;
				const challengerRanking = result.challengerRanking!;
				const targetRanking = result.targetRanking!;
				const challengerPack = result.challengerPack || [];
				const targetPack = result.targetPack || [];

				// Get the best Pokemon from each pack for detailed battle
				const challengerPokemon = challengerPack.filter(c => c.supertype === 'Pokémon' && c.battleValue);
				const targetPokemon = targetPack.filter(c => c.supertype === 'Pokémon' && c.battleValue);

				const challengerBestCard = challengerPokemon.reduce((best, card) => 
					(card.battleValue || 0) > (best.battleValue || 0) ? card : best
				);
				const targetBestCard = targetPokemon.reduce((best, card) => 
					(card.battleValue || 0) > (best.battleValue || 0) ? card : best
				);

				// Simulate detailed battle between best cards
				const detailedBattle = await TCG_Battle.simulateBattle(
					challengerBestCard.cardId, 
					targetBestCard.cardId
				);

				// Determine winner and colors
				let resultText = '';
				let resultColor = '#f1c40f';
				let winnerName = '';
				
				if (battle.winner === challengerId) {
					resultText = 'Victory!';
					resultColor = '#2ecc71';
					winnerName = user.name;
				} else if (battle.winner === targetId) {
					resultText = 'Defeat!';
					resultColor = '#e74c3c';
					winnerName = targetUsername;
				} else {
					resultText = 'Draw!';
					resultColor = '#f39c12';
				}

				const challengerEloChange = TCG_Ranking.formatEloChange(battle.challengerEloChange);
				const targetEloChange = TCG_Ranking.formatEloChange(battle.targetEloChange);
				const challengerColor = TCG_Ranking.getRankColor(challengerRanking.rank);
				const targetColor = TCG_Ranking.getRankColor(targetRanking.rank);

				// Build comprehensive output
				let output = `<div class="infobox">` +
					`<h2 style="text-align:center;">⚔️ Ranked Challenge Battle</h2>` +
					`<div style="text-align:center; margin: 10px 0;">` +
					`<strong>${Impulse.nameColor(user.name, true)}</strong> challenged <strong>${Impulse.nameColor(targetUsername, true)}</strong>` +
					`</div>`;

				// Player info cards
				output += `<table style="width:100%; margin: 15px 0;"><tr>` +
					`<td style="width:50%; text-align:center; padding:10px; border-right: 1px solid #ddd;">` +
					`<div style="font-size:1.2em; font-weight:bold;">${user.name}</div>` +
					`<div style="color: ${challengerColor}; margin:5px 0;">${challengerRanking.rank}</div>` +
					`<div style="font-size:1.1em;">${challengerRanking.elo} ELO <span style="color: ${battle.challengerEloChange >= 0 ? '#2ecc71' : '#e74c3c'};">(${challengerEloChange})</span></div>` +
					`<hr style="margin:10px 0;"/>` +
					`<div style="font-weight:bold; margin-top:10px;">${challengerBestCard.name}</div>` +
					`<div style="color: ${getRarityColor(challengerBestCard.rarity)}; font-size:0.9em;">${challengerBestCard.rarity}</div>` +
					`<div style="margin-top:5px; font-size:0.9em;">` +
					`Pack Value: <strong>${battle.challengerPackValue}</strong> pts<br/>` +
					`Battle HP: ${detailedBattle.player1FinalHP}/${challengerBestCard.hp || 0}<br/>` +
					`<span style="color: #f39c12;">+${result.challengerCredits || 0} Credits</span>` +
					`</div>` +
					`</td>` +
					`<td style="width:50%; text-align:center; padding:10px;">` +
					`<div style="font-size:1.2em; font-weight:bold;">${targetUsername}</div>` +
					`<div style="color: ${targetColor}; margin:5px 0;">${targetRanking.rank}</div>` +
					`<div style="font-size:1.1em;">${targetRanking.elo} ELO <span style="color: ${battle.targetEloChange >= 0 ? '#2ecc71' : '#e74c3c'};">(${targetEloChange})</span></div>` +
					`<hr style="margin:10px 0;"/>` +
					`<div style="font-weight:bold; margin-top:10px;">${targetBestCard.name}</div>` +
					`<div style="color: ${getRarityColor(targetBestCard.rarity)}; font-size:0.9em;">${targetBestCard.rarity}</div>` +
					`<div style="margin-top:5px; font-size:0.9em;">` +
					`Pack Value: <strong>${battle.targetPackValue}</strong> pts<br/>` +
					`Battle HP: ${detailedBattle.player2FinalHP}/${targetBestCard.hp || 0}<br/>` +
					`<span style="color: #f39c12;">+${result.targetCredits || 0} Credits</span>` +
					`</div>` +
					`</td></tr></table>`;

				// Show ELO milestone notifications
				if (result.player1EloMilestones && result.player1EloMilestones.length > 0) {
					output += `<div style="text-align:center; color: #f39c12; margin: 10px 0; padding: 8px; background: rgba(243,156,18,0.1); border-radius: 5px;">` +
						`🎉 ${user.name} achieved: ${result.player1EloMilestones.map(m => `${m.name} (+${m.reward} Credits)`).join(', ')}` +
						`</div>`;
				}

				if (result.player2EloMilestones && result.player2EloMilestones.length > 0) {
					output += `<div style="text-align:center; color: #f39c12; margin: 10px 0; padding: 8px; background: rgba(243,156,18,0.1); border-radius: 5px;">` +
						`🎉 ${targetUsername} achieved: ${result.player2EloMilestones.map(m => `${m.name} (+${m.reward} Credits)`).join(', ')}` +
						`</div>`;
				}

				// Battle result
				output += `<div style="text-align:center; color: ${resultColor}; font-size: 1.5em; font-weight: bold; margin: 15px 0; padding: 15px; border: 3px solid ${resultColor}; border-radius: 8px; background: ${resultColor}15;">` +
					`${resultText}${winnerName ? ` - ${winnerName} Wins!` : ''}` +
					`</div>`;

				// Battle statistics from detailed simulation
				output += `<h3 style="text-align:center;">⚔️ Battle Details</h3>` +
					`<div style="text-align:center; margin:10px 0; font-size:0.9em; color:#666;">` +
					`${detailedBattle.totalTurns} turns | ${challengerBestCard.name} vs ${targetBestCard.name}` +
					`</div>` +
					`<table style="width:100%; margin:10px 0;">` +
					`<tr><th>Statistic</th><th>${user.name}</th><th>${targetUsername}</th></tr>` +
					`<tr><td>Damage Dealt</td><td style="text-align:center;">${detailedBattle.player1Stats.totalDamageDealt}</td><td style="text-align:center;">${detailedBattle.player2Stats.totalDamageDealt}</td></tr>` +
					`<tr><td>Attacks Used</td><td style="text-align:center;">${detailedBattle.player1Stats.attacksUsed}</td><td style="text-align:center;">${detailedBattle.player2Stats.attacksUsed}</td></tr>` +
					`<tr><td>Energy Used</td><td style="text-align:center;">${detailedBattle.player1Stats.energyUsed}</td><td style="text-align:center;">${detailedBattle.player2Stats.energyUsed}</td></tr>` +
					`</table>`;

				// Battle log highlights (last 5 major actions)
				const majorActions = detailedBattle.battleLog.filter(log => 
					log.damage > 0 || log.attackName === 'Knockout' || log.statusEffect
				).slice(-5);

				if (majorActions.length > 0) {
					output += `<details style="margin-top:15px;">` +
						`<summary style="cursor:pointer; font-weight:bold; padding:8px; background:#f5f5f5; border-radius:5px;">` +
						`📜 Battle Highlights (${majorActions.length} key moments)` +
						`</summary>` +
						`<div style="margin-top:10px; padding:10px; background:#f9f9f9; border-radius:5px; max-height:200px; overflow-y:auto;">`;

					majorActions.forEach(log => {
						let logColor = '#666';
						let logIcon = '⚔️';
						
						if (log.attackName === 'Knockout') {
							logColor = '#e74c3c';
							logIcon = '💀';
						} else if (log.effectiveness === 'super effective') {
							logColor = '#2ecc71';
							logIcon = '💥';
						} else if (log.effectiveness === 'not very effective') {
							logColor = '#95a5a6';
							logIcon = '🛡️';
						} else if (log.statusEffect) {
							logColor = '#9b59b6';
							logIcon = '✨';
						}
						
						output += `<div style="margin:5px 0; padding:8px; border-left:4px solid ${logColor}; background:white; border-radius:3px;">` +
							`<span style="font-size:1.2em; margin-right:5px;">${logIcon}</span>` +
							`<strong>Turn ${log.turn}:</strong> ${log.description}` +
							`</div>`;
					});

					output += `</div></details>`;
				}

				// Pack contents (expandable)
				output += `<details style="margin-top:15px;">` +
					`<summary style="cursor:pointer; font-weight:bold; padding:8px; background:#f5f5f5; border-radius:5px;">` +
					`📦 View Pack Contents` +
					`</summary>` +
					`<div style="margin-top:10px;">` +
					`<table style="width:100%;"><tr style="vertical-align:top;">` +
					`<td style="width:50%; padding-right:10px;">` +
					`<strong>${user.name}'s Pack</strong>` +
					`<div style="max-height:200px; overflow-y:auto; margin-top:5px;">`;

				challengerPack.forEach(card => {
					const isBest = card.cardId === challengerBestCard.cardId;
					output += `<div style="padding:3px; ${isBest ? 'background:#2ecc7120; font-weight:bold;' : ''}">` +
						`${isBest ? '⭐ ' : ''}${card.name} (${getCardPoints(card)} pts)` +
						`</div>`;
				});

				output += `</div></td>` +
					`<td style="width:50%; padding-left:10px;">` +
					`<strong>${targetUsername}'s Pack</strong>` +
					`<div style="max-height:200px; overflow-y:auto; margin-top:5px;">`;

				targetPack.forEach(card => {
					const isBest = card.cardId === targetBestCard.cardId;
					output += `<div style="padding:3px; ${isBest ? 'background:#e74c3c20; font-weight:bold;' : ''}">` +
						`${isBest ? '⭐ ' : ''}${card.name} (${getCardPoints(card)} pts)` +
						`</div>`;
				});

				output += `</div></td></tr></table></div></details>`;

				// Challenge status
				const challengeStatus = await TCG_Ranking.getDailyChallengeStatus(challengerId);
				output += `<div style="text-align:center; margin-top: 15px; padding-top:15px; border-top:2px solid #ddd; font-size:0.9em; color:#666;">` +
					`Challenges remaining today: <strong>${challengeStatus.challengesRemaining}/10</strong>` +
					`</div>` +
					`</div>`;

				this.sendReplyBox(output);

			} catch (e: any) {
				return this.errorReply(`Error executing challenge: ${e.message}`);
			}
			break;
		}
		
		case 'preview': {
			if (!this.runBroadcast()) return;
			const [targetUsername] = args;
			if (!targetUsername) {
				return this.errorReply("Usage: /tcg rankedbattle preview, [user]");
			}

			const targetId = toID(targetUsername);

			try {
				// Get rankings
				const [challengerRanking, targetRanking] = await Promise.all([
					TCG_Ranking.getPlayerRanking(user.id),
					TCG_Ranking.getPlayerRanking(targetId)
				]);

				// Calculate ELO changes
				const challengerWinElo = Math.round(32 * (1 - (1 / (1 + Math.pow(10, (targetRanking.elo - challengerRanking.elo) / 400))))); 
				const challengerLoseElo = Math.round(32 * (0 - (1 / (1 + Math.pow(10, (targetRanking.elo - challengerRanking.elo) / 400)))));

				let output = `<div class="infobox">` +
					`<h2 style="text-align:center;">🔮 Ranked Battle Preview</h2>` +
					`<table style="width:100%; margin:15px 0;"><tr>` +
					`<td style="width:45%; text-align:center;">` +
					`<div style="font-size:1.2em; font-weight:bold;">${Impulse.nameColor(user.name, true)}</div>` +
					`<div style="color: ${TCG_Ranking.getRankColor(challengerRanking.rank)}; font-size:1.1em; margin:5px 0;">${challengerRanking.rank}</div>` +
					`<div style="font-size:1.3em; font-weight:bold;">${challengerRanking.elo} ELO</div>` +
					`<div style="font-size:0.9em; margin-top:5px;">` +
					`${challengerRanking.wins}W-${challengerRanking.losses}L-${challengerRanking.draws}D` +
					`</div>` +
					`</td>` +
					`<td style="width:10%; text-align:center; font-size:2em;">⚔️</td>` +
					`<td style="width:45%; text-align:center;">` +
					`<div style="font-size:1.2em; font-weight:bold;">${Impulse.nameColor(targetUsername, true)}</div>` +
					`<div style="color: ${TCG_Ranking.getRankColor(targetRanking.rank)}; font-size:1.1em; margin:5px 0;">${targetRanking.rank}</div>` +
					`<div style="font-size:1.3em; font-weight:bold;">${targetRanking.elo} ELO</div>` +
					`<div style="font-size:0.9em; margin-top:5px;">` +
					`${targetRanking.wins}W-${targetRanking.losses}L-${targetRanking.draws}D` +
					`</div>` +
					`</td></tr></table><hr/>`;

				// ELO stakes
				output += `<h3 style="text-align:center;">ELO Stakes</h3>` +
					`<table style="width:100%; margin:15px 0;">` +
					`<tr><th>Outcome</th><th>Your ELO Change</th><th>New ELO</th><th>New Rank</th></tr>` +
					`<tr>` +
					`<td>Victory</td>` +
					`<td style="text-align:center; color:#2ecc71; font-weight:bold;">+${challengerWinElo}</td>` +
					`<td style="text-align:center;">${challengerRanking.elo + challengerWinElo}</td>` +
					`<td style="text-align:center;">${TCG_Ranking.getRankFromElo(challengerRanking.elo + challengerWinElo)}</td>` +
					`</tr>` +
					`<tr>` +
					`<td>Defeat</td>` +
					`<td style="text-align:center; color:#e74c3c; font-weight:bold;">${challengerLoseElo}</td>` +
					`<td style="text-align:center;">${challengerRanking.elo + challengerLoseElo}</td>` +
					`<td style="text-align:center;">${TCG_Ranking.getRankFromElo(challengerRanking.elo + challengerLoseElo)}</td>` +
					`</tr>` +
					`</table>`;

				// Challenge status
				const challengeStatus = await TCG_Ranking.getDailyChallengeStatus(user.id);
				const canChallenge = challengeStatus.challengesRemaining > 0;

				if (canChallenge) {
					output += `<div style="text-align:center; margin-top:20px;">` +
						`<button name="send" value="/tcg rankedbattle challenge, ${targetUsername}" style="` +
						`background:#e74c3c; color:white; border:none; padding:10px 20px; border-radius:5px; cursor:pointer; font-weight:bold;">` +
						`⚔️ Challenge ${targetUsername}` +
						`</button>` +
						`</div>` +
						`<p style="text-align:center; margin-top:10px; font-size:0.9em;">` +
						`Challenges remaining today: ${challengeStatus.challengesRemaining}/10` +
						`</p>`;
				} else {
					output += `<p style="text-align:center; color:#e74c3c; margin-top:20px;">` +
						`You've used all your challenges today. Reset at midnight UTC.` +
						`</p>`;
				}

				output += `</div>`;
				this.sendReplyBox(output);

			} catch (e: any) {
				return this.errorReply(`Error: ${e.message}`);
			}
			break;
		}

			case 'targets': {
				if (!this.runBroadcast()) return;
				
				try {
					const availableTargets = await TCG_Ranking.getAvailableChallengeTargets(user.id);
					const challengeStatus = await TCG_Ranking.getDailyChallengeStatus(user.id);

					let output = `<div class="infobox">` +
						`<h3>Available Challenge Targets</h3>` +
						`<p>Challenges remaining: <strong>${challengeStatus.challengesRemaining}/10</strong></p>`;

					if (availableTargets.length === 0) {
						output += `<p>No available targets. You may have challenged all eligible players today.</p>`;
					} else {
						output += `<div style="max-height: 360px; overflow-y: auto;">` +
							`<table class="themed-table">` +
							`<tr class="themed-table-header">` +
							`<th>Rank</th><th>Player</th><th>Rating</th><th>W-L-D</th><th>Action</th>` +
							`</tr>`;

						availableTargets.slice(0, 20).forEach((target, index) => {
							const rankColor = TCG_Ranking.getRankColor(target.rank);
							const winRate = TCG_Ranking.getWinRate(target.wins, target.losses, target.draws);

							output += `<tr class="themed-table-row">` +
								`<td>${index + 1}</td>` +
								`<td>${Impulse.nameColor(target.userId, true)}</td>` +
								`<td><span style="color: ${rankColor};">${target.elo} (${target.rank})</span></td>` +
								`<td>${target.wins}-${target.losses}-${target.draws} (${winRate}%)</td>` +
								`<td><button name="send" value="/tcg rankedbattle challenge, ${target.userId}">Challenge</button></td>` +
								`</tr>`;
						});

						output += `</table>` +
							`</div>`;
						
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
					const dailyChallenge = await TCG_Ranking.getDailyChallenges(user.id);

					let output = `<div class="infobox">` +
						`<h3>Daily Challenge Status</h3>` +
						`<p><strong>Challenges Remaining:</strong> ${challengeStatus.challengesRemaining}/10</p>` +
						`<p><strong>Challenges Used:</strong> ${challengeStatus.challengesUsed}/10</p>` +
						`<p><strong>Credits Earned Today:</strong> ${dailyChallenge.totalCreditsEarnedToday || 0}</p>` +
						`<p><strong>Next Reset:</strong> ${nextReset.toLocaleString()}</p>`;

					// Show reward breakdown
					const battlesUsed = challengeStatus.challengesUsed;
					const DAILY_CREDIT_BATTLES_LIMIT = 7;
					const RANKED_BATTLE_REWARDS = { win: 8, loss: 3, draw: 5 };
					const REDUCED_REWARD_MULTIPLIER = 0.3;
					
					if (battlesUsed > 0) {
						output += `<h4>Reward Structure:</h4>` +
							`<p>Next ${Math.max(0, DAILY_CREDIT_BATTLES_LIMIT - battlesUsed)} battles: Full rewards (${RANKED_BATTLE_REWARDS.win} win/${RANKED_BATTLE_REWARDS.loss} loss/${RANKED_BATTLE_REWARDS.draw} draw)</p>`;
						if (challengeStatus.challengesRemaining > 0 && battlesUsed >= DAILY_CREDIT_BATTLES_LIMIT) {
							const reducedWin = Math.floor(RANKED_BATTLE_REWARDS.win * REDUCED_REWARD_MULTIPLIER);
							const reducedLoss = Math.floor(RANKED_BATTLE_REWARDS.loss * REDUCED_REWARD_MULTIPLIER);
							const reducedDraw = Math.floor(RANKED_BATTLE_REWARDS.draw * REDUCED_REWARD_MULTIPLIER);
							output += `<p>Remaining battles: Reduced rewards (${reducedWin} win/${reducedLoss} loss/${reducedDraw} draw)</p>`;
						}
					}

					if (challengeStatus.recentChallenges.length > 0) {
						output += `<h4>Recent Challenges Today:</h4>` +
							`<ul>`;
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
			this.errorReply("Usage: /tcg rankedbattle [challenge/preview/targets/status], [user]");
	}
},
};
