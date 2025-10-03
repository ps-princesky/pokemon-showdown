/**
 * TCG Economy Module
 * Handles all currency operations for the TCG plugin.
 */

import { MongoDB } from '../../impulse/mongodb_module';
import { UserCollection } from './tcg_data';
import { UserCollections } from './tcg_collections';

/**
 * Gets the currency balance for a specific user.
 */
export async function getUserBalance(userId: string): Promise<number> {
	const collection = await UserCollections.findOne({ userId });
	return collection?.currency || 0;
}

/**
 * Grants a specified amount of currency to a user.
 */
export async function grantCurrency(userId: string, amount: number): Promise<boolean> {
	if (amount <= 0) return false;
	await UserCollections.updateOne(
		{ userId },
		{ $inc: { currency: amount } },
		{ upsert: true }
	);
	// Assume success if no error is thrown, to correctly handle upserts.
	return true;
}

/**
 * Deducts a specified amount of currency from a user.
 */
export async function deductCurrency(userId: string, amount: number): Promise<boolean> {
	if (amount <= 0) return false;
	const result = await UserCollections.updateOne(
		{ userId, currency: { $gte: amount } },
		{ $inc: { currency: -amount } }
	);
	return result > 0;
}

/**
 * Sets a user's currency balance to a specific amount. (Admin)
 */
export async function setCurrency(userId: string, amount: number): Promise<boolean> {
	if (amount < 0) return false;
	await UserCollections.updateOne(
		{ userId },
		{ $set: { currency: amount } },
		{ upsert: true }
	);
	// Assume success if no error is thrown, to correctly handle upserts.
	return true;
}

/**
 * Transfers currency from one user to another.
 */
export async function transferCurrency(fromUserId: string, toUserId: string, amount: number): Promise<boolean> {
	if (amount <= 0) return false;
	
	const didDeduct = await deductCurrency(fromUserId, amount);

	if (didDeduct) {
		await grantCurrency(toUserId, amount);
		return true;
	} else {
		return false;
	}
}
