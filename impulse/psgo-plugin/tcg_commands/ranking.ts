/**
 * Ranking and milestone TCG commands
 */

import * as TCG_Ranking from '../tcg_ranking';
import * as TCG_Economy from '../tcg_economy';
import { PAGINATION_CONFIG, ERROR_MESSAGES } from '../tcg_config';

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
				`<h2 style="text-align:center;">${Impulse.nameColor(targetUser, true)}'s Ranking</h2>`;
			
			// Main ranking card
			output += `<div style="display:flex; gap:20px; margin:20px 0;">` +
				`<div style="flex:1; text-align:center; padding:15px; background:${rankColor}15; border:2px solid ${rankColor}; border-radius:8px;">` +
				`<div style="font-size:2em; font-weight:bold; color:${rankColor}; margin-bottom:10px;">${ranking.rank}</div>` +
				`<div style="font-size:1.2em; color:#666;">Rank #${position}</div>` +
				`</div>` +
				`<div style="flex:1; text-align:center; padding:15px; background:#f39c1215; border:2px solid #f39c12; border-radius:8px;">` +
				`<div style="font-size:2em; font-weight:bold; color:#f39c12; margin-bottom:10px;">${ranking.elo}</div>` +
				`<div style="font-size:1.2em; color:#666;">ELO Rating</div>` +
				`</div>` +
				`</div>`;
			
			// Statistics grid
			output += `<div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:15px; margin:20px 0;">` +
				`<div style="padding:10px; background:#f8f9fa; border-radius:5px;">` +
				`<div style="font-weight:bold; color:#2c3e50;">Win Rate</div>` +
				`<div style="font-size:1.3em; color:${winRate >= 70 ? '#27ae60' : winRate >= 50 ? '#f39c12' : '#e74c3c'};">${winRate}%</div>` +
				`</div>` +
				`<div style="padding:10px; background:#f8f9fa; border-radius:5px;">` +
				`<div style="font-weight:bold; color:#2c3e50;">Record</div>` +
				`<div style="font-size:1.1em;">${ranking.wins}W-${ranking.losses}L-${ranking.draws}D</div>` +
				`</div>` +
				`<div style="padding:10px; background:#f8f9fa; border-radius:5px;">` +
				`<div style="font-weight:bold; color:#2c3e50;">Win Streak</div>` +
				`<div style="font-size:1.1em;">${ranking.winStreak} <span style="color:#666;">(Best: ${ranking.bestWinStreak})</span></div>` +
				`</div>` +
				`<div style="padding:10px; background:#f8f9fa; border-radius:5px;">` +
				`<div style="font-weight:bold; color:#2c3e50;">Total Battles</div>` +
				`<div style="font-size:1.1em;">${ranking.totalBattles}</div>` +
				`</div>` +
				`</div>`;
			
			// Average pack value
			if (ranking.averagePackValue) {
				output += `<div style="text-align:center; margin:15px 0; padding:10px; background:#e8f5e8; border-radius:5px;">` +
					`<strong>Average Pack Value:</strong> <span style="color:#27ae60; font-size:1.2em;">${ranking.averagePackValue} points</span>` +
					`</div>`;
			}
			
			output += `</div>`;
			
			this.sendReplyBox(output);
			
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async leaderboard(target, room, user) {
		if (!this.runBroadcast()) return;
		
		const sortBy = target ? toID(target) : 'elo';
		
		try {
			let players: any[];
			let sortLabel: string;
			
			switch (sortBy) {
				case 'wins':
					players = await TCG_Ranking.getTopPlayersByWins(20);
					sortLabel = 'Most Wins';
					break;
				case 'winrate':
					players = await TCG_Ranking.getTopPlayersByWinRate(20);
					sortLabel = 'Highest Win Rate';
					break;
				case 'streak':
					players = await TCG_Ranking.getTopPlayersByWinStreak(20);
					sortLabel = 'Longest Win Streak';
					break;
				case 'elo':
				default:
					players = await TCG_Ranking.getTopPlayersByElo(20);
					sortLabel = 'Highest ELO';
					break;
			}
			
			if (players.length === 0) {
				return this.sendReplyBox(`<div class="infobox">` +
					`<h3>🏆 Leaderboard</h3>` +
					`<p style="text-align:center; color:#666; margin:20px 0;">No ranked players found</p>` +
					`</div>`);
			}
			
			let output = `<div class="infobox">` +
				`<h2 style="text-align:center;">🏆 ${sortLabel} Leaderboard</h2>`;
			
			// Sort buttons
			output += `<div style="text-align:center; margin:15px 0;">` +
				`<button name="send" value="/tcg leaderboard elo" style="background:${sortBy === 'elo' ? '#e74c3c' : '#95a5a6'}; color:white; border:none; padding:5px 10px; border-radius:3px; margin:2px;">ELO</button>` +
				`<button name="send" value="/tcg leaderboard wins" style="background:${sortBy === 'wins' ? '#e74c3c' : '#95a5a6'}; color:white; border:none; padding:5px 10px; border-radius:3px; margin:2px;">Wins</button>` +
				`<button name="send" value="/tcg leaderboard winrate" style="background:${sortBy === 'winrate' ? '#e74c3c' : '#95a5a6'}; color:white; border:none; padding:5px 10px; border-radius:3px; margin:2px;">Win Rate</button>` +
				`<button name="send" value="/tcg leaderboard streak" style="background:${sortBy === 'streak' ? '#e74c3c' : '#95a5a6'}; color:white; border:none; padding:5px 10px; border-radius:3px; margin:2px;">Streak</button>` +
				`</div>`;
			
			// Leaderboard table
			output += `<table style="width:100%; margin:15px 0;">` +
				`<tr style="background:#f5f5f5;">` +
				`<th style="padding:8px; text-align:center;">Rank</th>` +
				`<th style="padding:8px; text-align:left;">Player</th>` +
				`<th style="padding:8px; text-align:center;">Rating/Rank</th>` +
				`<th style="padding:8px; text-align:center;">Record</th>` +
				`<th style="padding:8px; text-align:center;">Win Rate</th>` +
				`</tr>`;
			
			players.forEach((player, index) => {
				const winRate = TCG_Ranking.getWinRate(player.wins, player.losses, player.draws);
				const rankColor = TCG_Ranking.getRankColor(player.rank);
				
				let displayValue: string;
				switch (sortBy) {
					case 'wins':
						displayValue = `${player.wins} wins`;
						break;
					case 'winrate':
						displayValue = `${winRate}%`;
						break;
					case 'streak':
						displayValue = `${player.winStreak} streak`;
						break;
					default:
						displayValue = `${player.elo} ELO`;
						break;
				}
				
				output += `<tr style="border-bottom:1px solid #ddd;">` +
					`<td style="padding:8px; text-align:center; font-weight:bold;">${index + 1}</td>` +
					`<td style="padding:8px;">${Impulse.nameColor(player.userId, true)}</td>` +
					`<td style="padding:8px; text-align:center; color:${rankColor}; font-weight:bold;">${displayValue}</td>` +
					`<td style="padding:8px; text-align:center;">${player.wins}W-${player.losses}L-${player.draws}D</td>` +
					`<td style="padding:8px; text-align:center;">${winRate}%</td>` +
					`</tr>`;
			});
			
			output += `</table></div>`;
			
			this.sendReplyBox(output);
			
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async history(target, room, user) {
		if (!this.runBroadcast()) return;
		
		const targetUser = target.trim() || user.name;
		const targetId = toID(targetUser);
		
		try {
			const battles = await TCG_Ranking.getPlayerBattleHistory(targetId, 10);
			
			if (battles.length === 0) {
				return this.sendReplyBox(`<div class="infobox">` +
					`<h3>${Impulse.nameColor(targetUser, true)}'s Battle History</h3>` +
					`<p style="text-align:center; color:#666; margin:20px 0;">No ranked battle history found</p>` +
					`</div>`);
			}
			
			let output = `<div class="infobox">` +
				`<h2 style="text-align:center;">${Impulse.nameColor(targetUser, true)}'s Battle History</h2>` +
				`<div style="text-align:center; margin:10px 0; color:#666;">Recent ${battles.length} battles</div>`;
			
			// Battle history table
			output += `<table style="width:100%; margin:15px 0;">` +
				`<tr style="background:#f5f5f5;">` +
				`<th style="padding:8px; text-align:left;">Opponent</th>` +
				`<th style="padding:8px; text-align:center;">Result</th>` +
				`<th style="padding:8px; text-align:center;">ELO Change</th>` +
				`<th style="padding:8px; text-align:center;">Pack Values</th>` +
				`<th style="padding:8px; text-align:center;">Date</th>` +
				`</tr>`;
			
			battles.forEach(battle => {
				const isPlayer1 = battle.player1 === targetId;
				const opponent = isPlayer1 ? battle.player2 : battle.player1;
				const playerPackValue = isPlayer1 ? battle.player1PackValue : battle.player2PackValue;
				const opponentPackValue = isPlayer1 ? battle.player2PackValue : battle.player1PackValue;
				const eloChange = isPlayer1 ? battle.player1EloChange : battle.player2EloChange;
				
				let result: string;
				let resultColor: string;
				
				if (battle.winner === targetId) {
					result = 'Victory';
					resultColor = '#27ae60';
				} else if (battle.winner === 'draw') {
					result = 'Draw';
					resultColor = '#f39c12';
				} else {
					result = 'Defeat';
					resultColor = '#e74c3c';
				}
				
				const eloChangeStr = eloChange >= 0 ? `+${eloChange}` : `${eloChange}`;
				const eloColor = eloChange >= 0 ? '#27ae60' : '#e74c3c';
				const date = new Date(battle.timestamp).toLocaleDateString();
				
				output += `<tr style="border-bottom:1px solid #ddd;">` +
					`<td style="padding:8px;">${Impulse.nameColor(opponent, true)}</td>` +
					`<td style="padding:8px; text-align:center; color:${resultColor}; font-weight:bold;">${result}</td>` +
					`<td style="padding:8px; text-align:center; color:${eloColor}; font-weight:bold;">${eloChangeStr}</td>` +
					`<td style="padding:8px; text-align:center;">${playerPackValue} vs ${opponentPackValue}</td>` +
					`<td style="padding:8px; text-align:center; color:#666;">${date}</td>` +
					`</tr>`;
			});
			
			output += `</table></div>`;
			
			this.sendReplyBox(output);
			
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async season(target, room, user) {
		if (!this.runBroadcast()) return;
		
		try {
			const season = await TCG_Ranking.getCurrentSeason();
			
			if (!season) {
				return this.sendReplyBox(`<div class="infobox">` +
					`<h3>📅 Current Season</h3>` +
					`<p style="text-align:center; color:#666; margin:20px 0;">No active season</p>` +
					`</div>`);
			}
			
			const now = Date.now();
			const timeRemaining = season.endTime - now;
			const daysRemaining = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
			const hoursRemaining = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
			
			let output = `<div class="infobox">` +
				`<h2 style="text-align:center;">📅 ${season.name}</h2>` +
				`<div style="text-align:center; margin:15px 0;">` +
				`<div style="font-size:1.2em; color:#e74c3c; font-weight:bold;">` +
				`${daysRemaining} days, ${hoursRemaining} hours remaining` +
				`</div>` +
				`</div>`;
			
			// Season info
			output += `<div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:15px; margin:20px 0;">` +
				`<div style="text-align:center; padding:10px; background:#f8f9fa; border-radius:5px;">` +
				`<div style="font-weight:bold; color:#2c3e50;">Started</div>` +
				`<div>${new Date(season.startTime).toLocaleDateString()}</div>` +
				`</div>` +
				`<div style="text-align:center; padding:10px; background:#f8f9fa; border-radius:5px;">` +
				`<div style="font-weight:bold; color:#2c3e50;">Ends</div>` +
				`<div>${new Date(season.endTime).toLocaleDateString()}</div>` +
				`</div>` +
				`</div>`;
			
			// Season rewards preview
			if (season.rewards && season.rewards.length > 0) {
				output += `<h3>🏆 Season Rewards</h3>` +
					`<table style="width:100%; margin:10px 0;">` +
					`<tr style="background:#f5f5f5;">` +
					`<th style="padding:8px; text-align:center;">Rank</th>` +
					`<th style="padding:8px; text-align:center;">Credits</th>` +
					`<th style="padding:8px; text-align:left;">Title</th>` +
					`</tr>`;
				
				season.rewards.slice(0, 10).forEach(reward => {
					output += `<tr style="border-bottom:1px solid #ddd;">` +
						`<td style="padding:8px; text-align:center; font-weight:bold;">#${reward.rank}</td>` +
						`<td style="padding:8px; text-align:center; color:#f39c12;">${reward.credits}</td>` +
						`<td style="padding:8px;">${reward.title}</td>` +
						`</tr>`;
				});
				
				output += `</table>`;
			}
			
			output += `</div>`;
			
			this.sendReplyBox(output);
			
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async rewards(target, room, user) {
		if (!this.runBroadcast()) return;
		
		const targetUser = target.trim() || user.name;
		const targetId = toID(targetUser);
		
		try {
			const rewards = await TCG_Ranking.getPlayerSeasonRewards(targetId);
			
			if (rewards.length === 0) {
				return this.sendReplyBox(`<div class="infobox">` +
					`<h3>${Impulse.nameColor(targetUser, true)}'s Season Rewards</h3>` +
					`<p style="text-align:center; color:#666; margin:20px 0;">No season rewards received yet</p>` +
					`</div>`);
			}
			
			let output = `<div class="infobox">` +
				`<h2 style="text-align:center;">${Impulse.nameColor(targetUser, true)}'s Season Rewards</h2>` +
				`<div style="text-align:center; margin:10px 0; color:#666;">${rewards.length} seasons participated</div>`;
			
			// Rewards table
			output += `<table style="width:100%; margin:15px 0;">` +
				`<tr style="background:#f5f5f5;">` +
				`<th style="padding:8px; text-align:left;">Season</th>` +
				`<th style="padding:8px; text-align:center;">Rank</th>` +
				`<th style="padding:8px; text-align:center;">Credits</th>` +
				`<th style="padding:8px; text-align:left;">Title</th>` +
				`<th style="padding:8px; text-align:center;">Date</th>` +
				`</tr>`;
			
			rewards.forEach(reward => {
				const seasonName = reward.seasonId.replace(/season_(\d+)_.*/, 'Season $1');
				const date = new Date(reward.timestamp).toLocaleDateString();
				
				output += `<tr style="border-bottom:1px solid #ddd;">` +
					`<td style="padding:8px; font-weight:bold;">${seasonName}</td>` +
					`<td style="padding:8px; text-align:center; color:#e74c3c; font-weight:bold;">#${reward.rank}</td>` +
					`<td style="padding:8px; text-align:center; color:#f39c12;">${reward.credits}</td>` +
					`<td style="padding:8px;">${reward.title || '-'}</td>` +
					`<td style="padding:8px; text-align:center; color:#666;">${date}</td>` +
					`</tr>`;
			});
			
			output += `</table></div>`;
			
			this.sendReplyBox(output);
			
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async milestones(target, room, user) {
		if (!this.runBroadcast()) return;
		
		try {
			const summary = await TCG_Ranking.getMilestoneSummary(user.id);
			
			if (!summary) {
				return this.sendReplyBox(`<div class="infobox">` +
					`<h3>🎯 Milestones</h3>` +
					`<p style="text-align:center; color:#666; margin:20px 0;">No milestone data available</p>` +
					`</div>`);
			}
			
			let output = `<div class="infobox">` +
				`<h2 style="text-align:center;">🎯 Your Milestones</h2>`;
			
			// Summary stats
			output += `<div style="text-align:center; margin:15px 0; padding:15px; background:#f8f9fa; border-radius:8px;">` +
				`<div style="font-size:1.3em; font-weight:bold; color:#2c3e50; margin-bottom:10px;">` +
				`${summary.milestonesCompleted}/${summary.totalMilestones} Completed` +
				`</div>` +
				`<div style="color:#f39c12; font-size:1.1em;">` +
				`<strong>${summary.totalCreditsEarned} Credits Earned</strong>` +
				`</div>`;
			
			if (summary.daysRemaining !== undefined) {
				output += `<div style="margin-top:10px; color:#666;">` +
					`⏰ ${summary.daysRemaining} days remaining` +
					`</div>`;
			}
			
			output += `</div>`;
			
			// Milestones table
			if (summary.milestones && summary.milestones.length > 0) {
				output += `<table style="width:100%; margin:15px 0;">` +
					`<tr style="background:#f5f5f5;">` +
					`<th style="padding:8px; text-align:left;">Achievement</th>` +
					`<th style="padding:8px; text-align:center;">Progress</th>` +
					`<th style="padding:8px; text-align:center;">Reward</th>` +
					`<th style="padding:8px; text-align:center;">Action</th>` +
					`</tr>`;
				
				summary.milestones.forEach(milestone => {
					const progressPercent = Math.round((milestone.currentProgress / milestone.targetProgress) * 100);
					
					output += `<tr style="border-bottom:1px solid #ddd;">` +
						`<td style="padding:8px;">` +
						`<div style="font-weight:bold;">${milestone.name}</div>` +
						`<div style="font-size:0.9em; color:#666;">${milestone.description}</div>` +
						`</td>` +
						`<td style="padding:8px; text-align:center;">` +
						`<div>${milestone.currentProgress}/${milestone.targetProgress}</div>` +
						`<div style="width:100%; background:#ddd; border-radius:10px; height:8px; margin-top:3px;">` +
						`<div style="width:${Math.min(100, progressPercent)}%; background:#27ae60; height:100%; border-radius:10px;"></div>` +
						`</div>` +
						`</td>` +
						`<td style="padding:8px; text-align:center; color:#f39c12;">${milestone.reward} Credits</td>` +
						`<td style="padding:8px; text-align:center;">`;
					
					if (milestone.alreadyClaimed) {
						output += `<span style="color:#27ae60;">✅ Claimed</span>`;
					} else if (milestone.canClaim) {
						output += `<button name="send" value="/tcg milestones claim, ${milestone.id}" style="background:#27ae60; color:white; border:none; padding:3px 8px; border-radius:3px; cursor:pointer;">Claim</button>`;
					} else if (progressPercent >= 80) {
						output += `<span style="color:#f39c12;">Almost there!</span>`;
					} else {
						output += `<span style="color:#666;">${progressPercent}% complete</span>`;
					}
					
					output += `</td></tr>`;
				});
				
				output += `</table>`;
			}
			
			output += `</div>`;
			
			this.sendReplyBox(output);
			
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

};
