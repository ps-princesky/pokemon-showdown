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
	BattleProgress
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

// Battle collection
export const BattleProgressCollection = getCollection<BattleProgress>('tcg_battle_progress');
