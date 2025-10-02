/*
* Pokemon Showdown
* PSGO Card Collection System
* Instructions:
* Enhanced Pokemon TCG card collection system with MongoDB integration
*/

import { MongoDB } from '../../impulse/mongodb_module';

const DEFAULT_SORT = 'rarity';
const PAGE_SIZE = 50;

// MongoDB Document Interfaces
interface Attack {
  name: string;
  cost: string[];
  convertedEnergyCost: number;
  damage: string;
  text: string;
}

interface Ability {
  name: string;
  text: string;
  type: string;
}

interface TypeEffectiveness {
  type: string;
  value: string;
}

interface SetInfo {
  id: string;
  name: string;
  series: string;
  printedTotal: number;
  total: number;
  legalities: {
    unlimited?: string;
    standard?: string;
    expanded?: string;
  };
  ptcgoCode?: string;
  releaseDate: string;
  updatedAt: string;
  images: {
    symbol: string;
    logo: string;
  };
}

interface MarketData {
  url: string;
  updatedAt: string;
  prices?: {
    holofoil?: {
      low?: number;
      mid?: number;
      high?: number;
      market?: number;
    };
    normal?: {
      low?: number;
      mid?: number;
      high?: number;
      market?: number;
    };
  };
}

interface EnhancedCardDocument {
  _id: string; // card id
  name: string;
  supertype: 'Pokémon' | 'Trainer' | 'Energy';
  subtypes: string[];
  hp?: number;
  types?: string[];
  evolvesFrom?: string;
  evolvesTo?: string[];
  attacks?: Attack[];
  abilities?: Ability[];
  weaknesses?: TypeEffectiveness[];
  resistances?: TypeEffectiveness[];
  retreatCost?: string[];
  set: SetInfo;
  number: string;
  rarity: string;
  artist?: string;
  flavorText?: string;
  nationalPokedexNumbers?: number[];
  images: {
    small: string;
    large: string;
  };
  tcgplayer?: MarketData;
  cardmarket?: MarketData;
  customPoints: number;
  customRarity: string;
  isEnabled: boolean;
  dateAdded: Date;
}

interface UserCardDocument {
  _id: string; // composite: userid_cardid
  userId: string;
  cardId: string;
  quantity: number;
  dateObtained: Date;
  tradeable: boolean;
}

interface UserProfileDocument {
  _id: string; // userid
  username: string;
  totalPoints: number;
  totalCards: number;
  uniqueCards: number;
  favoriteType?: string;
  allowTrades: boolean;
  sortPreference: 'rarity' | 'name' | 'date' | 'points' | 'hp' | 'type';
  lastActive: Date;
  achievements: string[];
  setsCompleted: string[];
  collectionStats: {
    byType: Record<string, number>;
    byRarity: Record<string, number>;
    bySupertype: Record<string, number>;
    bySet: Record<string, number>;
    averageHP: number;
    totalMarketValue: number;
  };
}

// Get typed MongoDB collections
const CardsDB = MongoDB<EnhancedCardDocument>('psgo_cards_enhanced');
const UserCardsDB = MongoDB<UserCardDocument>('psgo_user_cards_enhanced');
const UserProfilesDB = MongoDB<UserProfileDocument>('psgo_user_profiles_enhanced');

export class PSGOSystem {
  private static readonly CUSTOM_RARITIES: Record<string, number> = {
    'Common': 1, 'Uncommon': 2, 'Rare': 3, 'Rare Holo': 4, 'Rare Holo EX': 5,
    'Rare Holo GX': 6, 'Rare Holo V': 7, 'Rare Holo VMAX': 8, 'Rare Holo VSTAR': 9,
    'Rare Ultra': 10, 'Rare Secret': 11, 'Rare Rainbow': 12, 'Rare Gold': 13,
    'Promo': 14, 'Rare Prism Star': 15, 'Rare Shining': 16, 'Rare Crystal': 17,
    'Rare e-Card': 18, 'Rare Delta Species': 19, 'Rare LV.X': 20, 'Rare Prime': 21,
    'Rare LEGEND': 22, 'Rare BREAK': 23, 'Rare Team Plasma': 24, 'Rare Radiant': 25,
    'Amazing Rare': 26, 'Classic': 27, 'Illustration Rare': 28, 'Special Illustration Rare': 29,
    'Hyper Rare': 30, 'Ultra Rare': 31, 'Crown Rare': 32
  };

