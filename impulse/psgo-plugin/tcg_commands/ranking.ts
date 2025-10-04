/**
 * Ranking and milestone TCG commands
 */

import * as TCG_Ranking from '../../../impulse/psgo-plugin/tcg_ranking';
import * as TCG_Economy from '../../../impulse/psgo-plugin/tcg_economy';
import { PAGINATION_CONFIG, ERROR_MESSAGES } from '../../../impulse/psgo-plugin/tcg_config';

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
			
			const rankColor = TCG_Ranking.getRankColor(ranking.rank);
			const winRate = TCG_Ranking.getWinRate(ranking.wins, ranking.losses, ranking.draws);
			
			let output = `<div class="infobox">` +
				`<h3>${Impulse.nameColor(targetUser, true)}'s Ranking</h3>` +
				`<table style="width: 100%;">` +
				`<tr><td><strong>Rank:</strong></td><td><span style="color: ${rankColor}; font-weight: bold;">${ranking.rank}</span></td></tr>` +
				`<tr><td><strong>ELO:</strong></td><td>${ranking.elo}</td></tr>` +
				`<tr><td><strong>Position:</strong></td><td>#${position}</td></tr>` +
				`<tr><td><strong>Win Rate:</strong></td><td>${winRate}%</td></tr>` +
				`<tr><td><strong>Record:</strong></td><td>${ranking.wins}W - ${ranking.losses}L - ${ranking.draws}D</td></tr>` +
				`<tr><td><strong>Win Streak:</strong></td><td>${ranking.winStreak} (Best: ${ranking.bestWinStreak})</td></tr>` +
				`<tr><td><strong>Total Battles:</strong></td><td>${ranking.totalBattles}</td></tr>` +
				`<tr><td><strong>Avg Pack Value:</strong></td><td>${ranking.averagePackValue} pts</td></tr>` +
				`</table>` +
				`</div>`;
			
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
			let title;
			
			if (type === 'seasonal') {
				leaderboard = await TCG_Ranking.getSeasonalLeaderboard(10);
				title = 'Seasonal Leaderboard (Wins)';
			} else {
				leaderboard = await TCG_Ranking.getLeaderboard(10);
				title = 'ELO Leaderboard';
			}
			
			let output = `<div class="infobox">` +
				`<h3>${title}</h3>` +
				`<div style="max-height: ${PAGINATION_CONFIG.MAX_HEIGHT}; overflow-y: auto;">` +
				`<table class="themed-table">` +
				`<tr class="themed-table-header">` +
				`<th>Rank</th><th>Player</th><th>Rating/Rank</th><th>Record</th><th>Win Rate</th>` +
				`</tr>`;
			
			leaderboard.forEach((player, index) => {
				const rankColor = TCG_Ranking.getRankColor(player.rank);
				const winRate = TCG_Ranking.getWinRate(player.wins, player.losses, player.draws);
				const displayValue = type === 'seasonal' ? 
					`${player.seasonWins || 0} wins` : 
					`${player.elo} (${player.rank})`;
				
				output += `<tr class="themed-table-row">` +
					`<td>${index + 1}</td>` +
					`<td>${Impulse.nameColor(player.userId, true)}</td>` +
					`<td><span style="color: ${rankColor};">${displayValue}</span></td>` +
					`<td>${player.wins}W-${player.losses}L-${player.draws}D</td>` +
					`<td>${winRate}%</td>` +
					`</tr>`;
			});
			
			output += `</table>` +
				`</div>` +
				`<p style="text-align: center; margin-top: 10px;">` +
				`<button name="send" value="/tcg leaderboard elo">ELO</button> | ` +
				`<button name="send" value="/tcg leaderboard seasonal">Seasonal</button>` +
				`</p>` +
				`</div>`;
			
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
			// Only get simulated battles since all ranked battles are simulated now
			const simulatedBattles = await TCG_Ranking.getSimulatedBattleHistory(targetId, 10);

			let output = `<div class="infobox">` +
				`<h3>${Impulse.nameColor(targetUser, true)}'s Battle History</h3>`;
			
			if (simulatedBattles.length === 0) {
				output += `<p>${targetUser} has no ranked battle history.</p>`;
			} else {
				output += `<div style="max-height: ${PAGINATION_CONFIG.MAX_HEIGHT}; overflow-y: auto;">` +
					`<table class="themed-table">` +
					`<tr class="themed-table-header">` +
					`<th>Opponent</th><th>Result</th><th>ELO Change</th><th>Pack Values</th><th>Date</th>` +
					`</tr>`;
				
				simulatedBattles.forEach(battle => {
					const isChallenger = battle.challengerId === targetId;
					const opponent = isChallenger ? battle.targetId : battle.challengerId;
					
					const playerPackValue = isChallenger ? battle.challengerPackValue : battle.targetPackValue;
					const opponentPackValue = isChallenger ? battle.targetPackValue : battle.challengerPackValue;
					const eloChange = isChallenger ? battle.challengerEloChange : battle.targetEloChange;
					
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
					const date = new Date(battle.timestamp).toLocaleDateString();
					
					output += `<tr class="themed-table-row">` +
						`<td>${Impulse.nameColor(opponent, true)}</td>` +
						`<td><span style="color: ${resultColor};">${result}</span></td>` +
						`<td><span style="color: ${eloColor};">${eloChangeStr}</span></td>` +
						`<td>${playerPackValue} vs ${opponentPackValue}</td>` +
						`<td>${date}</td>` +
						`</tr>`;
				});
				
				output += `</table>` +
					`</div>`;
			}
			
			output += `</div>`;
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
			
			let output = `<div class="infobox">` +
				`<h3>🏆 ${season.name}</h3>` +
				`<p><strong>Time Remaining:</strong> ${daysRemaining} days, ${hoursRemaining} hours</p>` +
				`<p><strong>Started:</strong> ${new Date(season.startTime).toLocaleDateString()}</p>` +
				`<p><strong>Ends:</strong> ${new Date(season.endTime).toLocaleDateString()}</p>` +
				`<div style="max-height: ${PAGINATION_CONFIG.MAX_HEIGHT}; overflow-y: auto;">` +
				`<h4>Season Rewards (Top 10)</h4>` +
				`<table class="themed-table">` +
				`<tr class="themed-table-header"><th>Rank</th><th>Credits</th><th>Title</th></tr>`;
			
			Object.entries(TCG_Ranking.SEASON_REWARDS).forEach(([rank, reward]) => {
				output += `<tr class="themed-table-row">` +
					`<td>#${rank}</td>` +
					`<td>${reward.credits}</td>` +
					`<td>${reward.title}</td>` +
					`</tr>`;
			});
			
			output += `</table>` +
				`</div>` +
				`</div>`;
			
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
			
			let output = `<div class="infobox">` +
				`<h3>${Impulse.nameColor(targetUser, true)}'s Season History</h3>`;
			
			if (seasonRewards.length === 0) {
				output += `<p>${targetUser} has not received any season rewards yet.</p>`;
			} else {
				output += `<div style="max-height: ${PAGINATION_CONFIG.MAX_HEIGHT}; overflow-y: auto;">` +
					`<table class="themed-table">` +
					`<tr class="themed-table-header"><th>Season</th><th>Rank</th><th>Credits</th><th>Title</th><th>Date</th></tr>`;
				
				seasonRewards.forEach(reward => {
					const date = new Date(reward.claimedAt).toLocaleDateString();
					output += `<tr class="themed-table-row">` +
						`<td>${reward.seasonId.replace(/season_(\d+)_.*/, 'Season $1')}</td>` +
						`<td>#${reward.rank}</td>` +
						`<td>${reward.credits}</td>` +
						`<td>${reward.title || '-'}</td>` +
						`<td>${date}</td>` +
						`</tr>`;
				});
				
				output += `</table>` +
					`</div>`;
			}
			output += `</div>`;
			
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
			
			let output = `<div class="infobox">` +
				`<h3>🏆 Weekly Milestones - Week ${summary.weekNumber}</h3>` +
				`<p><strong>Time Remaining:</strong> ${summary.daysRemaining} days</p>` +
				`<p><strong>Completed:</strong> ${summary.milestonesCompleted}/${summary.totalMilestones} | <strong>Credits Earned:</strong> ${summary.totalCreditsEarned}</p>` +
				`<hr/>` +
				`<div style="max-height: ${PAGINATION_CONFIG.MAX_HEIGHT}; overflow-y: auto;">`;
			
			// Group milestones by category
			const categories = {
				'Battle Milestones': available.filter(m => m.milestoneId.includes('battles') || m.milestoneId.includes('wins')),
				'Collection Milestones': available.filter(m => m.milestoneId.includes('packs') || m.milestoneId.includes('opened')),
				'Economy Milestones': available.filter(m => m.milestoneId.includes('credits')),
			};
			
			for (const [category, milestones] of Object.entries(categories)) {
				if (milestones.length === 0) continue;
				
				output += `<h4 style="margin-top: 15px; margin-bottom: 8px;">${category}</h4>` +
					`<table class="themed-table">` +
					`<tr class="themed-table-header"><th>Achievement</th><th>Progress</th><th>Reward</th><th>Action</th></tr>`;
				
				milestones.forEach(milestone => {
					const progressPercent = Math.min(100, Math.round((milestone.progress / milestone.requirement) * 100));
					
					// Use green color scheme for progress bar
					let progressBarColor = '#2ecc71'; // Default green
					let progressBgColor = '#ecf0f1'; // Light gray background
					
					// Different colors based on status
					if (milestone.alreadyClaimed) {
						progressBarColor = '#95a5a6'; // Gray for claimed
						progressBgColor = '#ecf0f1';
					} else if (milestone.canClaim) {
						progressBarColor = '#27ae60'; // Darker green if claimable
					}
					
					output += `<tr class="themed-table-row">` +
						`<td><strong>${milestone.name}</strong><br/><small style="color: #666;">${milestone.description}</small></td>` +
						`<td style="width: 120px;">` +
						`<div style="background: ${progressBgColor}; border-radius: 4px; overflow: hidden; border: 1px solid #bdc3c7; position: relative; height: 20px;">` +
						`<div style="width: ${progressPercent}%; background: ${progressBarColor}; height: 100%; transition: width 0.3s ease;"></div>`;
					
					// Progress text overlay - always visible and readable
					const textColor = progressPercent > 50 ? '#fff' : '#2c3e50';
					const textShadow = progressPercent > 50 ? 'text-shadow: 1px 1px 1px rgba(0,0,0,0.3);' : '';
					
					output += `<div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; color: ${textColor}; ${textShadow}">` +
						`${milestone.progress}/${milestone.requirement} (${progressPercent}%)` +
						`</div>` +
						`</div>` +
						`</td>` +
						`<td><strong style="color: #f39c12;">${milestone.reward}</strong> Credits</td>` +
						`<td>`;
					
					if (milestone.alreadyClaimed) {
						output += `<span style="color: #27ae60; font-weight: bold; font-size: 12px;">✅ Claimed</span>`;
					} else if (milestone.canClaim) {
						output += `<button name="send" value="/tcg claimmilestone ${milestone.milestoneId}" style="background: #27ae60; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold;">Claim</button>`;
					} else if (progressPercent >= 80) {
						output += `<span style="color: #f39c12; font-weight: bold; font-size: 12px;">Almost there!</span>`;
					} else {
						output += `<span style="color: #95a5a6; font-size: 12px;">${progressPercent}% complete</span>`;
					}
					output += `</td>` +
						`</tr>`;
				});
				
				output += `</table>`;
			}

			output += `</div>` +
				`</div>`;
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
	
			// Show updated balance
			const balance = await TCG_Economy.getUserBalance(user.id);
			this.sendReply(`Your balance is now: ${balance} Credits.`);
	
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},
};
                                                           
