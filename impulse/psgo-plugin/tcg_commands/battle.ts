/**
 * Battle-related TCG commands
 */

import * as TCG_Economy from '../../../impulse/psgo-plugin/tcg_economy';
import * as TCG_UI from '../../../impulse/psgo-plugin/tcg_ui';
import * as TCG_Ranking from '../../../impulse/psgo-plugin/tcg_ranking';
import { TCGCards } from '../../../impulse/psgo-plugin/tcg_collections';
import { BATTLE_CONFIG, VALIDATION_LIMITS, ERROR_MESSAGES } from '../../../impulse/psgo-plugin/tcg_config';
import { generatePack, getCardPoints } from './shared';

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
						targetUserObj.sendTo(room, `|html|${TCG_UI.buildInfoBox('Pack Battle Challenge', `<strong>${user.name} has challenged you to a ${wager} Credit Pack Battle!</strong><br/>Type <code>/tcg battle accept, ${user.name}</code> to accept.`)}`);
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

					let winnerName = '';
					let winnerCredits = 0;
					if (points1 > points2) {
						winnerName = challengerName;
						winnerCredits = wager * 2;
						await TCG_Economy.grantCurrency(challengerId, wager * 2);
					} else if (points2 > points1) {
						winnerName = user.name;
						winnerCredits = wager * 2;
						await TCG_Economy.grantCurrency(acceptorId, wager * 2);
					} else {
						await Promise.all([
							TCG_Economy.grantCurrency(challengerId, wager),
							TCG_Economy.grantCurrency(acceptorId, wager),
						]);
					}
					
					const output = TCG_UI.buildPackBattleResult({
						challenger: { name: challengerName, pack: pack1, points: points1 },
						acceptor: { name: user.name, pack: pack2, points: points2 },
						winner: winnerName ? { name: winnerName, credits: winnerCredits } : null,
						getCardPoints,
						nameColor: Impulse.nameColor
					});
					
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
					const result = await TCG_Ranking.executeSimulatedChallenge(challengerId, targetId);
					
					if (!result.success) {
						return this.errorReply(result.error || "Challenge failed.");
					}

					const challengeStatus = await TCG_Ranking.getDailyChallengeStatus(challengerId);

					const output = TCG_UI.buildRankedBattleResult({
						challengerName: user.name,
						targetName: targetUsername,
						battle: result.battle!,
						challengerRanking: result.challengerRanking!,
						targetRanking: result.targetRanking!,
						challengerPack: result.challengerPack || [],
						targetPack: result.targetPack || [],
						challengerCredits: result.challengerCredits || 0,
						targetCredits: result.targetCredits || 0,
						challengerId,
						player1EloMilestones: result.player1EloMilestones,
						player2EloMilestones: result.player2EloMilestones,
						challengesRemaining: challengeStatus.challengesRemaining,
						getCardPoints,
						nameColor: Impulse.nameColor
					});

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

					const output = TCG_UI.buildChallengeTargets({
						targets: availableTargets,
						challengesRemaining: challengeStatus.challengesRemaining,
						nameColor: Impulse.nameColor
					});

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

					let content = `<p><strong>Challenges Remaining:</strong> ${challengeStatus.challengesRemaining}/10</p>` +
						`<p><strong>Challenges Used:</strong> ${challengeStatus.challengesUsed}/10</p>` +
						`<p><strong>Credits Earned Today:</strong> ${dailyChallenge.totalCreditsEarnedToday || 0}</p>` +
						`<p><strong>Next Reset:</strong> ${nextReset.toLocaleString()}</p>`;

					const battlesUsed = challengeStatus.challengesUsed;
					const DAILY_CREDIT_BATTLES_LIMIT = 7;
					const RANKED_BATTLE_REWARDS = { win: 8, loss: 3, draw: 5 };
					const REDUCED_REWARD_MULTIPLIER = 0.3;
					
					if (battlesUsed > 0) {
						content += `<h4>Reward Structure:</h4>` +
							`<p>Next ${Math.max(0, DAILY_CREDIT_BATTLES_LIMIT - battlesUsed)} battles: Full rewards (${RANKED_BATTLE_REWARDS.win} win/${RANKED_BATTLE_REWARDS.loss} loss/${RANKED_BATTLE_REWARDS.draw} draw)</p>`;
						if (challengeStatus.challengesRemaining > 0 && battlesUsed >= DAILY_CREDIT_BATTLES_LIMIT) {
							const reducedWin = Math.floor(RANKED_BATTLE_REWARDS.win * REDUCED_REWARD_MULTIPLIER);
							const reducedLoss = Math.floor(RANKED_BATTLE_REWARDS.loss * REDUCED_REWARD_MULTIPLIER);
							const reducedDraw = Math.floor(RANKED_BATTLE_REWARDS.draw * REDUCED_REWARD_MULTIPLIER);
							content += `<p>Remaining battles: Reduced rewards (${reducedWin} win/${reducedLoss} loss/${reducedDraw} draw)</p>`;
						}
					}

					if (challengeStatus.recentChallenges.length > 0) {
						content += `<h4>Recent Challenges Today:</h4>` +
							`<ul>`;
						challengeStatus.recentChallenges.forEach(challenge => {
							const time = new Date(challenge.timestamp).toLocaleTimeString();
							content += `<li>${Impulse.nameColor(challenge.targetUserId, true)} at ${time}</li>`;
						});
						content += `</ul>`;
					}

					const output = TCG_UI.buildInfoBox('Daily Challenge Status', content);
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
};