  private static getTypeColor(type?: string): string {
    const colors: Record<string, string> = {
      'Fire': '#FF6B6B', 'Water': '#4ECDC4', 'Grass': '#95E1D3',
      'Electric': '#F8E71C', 'Psychic': '#E056FD', 'Fighting': '#8B4513',
      'Dark': '#2C2C2C', 'Metal': '#A8A8A8', 'Fairy': '#FFB3E6',
      'Dragon': '#7038F8', 'Colorless': '#BBBBBB'
    };
    return colors[type || ''] || '#CCCCCC';
  }

  private static calculateCustomPoints(rarity: string): number {
    const rarityMap: Record<string, number> = {
      'Common': 1, 'Uncommon': 2, 'Rare': 3,
      'Rare Holo': 4, 'Rare Holo EX': 5, 'Rare Holo GX': 6,
      'Rare Holo V': 7, 'Rare Holo VMAX': 8, 'Rare Holo VSTAR': 9,
      'Rare Ultra': 10, 'Rare Secret': 11, 'Rare Rainbow': 12,
      'Amazing Rare': 26, 'Illustration Rare': 28,
      'Special Illustration Rare': 29, 'Hyper Rare': 30
    };
    return rarityMap[rarity] || 1;
  }

  private static mapToCustomRarity(rarity: string): string {
    const rarityMap: Record<string, string> = {
      'Common': 'Common', 'Uncommon': 'Uncommon', 'Rare': 'Rare',
      'Rare Holo': 'Rare Holo', 'Rare Holo EX': 'Rare Holo EX',
    };
    return rarityMap[rarity] || rarity;
  }

  static async updateUserProfile(userId: string, username: string): Promise<void> {
    const id = toID(userId);
    
    // Get all user cards with card data
    const userCards = await UserCardsDB.find({ userId: id });
    
    if (!userCards.length) {
      await UserProfilesDB.upsert(
        { _id: id },
        {
          username,
          totalCards: 0,
          uniqueCards: 0,
          totalPoints: 0,
          lastActive: new Date(),
          collectionStats: {
            byType: {},
            byRarity: {},
            bySupertype: {},
            bySet: {},
            averageHP: 0,
            totalMarketValue: 0
          },
          allowTrades: true,
          sortPreference: DEFAULT_SORT as any,
          achievements: [],
          setsCompleted: []
        }
      );
      return;
    }

    // Get all card details
    const cardIds = userCards.map(uc => uc.cardId);
    const cards = await CardsDB.find({ _id: { $in: cardIds } });
    const cardMap = new Map(cards.map(c => [c._id, c]));

    // Calculate stats
    let totalCards = 0;
    let totalPoints = 0;
    let totalMarketValue = 0;
    let hpSum = 0;
    let hpCount = 0;
    const byType: Record<string, number> = {};
    const byRarity: Record<string, number> = {};
    const bySupertype: Record<string, number> = {};
    const bySet: Record<string, number> = {};

    for (const userCard of userCards) {
      const card = cardMap.get(userCard.cardId);
      if (!card) continue;

      totalCards += userCard.quantity;
      totalPoints += userCard.quantity * card.customPoints;

      if (card.types) {
        for (const type of card.types) {
          byType[type] = (byType[type] || 0) + userCard.quantity;
        }
      }

      byRarity[card.customRarity] = (byRarity[card.customRarity] || 0) + userCard.quantity;
      bySupertype[card.supertype] = (bySupertype[card.supertype] || 0) + userCard.quantity;
      bySet[card.set.name] = (bySet[card.set.name] || 0) + userCard.quantity;

      if (card.hp) {
        hpSum += card.hp * userCard.quantity;
        hpCount += userCard.quantity;
      }

      const marketPrice = card.tcgplayer?.prices?.normal?.market || 0;
      totalMarketValue += marketPrice * userCard.quantity;
    }

    await UserProfilesDB.upsert(
      { _id: id },
      {
        username,
        totalCards,
        uniqueCards: userCards.length,
        totalPoints,
        lastActive: new Date(),
        collectionStats: {
          byType,
          byRarity,
          bySupertype,
          bySet,
          averageHP: hpCount > 0 ? hpSum / hpCount : 0,
          totalMarketValue
        },
        allowTrades: true,
        sortPreference: DEFAULT_SORT as any,
        achievements: [],
        setsCompleted: []
      }
    );
  }

