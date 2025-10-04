/**
 * TCG Collections Module
 * Central definition of all MongoDB collections used by the TCG plugin.
 * 
 * Uses lazy loading to avoid accessing MongoDB before it's connected.
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

// Cache for collections to avoid recreating them
let _tcgCards: Collection<TCGCard> | null = null;
let _userCollections: Collection<UserCollection> | null = null;
let _shopStateCollection: Collection<ShopState> | null = null;
let _playerRankings: Collection<PlayerRanking> | null = null;
let _battleHistories: Collection<BattleHistory> | null = null;
let _rankingSeasons: Collection<RankingSeason> | null = null;
let _dailyChallenges: Collection<DailyChallenge> | null = null;
let _simulatedBattles: Collection<SimulatedBattle> | null = null;
let _seasonRewards: Collection<SeasonReward> | null = null;
let _weeklyMilestonesCollection: Collection<WeeklyMilestones> | null = null;

// Helper function to get a typed collection
function getCollection<T>(collectionName: string): Collection<T> {
	const db = MongoDB.getDatabase();
	return db.collection<T>(collectionName);
}

// Lazy getter functions - these only access MongoDB when called
export const TCGCards = {
	findOne: (...args: Parameters<Collection<TCGCard>['findOne']>) => {
		if (!_tcgCards) _tcgCards = getCollection<TCGCard>('tcg_cards');
		return _tcgCards.findOne(...args);
	},
	find: (...args: Parameters<Collection<TCGCard>['find']>) => {
		if (!_tcgCards) _tcgCards = getCollection<TCGCard>('tcg_cards');
		return _tcgCards.find(...args);
	},
	insertOne: (...args: Parameters<Collection<TCGCard>['insertOne']>) => {
		if (!_tcgCards) _tcgCards = getCollection<TCGCard>('tcg_cards');
		return _tcgCards.insertOne(...args);
	},
	insertMany: (...args: Parameters<Collection<TCGCard>['insertMany']>) => {
		if (!_tcgCards) _tcgCards = getCollection<TCGCard>('tcg_cards');
		return _tcgCards.insertMany(...args);
	},
	updateOne: (...args: Parameters<Collection<TCGCard>['updateOne']>) => {
		if (!_tcgCards) _tcgCards = getCollection<TCGCard>('tcg_cards');
		return _tcgCards.updateOne(...args);
	},
	updateMany: (...args: Parameters<Collection<TCGCard>['updateMany']>) => {
		if (!_tcgCards) _tcgCards = getCollection<TCGCard>('tcg_cards');
		return _tcgCards.updateMany(...args);
	},
	deleteOne: (...args: Parameters<Collection<TCGCard>['deleteOne']>) => {
		if (!_tcgCards) _tcgCards = getCollection<TCGCard>('tcg_cards');
		return _tcgCards.deleteOne(...args);
	},
	deleteMany: (...args: Parameters<Collection<TCGCard>['deleteMany']>) => {
		if (!_tcgCards) _tcgCards = getCollection<TCGCard>('tcg_cards');
		return _tcgCards.deleteMany(...args);
	},
	countDocuments: (...args: Parameters<Collection<TCGCard>['countDocuments']>) => {
		if (!_tcgCards) _tcgCards = getCollection<TCGCard>('tcg_cards');
		return _tcgCards.countDocuments(...args);
	},
	distinct: (...args: Parameters<Collection<TCGCard>['distinct']>) => {
		if (!_tcgCards) _tcgCards = getCollection<TCGCard>('tcg_cards');
		return _tcgCards.distinct(...args);
	},
	aggregate: (...args: Parameters<Collection<TCGCard>['aggregate']>) => {
		if (!_tcgCards) _tcgCards = getCollection<TCGCard>('tcg_cards');
		return _tcgCards.aggregate(...args);
	}
};

export const UserCollections = {
	findOne: (...args: Parameters<Collection<UserCollection>['findOne']>) => {
		if (!_userCollections) _userCollections = getCollection<UserCollection>('tcg_user_collections');
		return _userCollections.findOne(...args);
	},
	find: (...args: Parameters<Collection<UserCollection>['find']>) => {
		if (!_userCollections) _userCollections = getCollection<UserCollection>('tcg_user_collections');
		return _userCollections.find(...args);
	},
	insertOne: (...args: Parameters<Collection<UserCollection>['insertOne']>) => {
		if (!_userCollections) _userCollections = getCollection<UserCollection>('tcg_user_collections');
		return _userCollections.insertOne(...args);
	},
	updateOne: (...args: Parameters<Collection<UserCollection>['updateOne']>) => {
		if (!_userCollections) _userCollections = getCollection<UserCollection>('tcg_user_collections');
		return _userCollections.updateOne(...args);
	},
	updateMany: (...args: Parameters<Collection<UserCollection>['updateMany']>) => {
		if (!_userCollections) _userCollections = getCollection<UserCollection>('tcg_user_collections');
		return _userCollections.updateMany(...args);
	},
	deleteOne: (...args: Parameters<Collection<UserCollection>['deleteOne']>) => {
		if (!_userCollections) _userCollections = getCollection<UserCollection>('tcg_user_collections');
		return _userCollections.deleteOne(...args);
	},
	countDocuments: (...args: Parameters<Collection<UserCollection>['countDocuments']>) => {
		if (!_userCollections) _userCollections = getCollection<UserCollection>('tcg_user_collections');
		return _userCollections.countDocuments(...args);
	}
};

export const ShopStateCollection = {
	findOne: (...args: Parameters<Collection<ShopState>['findOne']>) => {
		if (!_shopStateCollection) _shopStateCollection = getCollection<ShopState>('tcg_shop_state');
		return _shopStateCollection.findOne(...args);
	},
	insertOne: (...args: Parameters<Collection<ShopState>['insertOne']>) => {
		if (!_shopStateCollection) _shopStateCollection = getCollection<ShopState>('tcg_shop_state');
		return _shopStateCollection.insertOne(...args);
	},
	updateOne: (...args: Parameters<Collection<ShopState>['updateOne']>) => {
		if (!_shopStateCollection) _shopStateCollection = getCollection<ShopState>('tcg_shop_state');
		return _shopStateCollection.updateOne(...args);
	}
};

export const PlayerRankings = {
	findOne: (...args: Parameters<Collection<PlayerRanking>['findOne']>) => {
		if (!_playerRankings) _playerRankings = getCollection<PlayerRanking>('tcg_player_rankings');
		return _playerRankings.findOne(...args);
	},
	find: (...args: Parameters<Collection<PlayerRanking>['find']>) => {
		if (!_playerRankings) _playerRankings = getCollection<PlayerRanking>('tcg_player_rankings');
		return _playerRankings.find(...args);
	},
	insertOne: (...args: Parameters<Collection<PlayerRanking>['insertOne']>) => {
		if (!_playerRankings) _playerRankings = getCollection<PlayerRanking>('tcg_player_rankings');
		return _playerRankings.insertOne(...args);
	},
	updateOne: (...args: Parameters<Collection<PlayerRanking>['updateOne']>) => {
		if (!_playerRankings) _playerRankings = getCollection<PlayerRanking>('tcg_player_rankings');
		return _playerRankings.updateOne(...args);
	},
	updateMany: (...args: Parameters<Collection<PlayerRanking>['updateMany']>) => {
		if (!_playerRankings) _playerRankings = getCollection<PlayerRanking>('tcg_player_rankings');
		return _playerRankings.updateMany(...args);
	},
	countDocuments: (...args: Parameters<Collection<PlayerRanking>['countDocuments']>) => {
		if (!_playerRankings) _playerRankings = getCollection<PlayerRanking>('tcg_player_rankings');
		return _playerRankings.countDocuments(...args);
	}
};

export const BattleHistories = {
	findOne: (...args: Parameters<Collection<BattleHistory>['findOne']>) => {
		if (!_battleHistories) _battleHistories = getCollection<BattleHistory>('tcg_battle_histories');
		return _battleHistories.findOne(...args);
	},
	find: (...args: Parameters<Collection<BattleHistory>['find']>) => {
		if (!_battleHistories) _battleHistories = getCollection<BattleHistory>('tcg_battle_histories');
		return _battleHistories.find(...args);
	},
	insertOne: (...args: Parameters<Collection<BattleHistory>['insertOne']>) => {
		if (!_battleHistories) _battleHistories = getCollection<BattleHistory>('tcg_battle_histories');
		return _battleHistories.insertOne(...args);
	}
};

export const RankingSeasons = {
	findOne: (...args: Parameters<Collection<RankingSeason>['findOne']>) => {
		if (!_rankingSeasons) _rankingSeasons = getCollection<RankingSeason>('tcg_ranking_seasons');
		return _rankingSeasons.findOne(...args);
	},
	find: (...args: Parameters<Collection<RankingSeason>['find']>) => {
		if (!_rankingSeasons) _rankingSeasons = getCollection<RankingSeason>('tcg_ranking_seasons');
		return _rankingSeasons.find(...args);
	},
	insertOne: (...args: Parameters<Collection<RankingSeason>['insertOne']>) => {
		if (!_rankingSeasons) _rankingSeasons = getCollection<RankingSeason>('tcg_ranking_seasons');
		return _rankingSeasons.insertOne(...args);
	},
	updateOne: (...args: Parameters<Collection<RankingSeason>['updateOne']>) => {
		if (!_rankingSeasons) _rankingSeasons = getCollection<RankingSeason>('tcg_ranking_seasons');
		return _rankingSeasons.updateOne(...args);
	},
	updateMany: (...args: Parameters<Collection<RankingSeason>['updateMany']>) => {
		if (!_rankingSeasons) _rankingSeasons = getCollection<RankingSeason>('tcg_ranking_seasons');
		return _rankingSeasons.updateMany(...args);
	},
	countDocuments: (...args: Parameters<Collection<RankingSeason>['countDocuments']>) => {
		if (!_rankingSeasons) _rankingSeasons = getCollection<RankingSeason>('tcg_ranking_seasons');
		return _rankingSeasons.countDocuments(...args);
	}
};

export const DailyChallenges = {
	findOne: (...args: Parameters<Collection<DailyChallenge>['findOne']>) => {
		if (!_dailyChallenges) _dailyChallenges = getCollection<DailyChallenge>('tcg_daily_challenges');
		return _dailyChallenges.findOne(...args);
	},
	insertOne: (...args: Parameters<Collection<DailyChallenge>['insertOne']>) => {
		if (!_dailyChallenges) _dailyChallenges = getCollection<DailyChallenge>('tcg_daily_challenges');
		return _dailyChallenges.insertOne(...args);
	},
	updateOne: (...args: Parameters<Collection<DailyChallenge>['updateOne']>) => {
		if (!_dailyChallenges) _dailyChallenges = getCollection<DailyChallenge>('tcg_daily_challenges');
		return _dailyChallenges.updateOne(...args);
	}
};

export const SimulatedBattles = {
	find: (...args: Parameters<Collection<SimulatedBattle>['find']>) => {
		if (!_simulatedBattles) _simulatedBattles = getCollection<SimulatedBattle>('tcg_simulated_battles');
		return _simulatedBattles.find(...args);
	},
	insertOne: (...args: Parameters<Collection<SimulatedBattle>['insertOne']>) => {
		if (!_simulatedBattles) _simulatedBattles = getCollection<SimulatedBattle>('tcg_simulated_battles');
		return _simulatedBattles.insertOne(...args);
	}
};

export const SeasonRewards = {
	find: (...args: Parameters<Collection<SeasonReward>['find']>) => {
		if (!_seasonRewards) _seasonRewards = getCollection<SeasonReward>('tcg_season_rewards');
		return _seasonRewards.find(...args);
	},
	insertOne: (...args: Parameters<Collection<SeasonReward>['insertOne']>) => {
		if (!_seasonRewards) _seasonRewards = getCollection<SeasonReward>('tcg_season_rewards');
		return _seasonRewards.insertOne(...args);
	}
};

export const WeeklyMilestonesCollection = {
	findOne: (...args: Parameters<Collection<WeeklyMilestones>['findOne']>) => {
		if (!_weeklyMilestonesCollection) _weeklyMilestonesCollection = getCollection<WeeklyMilestones>('tcg_weekly_milestones');
		return _weeklyMilestonesCollection.findOne(...args);
	},
	updateOne: (...args: Parameters<Collection<WeeklyMilestones>['updateOne']>) => {
		if (!_weeklyMilestonesCollection) _weeklyMilestonesCollection = getCollection<WeeklyMilestones>('tcg_weekly_milestones');
		return _weeklyMilestonesCollection.updateOne(...args);
	}
};
