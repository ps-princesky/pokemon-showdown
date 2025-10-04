/**
 * Ranking and milestone TCG commands
 */

import * as TCG_Ranking from '../../../impulse/psgo-plugin/tcg_ranking';
import * as TCG_Economy from '../../../impulse/psgo-plugin/tcg_economy';
import * as TCG_UI from '../../../impulse/psgo-plugin/tcg_ui';
import { ERROR_MESSAGES } from '../../../impulse/psgo-plugin/tcg_config';

export const rankingCommands: Chat.ChatCommands = {
	async ranking(target, room, user) {
		if (!this.runBroadcast()) return;
		const targetUser = target.trim() || user.name;
		const targetId = toID(targetUser);
		
		try {
			const [ranking, position] = await Promise.all([
				TCG_Ranking.getPlayerRanking(targetId),
				TCG_Ranking.getPlayerRankPosition(targetId)
			]);
			
			const output = TCG_UI.buildRankingDisplay({
				username: targetUser,
				ranking,
				position,
				nameColor: Impulse.nameColor
			});
			
			this.sendReplyBox(output);
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async leaderboard(target, room, user) {
		await TCG_Ranking.getPlayerRanking(user.id);
		if (!this.runBroadcast()) return;
		const type = toID(target) || 'elo';
		
		try {
			let leaderboard;
			
			if (type === 'seasonal') {
				leaderboard = await TCG_Ranking.getSeasonalLeaderboard(10);
			} else {
				leaderboard = await TCG_Ranking.getLeaderboard(10);
			}
			
			const output = TCG_UI.buildLeaderboard({
				leaderboard,
				type: type === 'seasonal' ? 'seasonal' : 'elo',
				nameColor: Impulse.nameColor
			});
			
			this.sendReplyBox(output);
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async battlehistory(target, room, user) {
		if (!this.runBroadcast()) return;
		const targetUser = target.trim() || user.name;
		const targetId = toID(targetUser);
		
		try {
			const simulatedBattles = await TCG_Ranking.getSimulatedBattleHistory(targetId, 10);

			const output = TCG_UI.buildBattleHistory({
				username: targetUser,
				battles: simulatedBattles,
				userId: targetId,
				nameColor: Impulse.nameColor
			});
			
			this.sendReplyBox(output);
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async season(target, room, user) {
		await TCG_Ranking.getPlayerRanking(user.id);
		if (!this.runBroadcast()) return;
		const [action] = target.split(',').map(p => p.trim());
		
		try {
			if (toID(action) === 'end' && this.checkCan('globalban')) {
				const success = await TCG_Ranking.forceEndSeason();
				if (success) {
					this.sendReply("Current season has been ended and rewards distributed. New season started!");
				} else {
					this.errorReply("No active season found to end.");
				}
				return;
			}
			
			const seasonInfo = await TCG_Ranking.getCurrentSeasonInfo();
			if (!seasonInfo) {
				return this.sendReplyBox("No active season found.");
			}
			
			const { season, daysRemaining, hoursRemaining } = seasonInfo;
			
			const output = TCG_UI.buildSeasonInfo({
				season,
				daysRemaining,
				hoursRemaining
			});
			
			this.sendReplyBox(output);
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async seasonhistory(target, room, user) {
		await TCG_Ranking.getPlayerRanking(user.id);
		if (!this.runBroadcast()) return;
		const targetUser = target.trim() || user.name;
		const targetId = toID(targetUser);
		
		try {
			const seasonRewards = await TCG_Ranking.getUserSeasonRewards(targetId);
			
			const output = TCG_UI.buildSeasonHistory({
				username: targetUser,
				seasonRewards,
				nameColor: Impulse.nameColor
			});
			
			this.sendReplyBox(output);
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async milestones(target, room, user) {
		if (!this.runBroadcast()) return;
		
		try {
			const available = await TCG_Ranking.getAvailableMilestones(user.id);
			const summary = await TCG_Ranking.getWeeklyMilestoneSummary(user.id);
			
			let output = TCG_UI.buildInfoBox(
				`🏆 Weekly Milestones - Week ${summary.weekNumber}`,
				`<p><strong>Time Remaining:</strong> ${summary.daysRemaining} days</p>` +
				`<p><strong>Completed:</strong> ${summary.milestonesCompleted}/${summary.totalMilestones} | <strong>Credits Earned:</strong> ${summary.totalCreditsEarned}</p>`
			);

			output = output.replace('</div>', '<hr/><div style="max-height: 360px; overflow-y: auto;">');
			
			const categories = {
				'Battle Milestones': available.filter(m => m.milestoneId.includes('battles') || m.milestoneId.includes('wins')),
				'Collection Milestones': available.filter(m => m.milestoneId.includes('packs') || m.milestoneId.includes('opened')),
				'Economy Milestones': available.filter(m => m.milestoneId.includes('credits')),
			};
			
			for (const [category, milestones] of Object.entries(categories)) {
				if (milestones.length === 0) continue;
				
				const rows = milestones.map(milestone => {
					const progressPercent = Math.min(100, Math.round((milestone.progress / milestone.requirement) * 100));
					
					let progressBarColor = '#2ecc71';
					let progressBgColor = '#ecf0f1';
					
					if (milestone.alreadyClaimed) {
						progressBarColor = '#95a5a6';
					} else if (milestone.canClaim) {
						progressBarColor = '#27ae60';
					}
					
					const progressBar = TCG_UI.buildProgressBar({
						current: milestone.progress,
						total: milestone.requirement,
						color: progressBarColor,
						bgColor: progressBgColor,
						showText: true,
						height: '20px'
					});
					
					let actionCell = '';
					if (milestone.alreadyClaimed) {
						actionCell = `<span style="color: #27ae60; font-weight: bold; font-size: 12px;">✅ Claimed</span>`;
					} else if (milestone.canClaim) {
						actionCell = `<button name="send" value="/tcg claimmilestone ${milestone.milestoneId}" style="background: #27ae60; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold;">Claim</button>`;
					} else if (progressPercent >= 80) {
						actionCell = `<span style="color: #f39c12; font-weight: bold; font-size: 12px;">Almost there!</span>`;
					} else {
						actionCell = `<span style="color: #95a5a6; font-size: 12px;">${progressPercent}% complete</span>`;
					}
					
					return [
						`<strong>${milestone.name}</strong><br/><small style="color: #666;">${milestone.description}</small>`,
						`<div style="width: 120px;">${progressBar}</div>`,
						`<strong style="color: #f39c12;">${milestone.reward}</strong> Credits`,
						actionCell
					];
				});
				
				const categoryTable = `<h4 style="margin-top: 15px; margin-bottom: 8px;">${category}</h4>` +
					TCG_UI.buildTable({
						headers: ['Achievement', 'Progress', 'Reward', 'Action'],
						rows,
						scrollable: false
					});
				
				output = output.replace('</div></div>', categoryTable + '</div></div>');
			}

			this.sendReplyBox(output);
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async claimmilestone(target, room, user) {
		const milestoneId = target.trim();
		if (!milestoneId) {
			return this.errorReply("Usage: /tcg claimmilestone [milestone_id]");
		}
		try {
			const result = await TCG_Ranking.claimMilestone(user.id, milestoneId);
	
			if (!result.success) {
				return this.errorReply(result.error || "Failed to claim milestone.");
			}
	
			this.sendReply(`🎉 Congratulations! You've earned the "${result.milestoneName}" achievement and received ${result.reward} Credits!`);
	
			const balance = await TCG_Economy.getUserBalance(user.id);
			this.sendReply(`Your balance is now: ${balance} Credits.`);
	
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},
};