  static async giveCard(userId: string, username: string, cardId: string, quantity: number = 1): Promise<void> {
    const id = toID(userId);
    
    // Verify card exists
    const card = await CardsDB.findOne({ _id: cardId, isEnabled: true });
    if (!card) throw new Error('Card not found or disabled');

    const compositeId = `${id}_${cardId}`;
    
    // Upsert user card
    await UserCardsDB.upsert(
      { _id: compositeId },
      {
        userId: id,
        cardId,
        quantity,
        dateObtained: new Date(),
        tradeable: true
      }
    );

    // Update user profile
    await this.updateUserProfile(id, username);
  }

  static async removeCard(userId: string, username: string, cardId: string, quantity: number = 1): Promise<boolean> {
    const id = toID(userId);
    const compositeId = `${id}_${cardId}`;
    
    const userCard = await UserCardsDB.findById(compositeId);
    if (!userCard || userCard.quantity < quantity) return false;

    if (userCard.quantity === quantity) {
      await UserCardsDB.deleteById(compositeId);
    } else {
      await UserCardsDB.updateOne(
        { _id: compositeId },
        { $inc: { quantity: -quantity } }
      );
    }

    await this.updateUserProfile(id, username);
    return true;
  }

  static async tradeCards(
    fromUserId: string, toUserId: string,
    fromUsername: string, toUsername: string,
    cardId: string, quantity: number
  ): Promise<{success: boolean; message: string}> {
    const fromId = toID(fromUserId);
    const toId = toID(toUserId);

    const [fromProfile, toProfile] = await Promise.all([
      UserProfilesDB.findById(fromId),
      UserProfilesDB.findById(toId)
    ]);

    if (!fromProfile?.allowTrades || !toProfile?.allowTrades) {
      return {success: false, message: 'One or both users have trades disabled.'};
    }

    const fromCompositeId = `${fromId}_${cardId}`;
    const toCompositeId = `${toId}_${cardId}`;

    const [fromCard, cardData] = await Promise.all([
      UserCardsDB.findById(fromCompositeId),
      CardsDB.findById(cardId)
    ]);

    if (!fromCard || fromCard.quantity < quantity) {
      return {success: false, message: 'Insufficient cards to trade.'};
    }

    if (!fromCard.tradeable) {
      return {success: false, message: 'This card is not tradeable.'};
    }

    // Remove from sender
    if (fromCard.quantity === quantity) {
      await UserCardsDB.deleteById(fromCompositeId);
    } else {
      await UserCardsDB.updateOne(
        { _id: fromCompositeId },
        { $inc: { quantity: -quantity } }
      );
    }

    // Add to receiver
    const toCard = await UserCardsDB.findById(toCompositeId);
    if (toCard) {
      await UserCardsDB.updateOne(
        { _id: toCompositeId },
        { $inc: { quantity } }
      );
    } else {
      await UserCardsDB.insert({
        _id: toCompositeId,
        userId: toId,
        cardId,
        quantity,
        dateObtained: new Date(),
        tradeable: true
      });
    }

    await Promise.all([
      this.updateUserProfile(fromId, fromUsername),
      this.updateUserProfile(toId, toUsername)
    ]);

    return {
      success: true,
      message: `Successfully traded ${quantity} ${cardData?.name || cardId} card(s).`
    };
  }

