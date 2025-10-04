/**
 * TCG Collections Module
 * Central definition of all MongoDB collections used by the TCG plugin.
 */

import { MongoDB } from '../../impulse/mongodb_module';

// Existing collections
export const TCGCards = MongoDB<TCGCard>('tcg_cards');
export const UserCollections = MongoDB<UserCollection>('tcg_user_collections');
export const ShopStateCollection = MongoDB<ShopState>('tcg_shop_state');

// New ranking system collections
export const PlayerRankings = MongoDB<PlayerRanking>('tcg_player_rankings');
export const BattleHistories = MongoDB<BattleHistory>('tcg_battle_histories');
export const RankingSeasons = MongoDB<RankingSeason>('tcg_ranking_seasons');
export const DailyChallenges = MongoDB<DailyChallenge>('tcg_daily_challenges');
export const SimulatedBattles = MongoDB<SimulatedBattle>('tcg_simulated_battles');
export const SeasonRewards = MongoDB<SeasonReward>('tcg_season_rewards');
export const WeeklyMilestonesCollection = MongoDB<WeeklyMilestones>('tcg_weekly_milestones');
