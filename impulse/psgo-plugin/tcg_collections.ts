/**
 * TCG Collections Module
 * Central definition of all MongoDB collections used by the TCG plugin.
 */

import { MongoDB } from '../../impulse/mongodb_module';
import { Collection } from 'mongodb';
import {
	TCGCard,
	UserCollection,
	ShopState,
	PlayerRanking,
	BattleHistory,
	RankingSeason,
	DailyChallenge,
	SimulatedBattle,
	SeasonReward,
	WeeklyMilestones
} from './tcg_data';

// Helper function to get a typed collection
function getCollection<T>(collectionName: string): Collection<T> {
	const db = MongoDB.getDatabase();
	return db.collection<T>(collectionName);
}

// Existing collections
export const TCGCards = getCollection<TCGCard>('tcg_cards');
export const UserCollections = getCollection<UserCollection>('tcg_user_collections');
export const ShopStateCollection = getCollection<ShopState>('tcg_shop_state');

// New ranking system collections
export const PlayerRankings = getCollection<PlayerRanking>('tcg_player_rankings');
export const BattleHistories = getCollection<BattleHistory>('tcg_battle_histories');
export const RankingSeasons = getCollection<RankingSeason>('tcg_ranking_seasons');
export const DailyChallenges = getCollection<DailyChallenge>('tcg_daily_challenges');
export const SimulatedBattles = getCollection<SimulatedBattle>('tcg_simulated_battles');
export const SeasonRewards = getCollection<SeasonReward>('tcg_season_rewards');
export const WeeklyMilestonesCollection = getCollection<WeeklyMilestones>('tcg_weekly_milestones');