  static async getUserCollection(
    userId: string,
    page: number = 1,
    pageSize: number = PAGE_SIZE,
    sortBy: 'rarity' | 'name' | 'date' | 'points' | 'hp' | 'type' = DEFAULT_SORT as any
  ): Promise<{cards: any[]; total: number; hasMore: boolean; profile: UserProfileDocument | null}> {
    const id = toID(userId);
    const skip = (page - 1) * pageSize;

    const profile = await UserProfilesDB.findById(id);
    const userCards = await UserCardsDB.find({ userId: id });

    if (!userCards.length) {
      return { cards: [], total: 0, hasMore: false, profile };
    }

    const cardIds = userCards.map(uc => uc.cardId);
    const cards = await CardsDB.find({ _id: { $in: cardIds }, isEnabled: true });
    const cardMap = new Map(cards.map(c => [c._id, c]));

    const enrichedCards = userCards
      .map(uc => ({
        ...uc,
        cardData: cardMap.get(uc.cardId)
      }))
      .filter(c => c.cardData);

    // Sort cards
    enrichedCards.sort((a, b) => {
      const cardA = a.cardData!;
      const cardB = b.cardData!;

      switch (sortBy) {
        case 'name':
          return cardA.name.localeCompare(cardB.name);
        case 'date':
          return b.dateObtained.getTime() - a.dateObtained.getTime();
        case 'points':
          return cardB.customPoints - cardA.customPoints || b.quantity - a.quantity;
        case 'hp':
          return (cardB.hp || 0) - (cardA.hp || 0) || cardA.name.localeCompare(cardB.name);
        case 'type':
          return (cardA.types?.[0] || '').localeCompare(cardB.types?.[0] || '') || cardA.name.localeCompare(cardB.name);
        default: // rarity
          return cardB.customPoints - cardA.customPoints || cardA.name.localeCompare(cardB.name);
      }
    });

    const paginatedCards = enrichedCards.slice(skip, skip + pageSize);
    const total = enrichedCards.length;

    return {
      cards: paginatedCards,
      total,
      hasMore: skip + pageSize < total,
      profile
    };
  }

  static async searchCards(
    query: string,
    page: number = 1,
    pageSize: number = PAGE_SIZE
  ): Promise<{cards: EnhancedCardDocument[]; total: number; hasMore: boolean}> {
    const skip = (page - 1) * pageSize;
    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const matchConditions = {
      isEnabled: true,
      $or: [
        { name: { $regex: regex } },
        { _id: { $regex: regex } },
        { 'set.name': { $regex: regex } },
        { artist: { $regex: regex } }
      ]
    };

    const [cards, total] = await Promise.all([
      CardsDB.find(matchConditions, { skip, limit: pageSize }),
      CardsDB.count(matchConditions)
    ]);

    return {
      cards,
      total,
      hasMore: skip + pageSize < total
    };
  }

  static async bulkAddCards(cards: any[]): Promise<void> {
    const operations = cards.map(card => ({
      _id: card.id,
      ...card,
      customPoints: this.calculateCustomPoints(card.rarity),
      customRarity: this.mapToCustomRarity(card.rarity),
      isEnabled: true,
      dateAdded: new Date()
    }));

    for (const card of operations) {
      await CardsDB.upsert({ _id: card._id }, card);
    }
  }

  static async getLeaderboard(
    limit: number = 10,
    category: 'points' | 'cards' | 'unique' | 'sets' = 'points'
  ): Promise<UserProfileDocument[]> {
    const sortField = category === 'points' ? 'totalPoints' :
                     category === 'cards' ? 'totalCards' :
                     category === 'unique' ? 'uniqueCards' : 'setsCompleted';

    return await UserProfilesDB.findSorted({}, { [sortField]: -1 }, limit);
  }

  static async checkSetCompletion(userId: string): Promise<string[]> {
    const id = toID(userId);
    const userCards = await UserCardsDB.find({ userId: id });
    
    if (!userCards.length) return [];

    const cardIds = userCards.map(uc => uc.cardId);
    const cards = await CardsDB.find({ _id: { $in: cardIds } });

    const setMap = new Map<string, { owned: number; total: number; name: string }>();
    
    for (const card of cards) {
      const setId = card.set.id;
      if (!setMap.has(setId)) {
        setMap.set(setId, { owned: 0, total: card.set.total, name: card.set.name });
      }
      setMap.get(setId)!.owned++;
    }

    const completedSets: string[] = [];
    for (const [setId, data] of setMap.entries()) {
      if (data.owned === data.total) {
        completedSets.push(setId);
      }
    }

    return completedSets;
  }

  static async getGlobalStats(): Promise<any> {
    const profiles = await UserProfilesDB.find({});
    
    if (!profiles.length) {
      return { totalUsers: 0, totalCards: 0, totalPoints: 0, avgPointsPerUser: 0 };
    }

    const totalUsers = profiles.length;
    const totalCards = profiles.reduce((sum, p) => sum + p.totalCards, 0);
    const totalPoints = profiles.reduce((sum, p) => sum + p.totalPoints, 0);
    const avgPointsPerUser = totalPoints / totalUsers;

    return { totalUsers, totalCards, totalPoints, avgPointsPerUser };
  }
}

