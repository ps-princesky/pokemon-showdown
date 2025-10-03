export interface TCGSet {
	code: string;
	name: string;
	year: number;
	series: string;
}

export const POKEMON_SETS: TCGSet[] = [
	// Original Series (1999-2003)
	{ code: 'BS', name: 'Base Set', year: 1999, series: 'Original' },
	{ code: 'JU', name: 'Jungle', year: 1999, series: 'Original' },
	{ code: 'FO', name: 'Fossil', year: 1999, series: 'Original' },
	{ code: 'B2', name: 'Base Set 2', year: 2000, series: 'Original' },
	{ code: 'TR', name: 'Team Rocket', year: 2000, series: 'Original' },
	{ code: 'G1', name: 'Gym Heroes', year: 2000, series: 'Original' },
	{ code: 'G2', name: 'Gym Challenge', year: 2000, series: 'Original' },
	{ code: 'N1', name: 'Neo Genesis', year: 2000, series: 'Neo' },
	{ code: 'N2', name: 'Neo Discovery', year: 2001, series: 'Neo' },
	{ code: 'N3', name: 'Neo Revelation', year: 2001, series: 'Neo' },
	{ code: 'N4', name: 'Neo Destiny', year: 2002, series: 'Neo' },
	{ code: 'LC', name: 'Legendary Collection', year: 2002, series: 'Original' },
	
	// E-Card Series (2002-2003)
	{ code: 'EX', name: 'Expedition Base Set', year: 2002, series: 'E-Card' },
	{ code: 'AQ', name: 'Aquapolis', year: 2003, series: 'E-Card' },
	{ code: 'SK', name: 'Skyridge', year: 2003, series: 'E-Card' },
	
	// EX Series (2003-2007)
	{ code: 'RS', name: 'Ruby & Sapphire', year: 2003, series: 'EX' },
	{ code: 'SS', name: 'Sandstorm', year: 2003, series: 'EX' },
	{ code: 'DR', name: 'Dragon', year: 2003, series: 'EX' },
	{ code: 'MA', name: 'Team Magma vs Team Aqua', year: 2004, series: 'EX' },
	{ code: 'HL', name: 'Hidden Legends', year: 2004, series: 'EX' },
	{ code: 'RG', name: 'FireRed & LeafGreen', year: 2004, series: 'EX' },
	{ code: 'TRR', name: 'Team Rocket Returns', year: 2004, series: 'EX' },
	{ code: 'DX', name: 'Deoxys', year: 2005, series: 'EX' },
	{ code: 'EM', name: 'Emerald', year: 2005, series: 'EX' },
	{ code: 'UF', name: 'Unseen Forces', year: 2005, series: 'EX' },
	{ code: 'DS', name: 'Delta Species', year: 2005, series: 'EX' },
	{ code: 'LM', name: 'Legend Maker', year: 2006, series: 'EX' },
	{ code: 'HP', name: 'Holon Phantoms', year: 2006, series: 'EX' },
	{ code: 'CG', name: 'Crystal Guardians', year: 2006, series: 'EX' },
	{ code: 'DF', name: 'Dragon Frontiers', year: 2006, series: 'EX' },
	{ code: 'PK', name: 'Power Keepers', year: 2007, series: 'EX' },
	
	// Diamond & Pearl Series (2007-2009)
	{ code: 'DP', name: 'Diamond & Pearl', year: 2007, series: 'Diamond & Pearl' },
	{ code: 'MT', name: 'Mysterious Treasures', year: 2007, series: 'Diamond & Pearl' },
	{ code: 'SW', name: 'Secret Wonders', year: 2007, series: 'Diamond & Pearl' },
	{ code: 'GE', name: 'Great Encounters', year: 2008, series: 'Diamond & Pearl' },
	{ code: 'MD', name: 'Majestic Dawn', year: 2008, series: 'Diamond & Pearl' },
	{ code: 'LA', name: 'Legends Awakened', year: 2008, series: 'Diamond & Pearl' },
	{ code: 'SF', name: 'Stormfront', year: 2008, series: 'Diamond & Pearl' },
	{ code: 'PL', name: 'Platinum', year: 2009, series: 'Platinum' },
	{ code: 'RR', name: 'Rising Rivals', year: 2009, series: 'Platinum' },
	{ code: 'SV', name: 'Supreme Victors', year: 2009, series: 'Platinum' },
	{ code: 'AR', name: 'Arceus', year: 2009, series: 'Platinum' },
	
	// HeartGold & SoulSilver Series (2010-2011)
	{ code: 'HGSS', name: 'HeartGold & SoulSilver', year: 2010, series: 'HGSS' },
	{ code: 'UL', name: 'Unleashed', year: 2010, series: 'HGSS' },
	{ code: 'UD', name: 'Undaunted', year: 2010, series: 'HGSS' },
	{ code: 'TM', name: 'Triumphant', year: 2010, series: 'HGSS' },
	{ code: 'CL', name: 'Call of Legends', year: 2011, series: 'HGSS' },
	
	// Black & White Series (2011-2013)
	{ code: 'BLW', name: 'Black & White', year: 2011, series: 'Black & White' },
	{ code: 'EPO', name: 'Emerging Powers', year: 2011, series: 'Black & White' },
	{ code: 'NVI', name: 'Noble Victories', year: 2011, series: 'Black & White' },
	{ code: 'NXD', name: 'Next Destinies', year: 2012, series: 'Black & White' },
	{ code: 'DEX', name: 'Dark Explorers', year: 2012, series: 'Black & White' },
	{ code: 'DRX', name: 'Dragons Exalted', year: 2012, series: 'Black & White' },
	{ code: 'BCR', name: 'Boundaries Crossed', year: 2012, series: 'Black & White' },
	{ code: 'PLS', name: 'Plasma Storm', year: 2013, series: 'Black & White' },
	{ code: 'PLF', name: 'Plasma Freeze', year: 2013, series: 'Black & White' },
	{ code: 'PLB', name: 'Plasma Blast', year: 2013, series: 'Black & White' },
	{ code: 'LTR', name: 'Legendary Treasures', year: 2013, series: 'Black & White' },
	
	// XY Series (2014-2016)
	{ code: 'XY', name: 'XY Base Set', year: 2014, series: 'XY' },
	{ code: 'FLF', name: 'Flashfire', year: 2014, series: 'XY' },
	{ code: 'FFI', name: 'Furious Fists', year: 2014, series: 'XY' },
	{ code: 'PHF', name: 'Phantom Forces', year: 2014, series: 'XY' },
	{ code: 'PRC', name: 'Primal Clash', year: 2015, series: 'XY' },
	{ code: 'ROS', name: 'Roaring Skies', year: 2015, series: 'XY' },
	{ code: 'AOR', name: 'Ancient Origins', year: 2015, series: 'XY' },
	{ code: 'BKT', name: 'BREAKthrough', year: 2015, series: 'XY' },
	{ code: 'BKP', name: 'BREAKpoint', year: 2016, series: 'XY' },
	{ code: 'GEN', name: 'Generations', year: 2016, series: 'XY' },
	{ code: 'FCO', name: 'Fates Collide', year: 2016, series: 'XY' },
	{ code: 'STS', name: 'Steam Siege', year: 2016, series: 'XY' },
	{ code: 'EVO', name: 'Evolutions', year: 2016, series: 'XY' },
	
	// Sun & Moon Series (2017-2019)
	{ code: 'SM', name: 'Sun & Moon Base Set', year: 2017, series: 'Sun & Moon' },
	{ code: 'GRI', name: 'Guardians Rising', year: 2017, series: 'Sun & Moon' },
	{ code: 'BUS', name: 'Burning Shadows', year: 2017, series: 'Sun & Moon' },
	{ code: 'SLG', name: 'Shining Legends', year: 2017, series: 'Sun & Moon' },
	{ code: 'CIN', name: 'Crimson Invasion', year: 2017, series: 'Sun & Moon' },
	{ code: 'UPR', name: 'Ultra Prism', year: 2018, series: 'Sun & Moon' },
	{ code: 'FLI', name: 'Forbidden Light', year: 2018, series: 'Sun & Moon' },
	{ code: 'CES', name: 'Celestial Storm', year: 2018, series: 'Sun & Moon' },
	{ code: 'DRM', name: 'Dragon Majesty', year: 2018, series: 'Sun & Moon' },
	{ code: 'LOT', name: 'Lost Thunder', year: 2018, series: 'Sun & Moon' },
	{ code: 'TEM', name: 'Team Up', year: 2019, series: 'Sun & Moon' },
	{ code: 'DET', name: 'Detective Pikachu', year: 2019, series: 'Sun & Moon' },
	{ code: 'UNB', name: 'Unbroken Bonds', year: 2019, series: 'Sun & Moon' },
	{ code: 'UNM', name: 'Unified Minds', year: 2019, series: 'Sun & Moon' },
	{ code: 'HIF', name: 'Hidden Fates', year: 2019, series: 'Sun & Moon' },
	{ code: 'CEC', name: 'Cosmic Eclipse', year: 2019, series: 'Sun & Moon' },
	
	// Sword & Shield Series (2020-2022)
	{ code: 'SSH', name: 'Sword & Shield Base Set', year: 2020, series: 'Sword & Shield' },
	{ code: 'RCL', name: 'Rebel Clash', year: 2020, series: 'Sword & Shield' },
	{ code: 'DAA', name: 'Darkness Ablaze', year: 2020, series: 'Sword & Shield' },
	{ code: 'CPA', name: 'Champion\'s Path', year: 2020, series: 'Sword & Shield' },
	{ code: 'VIV', name: 'Vivid Voltage', year: 2020, series: 'Sword & Shield' },
	{ code: 'SHF', name: 'Shining Fates', year: 2021, series: 'Sword & Shield' },
	{ code: 'BST', name: 'Battle Styles', year: 2021, series: 'Sword & Shield' },
	{ code: 'CRE', name: 'Chilling Reign', year: 2021, series: 'Sword & Shield' },
	{ code: 'EVS', name: 'Evolving Skies', year: 2021, series: 'Sword & Shield' },
	{ code: 'CEL', name: 'Celebrations', year: 2021, series: 'Sword & Shield' },
	{ code: 'FST', name: 'Fusion Strike', year: 2021, series: 'Sword & Shield' },
	{ code: 'BRS', name: 'Brilliant Stars', year: 2022, series: 'Sword & Shield' },
	{ code: 'ASR', name: 'Astral Radiance', year: 2022, series: 'Sword & Shield' },
	{ code: 'PGO', name: 'Pokémon GO', year: 2022, series: 'Sword & Shield' },
	{ code: 'LOR', name: 'Lost Origin', year: 2022, series: 'Sword & Shield' },
	{ code: 'SIT', name: 'Silver Tempest', year: 2022, series: 'Sword & Shield' },
	{ code: 'CRZ', name: 'Crown Zenith', year: 2023, series: 'Sword & Shield' },
	
	// Scarlet & Violet Series (2023-Present)
	{ code: 'SVI', name: 'Scarlet & Violet Base Set', year: 2023, series: 'Scarlet & Violet' },
	{ code: 'PAL', name: 'Paldea Evolved', year: 2023, series: 'Scarlet & Violet' },
	{ code: 'OBF', name: 'Obsidian Flames', year: 2023, series: 'Scarlet & Violet' },
	{ code: 'MEW', name: '151', year: 2023, series: 'Scarlet & Violet' },
	{ code: 'PAR', name: 'Paradox Rift', year: 2023, series: 'Scarlet & Violet' },
	{ code: 'PAF', name: 'Paldean Fates', year: 2024, series: 'Scarlet & Violet' },
	{ code: 'TEF', name: 'Temporal Forces', year: 2024, series: 'Scarlet & Violet' },
	{ code: 'TWM', name: 'Twilight Masquerade', year: 2024, series: 'Scarlet & Violet' },
	{ code: 'SHR', name: 'Shrouded Fable', year: 2024, series: 'Scarlet & Violet' },
	{ code: 'SCR', name: 'Stellar Crown', year: 2024, series: 'Scarlet & Violet' },
	{ code: 'SSP', name: 'Surging Sparks', year: 2024, series: 'Scarlet & Violet' },
	{ code: 'PRE', name: 'Prismatic Evolutions', year: 2025, series: 'Scarlet & Violet' },
];
