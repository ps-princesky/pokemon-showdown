/**
 * TCG Collections Module
 * Central definition of all MongoDB collections used by the TCG plugin.
 */

import { MongoDB } from '../../impulse/mongodb_module';
import { TCGCard, UserCollection } from './tcg_data';

export const TCGCards = MongoDB<TCGCard>('tcg_cards');
export const UserCollections = MongoDB<UserCollection>('tcg_user_collections');