Impulse.PSGOSystem = PSGOSystem;

async function showCollection(context: any, user: User, args: string[]): Promise<void> {
  const page = parseInt(args[0]) || 1;
  const sortBy = (args[1] as any) || DEFAULT_SORT;

  try {
    const { cards, total, hasMore, profile } = await PSGOSystem.getUserCollection(
      user.id, page, PAGE_SIZE, sortBy
    );

    if (!cards.length) {
      return context.sendReply(`You don't have any cards yet!`);
    }

    let html = `<div class="ladder">` +
      `<h3>${Impulse.nameColor(user.name, true, true)}'s Collection</h3>` +
      `<p><strong>Total:</strong> ${total} cards | <strong>Points:</strong> ${profile?.totalPoints || 0} | <strong>Unique:</strong> ${profile?.uniqueCards || 0}</p>`;

    for (const card of cards) {
      const { cardData, quantity } = card;
      html += `<div class="card-item" style="border-left: 4px solid ${PSGOSystem['getTypeColor'](cardData.types?.[0])}">` +
        `<div style="display: flex; justify-content: space-between;">` +
        `<div>` +
        `<strong>${cardData.name}</strong> ${cardData.hp ? `(${cardData.hp} HP)` : ''} ` +
        `<small>[${cardData.supertype}]</small>` +
        `<br><small>${cardData.set.name} #${cardData.number} - ${cardData.customRarity}</small>` +
        `</div>` +
        `<div style="text-align: right;">` +
        `<strong>×${quantity}</strong>` +
        `<br><small>${cardData.customPoints}pts each</small>` +
        `</div>` +
        `</div>` +
        `</div>`;
    }

    if (hasMore) {
      html += `<p><button name="send" value="/psgo collection ${page + 1} ${sortBy}">Next Page</button></p>`;
    }

    html += `</div>`;
    return context.sendReplyBox(html);

  } catch (error) {
    return context.sendReply(`Error loading collection. Please try again.`);
  }
}

async function viewCard(context: any, cardId: string): Promise<void> {
  if (!cardId) return context.sendReply(`Please specify a card ID.`);

  try {
    const card = await CardsDB.findOne({ _id: cardId, isEnabled: true });
    if (!card) return context.sendReply(`Card not found.`);

    let html = `<div class="card-details" style="max-width: 600px;">` +
      `<h3>${card.name} ${card.hp ? `- ${card.hp} HP` : ''}</h3>` +
      `<div style="display: flex; gap: 20px;">` +
      `<div style="flex: 1;">` +
      `<img src="${card.images.large}" alt="${card.name}" style="max-width: 200px; height: auto;">` +
      `</div>` +
      `<div style="flex: 2;">` +
      `<p><strong>Supertype:</strong> ${card.supertype}</p>` +
      `<p><strong>Subtypes:</strong> ${card.subtypes.join(', ')}</p>` +
      (card.types ? `<p><strong>Types:</strong> ${card.types.join(', ')}</p>` : '') +
      (card.evolvesFrom ? `<p><strong>Evolves From:</strong> ${card.evolvesFrom}</p>` : '') +
      `<p><strong>Set:</strong> ${card.set.name} (${card.set.id})</p>` +
      `<p><strong>Card Number:</strong> ${card.number}/${card.set.total}</p>` +
      `<p><strong>Rarity:</strong> ${card.rarity}</p>` +
      `<p><strong>Artist:</strong> ${card.artist}</p>` +
      `<p><strong>Custom Points:</strong> ${card.customPoints}</p>` +
      `</div>` +
      `</div>`;

    if (card.abilities?.length) {
      html += `<h4>Abilities</h4>`;
      for (const ability of card.abilities) {
        html += `<div><strong>${ability.name}</strong> (${ability.type}): ${ability.text}</div>`;
      }
    }

    if (card.attacks?.length) {
      html += `<h4>Attacks</h4>`;
      for (const attack of card.attacks) {
        html += `<div><strong>${attack.name}</strong> ${attack.cost.join('')} - ${attack.damage}<br><small>${attack.text}</small></div>`;
      }
    }

    html += `</div>`;
    return context.sendReplyBox(html);

  } catch (error) {
    return context.sendReply(`Error loading card details.`);
  }
}

