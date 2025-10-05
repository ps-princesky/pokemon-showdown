/**
 * Battle-related TCG commands
 */

import * as TCG_Economy from '../../../impulse/psgo-plugin/tcg_economy';
import * as TCG_UI from '../../../impulse/psgo-plugin/tcg_ui';
import { TCGCards } from '../../../impulse/psgo-plugin/tcg_collections';
import { BATTLE_CONFIG, VALIDATION_LIMITS, ERROR_MESSAGES } from '../../../impulse/psgo-plugin/tcg_config';
import { generatePack, getCardPoints } from './shared';

// Battle challenges map
const battleChallenges: Map<string, { 
	from: string; 
	wager: number; 
	setId: string; 
}> = new Map();

export const battleCommands: Chat.ChatCommands = {
	async battle(target, room, user) {
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
};