async function tradeCard(context: any, user: User, args: string[]): Promise<void> {
  const [targetUser, cardId, quantityStr] = args;
  const quantity = parseInt(quantityStr) || 1;

  if (!targetUser || !cardId) {
    return context.sendReply(`Usage: /psgo trade [user], [cardId], [quantity]`);
  }

  const target = Users.get(targetUser);
  if (!target) {
    return context.sendReply(`User not found.`);
  }

  try {
    const result = await PSGOSystem.tradeCards(
      user.id, target.id,
      user.name, target.name,
      cardId, quantity
    );

    context.sendReply(result.message);
    if (result.success) {
      target.sendTo(
        context.room,
        `|pm|${user.getIdentity()}|${target.getIdentity()}|You received ${quantity} ${cardId} card(s) from ${Impulse.nameColor(user.name, true, true)}!`
      );
    }
  } catch (error) {
    return context.sendReply(`Trade failed. Please try again.`);
  }
}

async function searchCards(context: any, user: User, args: string[]): Promise<void> {
  const query = args.join(' ');
  if (!query) return context.sendReply(`Please specify a search query.`);

  try {
    const { cards, total, hasMore } = await PSGOSystem.searchCards(query, 1, 10);

    if (!cards.length) {
      return context.sendReply(`No cards found matching "${query}".`);
    }

    let html = `<div class="ladder">` +
      `<h3>Search Results for "${query}" (${total} found)</h3>`;

    for (const card of cards) {
      html += `<div class="card-item" style="border-left: 4px solid ${PSGOSystem['getTypeColor'](card.types?.[0])}">` +
        `<div style="display: flex; justify-content: space-between;">` +
        `<div>` +
        `<strong>${card.name}</strong> ${card.hp ? `(${card.hp} HP)` : ''} ` +
        `<small>[${card.supertype}]</small>` +
        `<br><small>${card.set.name} #${card.number} - ${card.rarity}</small>` +
        `</div>` +
        `<div style="text-align: right;">` +
        `<small>${card.customPoints} pts</small>` +
        `<br><button name="send" value="/psgo view ${card._id}">View</button>` +
        `</div>` +
        `</div>` +
        `</div>`;
    }

    if (hasMore) {
      html += `<p>Showing first 10 results. Use more specific search terms to narrow results.</p>`;
    }

    html += `</div>`;
    return context.sendReplyBox(html);

  } catch (error) {
    return context.sendReply(`Search failed. Please try again.`);
  }
}

async function showLeaderboard(context: any, category: string = 'points'): Promise<void> {
  try {
    const validCategories = ['points', 'cards', 'unique', 'sets'];
    const leaderboardCategory = validCategories.includes(category) ? category as any : 'points';

    const leaders = await PSGOSystem.getLeaderboard(10, leaderboardCategory);

    if (!leaders.length) {
      return context.sendReply(`No users found on the leaderboard.`);
    }

    const categoryName: Record<string, string> = {
      'points': 'Total Points',
      'cards': 'Total Cards',
      'unique': 'Unique Cards',
      'sets': 'Sets Completed'
    };

    const tableData = leaders.map((leader, index) => {
      const value = leaderboardCategory === 'points' ? leader.totalPoints :
                    leaderboardCategory === 'cards' ? leader.totalCards :
                    leaderboardCategory === 'unique' ? leader.uniqueCards :
                    leader.setsCompleted.length;

      return [
        `#${index + 1}`,
        Impulse.nameColor(leader.username, true, true),
        `${value}`
      ];
    });

    const html = Impulse.generateThemedTable(
      `PSGO Leaderboard - ${categoryName[leaderboardCategory]}`,
      ['Rank', 'User', categoryName[leaderboardCategory]],
      tableData
    );

    return context.sendReplyBox(html);

  } catch (error) {
    return context.sendReply(`Error loading leaderboard. Please try again.`);
  }
}

async function showSets(context: any, user: User): Promise<void> {
  try {
    const completedSets = await PSGOSystem.checkSetCompletion(user.id);

    let html = `<div class="ladder">` +
      `<h3>${Impulse.nameColor(user.name, true, true)}'s Completed Sets</h3>`;

    if (!completedSets.length) {
      html += `<p>You haven't completed any sets yet. Keep collecting!</p>`;
    } else {
      completedSets.forEach(setId => {
        html += `<div class="set-item">` +
          `<strong>✓ Set: ${setId}</strong> - Complete!` +
          `</div>`;
      });
    }

    html += `</div>`;
    return context.sendReplyBox(html);

  } catch (error) {
    return context.sendReply(`Error loading completed sets. Please try again.`);
  }
}

export const pages: Chat.PageTable = {
  async psgoladder(args, user) {
    const category = args[0] || 'points';
    const validCategories = ['points', 'cards', 'unique', 'sets'];
    const leaderboardCategory = validCategories.includes(category) ? category as any : 'points';

    const leaders = await PSGOSystem.getLeaderboard(100, leaderboardCategory);
    if (!leaders.length) {
      return `<div class="pad"><h2>No users have any cards yet.</h2></div>`;
    }

    const categoryName: Record<string, string> = {
      'points': 'Total Points',
      'cards': 'Total Cards',
      'unique': 'Unique Cards',
      'sets': 'Sets Completed'
    };

    const data = leaders.map((leader, index) => {
      const value = leaderboardCategory === 'points' ? leader.totalPoints :
                    leaderboardCategory === 'cards' ? leader.totalCards :
                    leaderboardCategory === 'unique' ? leader.uniqueCards :
                    leader.setsCompleted.length;

      return [
        (index + 1).toString(),
        Impulse.nameColor(leader.username, true, true),
        value.toString()
      ];
    });

    const output = Impulse.generateThemedTable(
      `PSGO Leaderboard - ${categoryName[leaderboardCategory]}`,
      ['Rank', 'User', categoryName[leaderboardCategory]],
      data
    );

    return `${output}`;
  },
};

export const commands: Chat.ChatCommands = {
  cards: 'psgo',
  psgo: {
    '': 'help',
    async collection(target, room, user) {
      const args = target.split(' ');
      return showCollection(this, user, args);
    },
    c: 'collection',

    async view(target, room, user) {
      return viewCard(this, target.trim());
    },
    v: 'view',

    async trade(target, room, user) {
      const args = target.split(',').map(a => a.trim());
      return tradeCard(this, user, args);
    },
    t: 'trade',

    async search(target, room, user) {
      const args = target.split(' ');
      return searchCards(this, user, args);
    },
    s: 'search',

    async leaderboard(target, room, user) {
      if (!this.runBroadcast()) return;
      return this.parse(`/join view-psgoladder-${target || 'points'}`);
    },
    lb: 'leaderboard',

    async sets(target, room, user) {
      return showSets(this, user);
    },

    async give(target, room, user) {
      this.checkCan('ban');
      if (!target) return this.sendReply(`Usage: /psgo give [user], [cardId], [quantity]`);

      const parts = target.split(',').map(p => p.trim());
      if (parts.length < 2) return this.sendReply(`Usage: /psgo give [user], [cardId], [quantity]`);

      const [targetUser, cardId, quantityStr] = parts;
      const quantity = parseInt(quantityStr) || 1;

      if (isNaN(quantity) || quantity <= 0) {
        return this.errorReply(`Please specify a valid positive quantity.`);
      }

      const target_user = Users.get(targetUser);
      if (!target_user) {
        return this.errorReply(`User "${targetUser}" not found.`);
      }

      try {
        await PSGOSystem.giveCard(target_user.id, target_user.name, cardId, quantity);
        this.sendReplyBox(
          `${Impulse.nameColor(user.name, true, true)} gave ${quantity} ${cardId} card(s) to ${Impulse.nameColor(target_user.name, true, true)}.`
        );
        this.modlog('PSGOGIVE', target_user, `${quantity} ${cardId} card(s)`, { by: user.id });

        if (target_user.connected) {
          target_user.popup(
            `|html|You received <b>${quantity} ${cardId}</b> card(s) from <b>${Impulse.nameColor(user.name, true, true)}</b>.`
          );
        }
      } catch (error) {
        this.sendReply(`Failed to give card. Please check the card ID exists.`);
      }
    },

    async take(target, room, user) {
      this.checkCan('ban');
      if (!target) return this.sendReply(`Usage: /psgo take [user], [cardId], [quantity]`);

      const parts = target.split(',').map(p => p.trim());
      if (parts.length < 2) return this.sendReply(`Usage: /psgo take [user], [cardId], [quantity]`);

      const [targetUser, cardId, quantityStr] = parts;
      const quantity = parseInt(quantityStr) || 1;

      if (isNaN(quantity) || quantity <= 0) {
        return this.errorReply(`Please specify a valid positive quantity.`);
      }

      const target_user = Users.get(targetUser);
      if (!target_user) {
        return this.errorReply(`User "${targetUser}" not found.`);
      }

      try {
        const success = await PSGOSystem.removeCard(target_user.id, target_user.name, cardId, quantity);
        if (success) {
          this.sendReplyBox(
            `${Impulse.nameColor(user.name, true, true)} took ${quantity} ${cardId} card(s) from ${Impulse.nameColor(target_user.name, true, true)}.`
          );
          this.modlog('PSGOTAKE', target_user, `${quantity} ${cardId} card(s)`, { by: user.id });

          if (target_user.connected) {
            target_user.popup(
              `|html|<b>${Impulse.nameColor(user.name, true, true)}</b> took <b>${quantity} ${cardId}</b> card(s) from you.`
            );
          }
        } else {
          this.sendReply(`Failed to take card. User doesn't have enough cards.`);
        }
      } catch (error) {
        this.sendReply(`Failed to take card. Please try again.`);
      }
    },

    async add(target, room, user) {
      this.checkCan('ban');
      return this.sendReply(`Card addition feature coming soon. Use bulk import instead.`);
    },

    async delete(target, room, user) {
      this.checkCan('ban');
      const cardId = target.trim();
      if (!cardId) return this.sendReply(`Please specify a card ID to delete.`);

      try {
        await CardsDB.updateOne(
          { _id: cardId },
          { $set: { isEnabled: false } }
        );
        this.sendReply(`Card ${cardId} has been disabled.`);
        this.modlog('PSGODELETECARD', null, cardId, { by: user.id });
      } catch (error) {
        this.sendReply(`Failed to delete card.`);
      }
    },

    async stats(target, room, user) {
      if (!this.runBroadcast()) return;

      try {
        const stats = await PSGOSystem.getGlobalStats();
        this.sendReplyBox(
          `<div class="ladder">` +
          `<h3>PSGO Global Statistics</h3>` +
          `<p><strong>Total Users:</strong> ${stats.totalUsers}</p>` +
          `<p><strong>Total Cards:</strong> ${stats.totalCards}</p>` +
          `<p><strong>Total Points:</strong> ${stats.totalPoints}</p>` +
          `<p><strong>Average Points per User:</strong> ${Math.round(stats.avgPointsPerUser)}</p>` +
          `</div>`
        );
      } catch (error) {
        return this.sendReply(`Error loading global statistics.`);
      }
    },

    async help(target, room, user) {
      if (!this.runBroadcast()) return;
      this.sendReplyBox(
        `<div><b><center>PSGO Card Collection System By ${Impulse.nameColor('Prince Sky', true, false)}</center></b><br>` +
        `<ul>` +
        `<li><code>/psgo collection [page] [sort]</code> (Or <code>/psgo c</code>) - View your card collection</li>` +
        `<li><code>/psgo view [cardId]</code> (Or <code>/psgo v</code>) - View detailed information about a specific card</li>` +
        `<li><code>/psgo trade [user], [cardId], [quantity]</code> (Or <code>/psgo t</code>) - Trade cards with another user</li>` +
        `<li><code>/psgo search [query]</code> (Or <code>/psgo s</code>) - Search for cards by name, set, or artist</li>` +
        `<li><code>/psgo leaderboard [category]</code> (Or <code>/psgo lb</code>) - View the leaderboard (categories: points, cards, unique, sets)</li>` +
        `<li><code>/psgo sets</code> - View your completed sets</li>` +
        `<li><code>/psgo stats</code> - View global PSGO statistics</li>` +
        `<li><code>/psgo give [user], [cardId], [quantity]</code> - Give cards to a user</li>` +
        `<li><code>/psgo take [user], [cardId], [quantity]</code> - Take cards from a user</li>` +
        `<li><code>/psgo delete [cardId]</code> - Disable a card</li>` +
        `</ul>` +
        `<small>Sort options: rarity, name, date, points, hp, type</small><br>` +
        `<small>Commands give, take, and delete require @ or higher permission.</small>` +
        `</div>`
      );
    },
  },
};
