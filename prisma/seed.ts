import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Seeding database...');

  // ── Roles ────────────────────────────────────────────────────────────────
  const standardRole = await prisma.role.upsert({
    where: { name: 'standard' },
    update: {},
    create: { name: 'standard', description: 'Standard tier – basic indicators' },
  });
  
  const premiumRole = await prisma.role.upsert({
    where: { name: 'premium' },
    update: {},
    create: { name: 'premium', description: 'Premium tier – all indicators' },
  });
  
  const developerRole = await prisma.role.upsert({
    where: { name: 'developer' },
    update: {},
    create: { name: 'developer', description: 'Internal developer – log viewer access' },
  });

  console.log('Roles seeded.');

  // ── Markets ───────────────────────────────────────────────────────────────
  await prisma.market.upsert({
    where: { id: 'india' },
    update: {},
    create: { id: 'india', name: 'Indian Market', exchange: 'NSE/BSE' },
  });
  
  await prisma.market.upsert({
    where: { id: 'us' },
    update: {},
    create: { id: 'us', name: 'US Market', exchange: 'NYSE/NASDAQ' },
  });

  console.log('Markets seeded.');

  // ── NEW Indicators List ───────────────────────────────────────────────────
  const indicators = [
    { 
      id: 'bbands_20',
      name: 'Bollinger Bands', 
      category: 'Volatility', 
      description: 'Shows price volatility and potential reversal points using standard deviation bands',
      // chartable: true,
      scale: 'price' 
    },
    { 
      id: 'rsi_14', 
      name: 'RSI (14)', 
      category: 'Momentum', 
      description: 'Relative Strength Index - measures speed and magnitude of price changes (0-100)',
      // chartable: true,
      scale: 'oscillator' 
    },
    { 
      id: 'sma_20', 
      name: 'SMA (20)', 
      category: 'Trend', 
      description: 'Simple Moving Average - 20-day average price trend indicator',
      // chartable: true,
      scale: 'price'
    },
    { 
      id: 'sma_50', 
      name: 'SMA (50)', 
      category: 'Trend', 
      description: 'Simple Moving Average - 50-day medium-term trend indicator',
      // chartable: true,
      scale: 'price'
    },
    { 
      id: 'sma_200', 
      name: 'SMA (200)', 
      category: 'Trend', 
      description: 'Simple Moving Average - 200-day long-term trend indicator',
      // chartable: true,
      scale: 'price'
    },
    { 
      id: 'ema_20', 
      name: 'EMA (20)', 
      category: 'Trend', 
      description: 'Exponential Moving Average - 20-day weighted trend with more emphasis on recent prices',
      // chartable: true,
      scale: 'price'
    },
    { 
      id: 'ema_50', 
      name: 'EMA (50)', 
      category: 'Trend', 
      description: 'Exponential Moving Average - 50-day weighted medium-term trend',
      // chartable: true,
      scale: 'price'
    },
    { 
      id: 'wma_20', 
      name: 'WMA (20)', 
      category: 'Trend', 
      description: 'Weighted Moving Average - linear weighting emphasizing recent prices',
      // chartable: true,
      scale: 'price'
    },
    { 
      id: 'tema_30', 
      name: 'TEMA (30)', 
      category: 'Trend', 
      description: 'Triple Exponential Moving Average - reduces lag for faster trend detection',
      // chartable: true,
      scale: 'price'
    },
    { 
      id: 'kama_30', 
      name: 'KAMA (30)', 
      category: 'Trend', 
      description: 'Kaufman Adaptive Moving Average - adapts to market volatility automatically',
      // chartable: true,
      scale: 'price'
    },
    { 
      id: 'stoch_osc_14', 
      name: 'Stochastic Oscillator (Stochastic %K)', 
      category: 'Momentum', 
      description: 'Measures rate of price change to identify trend strength',
      // chartable: true,
      scale: 'oscillator'
    },
    { 
      id: 'cci_20', 
      name: 'CCI (20)', 
      category: 'Momentum', 
      description: 'Commodity Channel Index - identifies cyclical trends and overbought/oversold conditions',
      // chartable: true,
      scale: 'oscillator'
    },
    { 
      id: 'roc_10', 
      name: 'ROC (10)', 
      category: 'Momentum', 
      description: 'Rate of Change - percentage price change over 10 periods',
      // chartable: true,
      scale: 'oscillator'
    },
    { 
      id: 'mom_10', 
      name: 'Momentum (10)', 
      category: 'Momentum', 
      description: '10-day momentum indicator showing price velocity',
      // chartable: true,
      scale: 'oscillator'
    },
    { 
      id: 'willr_14', 
      name: 'Williams %R (14)', 
      category: 'Momentum', 
      description: 'Measures overbought/oversold levels on a scale of 0 to -100',
      // chartable: true,
      scale: 'oscillator'
    },
    { 
      id: 'ultosc_28', 
      name: 'Ultimate Oscillator', 
      category: 'Momentum', 
      description: 'Multi-timeframe momentum oscillator combining three time periods',
      // chartable: true,
      scale: 'oscillator'
    },
    { 
      id: 'atr_14', 
      name: 'ATR (14)', 
      category: 'Volatility', 
      description: 'Average True Range - measures market volatility over 14 periods',
      // chartable: true,
      scale: 'volume' 
    },
    { 
      id: 'natr', 
      name: 'NATR', 
      category: 'Volatility', 
      description: 'Normalized Average True Range - volatility as percentage of closing price',
      // chartable: true,
      scale: 'oscillator'
    },
    { 
      id: 'mfi_14', 
      name: 'MFI (14)', 
      category: 'Volume', 
      description: 'Money Flow Index - volume-weighted RSI showing buying/selling pressure',
      // chartable: true,
      scale: 'oscillator'
    },
    { 
      id: 'mcap_top_100', 
      name: 'Mcap Top 100', 
      category: 'Strategy', 
      description: 'Filter for top 100 stocks by market capitalization',
      // chartable: false, 
      scale: 'none'
    },
  ];

  // Seed indicators
  for (const ind of indicators) {
    await prisma.indicator.upsert({ 
      where: { id: ind.id }, 
      update: {}, 
      create: ind 
    });
  }
  console.log('Indicators seeded.');

  // ── Role → Indicator entitlements ─────────────────────────────────────────
  // Standard: Only BBands, RSI, SMA 20, EMA 20
  const standardIndicatorIds = ['bbands_20', 'rsi_14', 'sma_20', 'ema_20'];
  
  // Premium: All
  const premiumIndicatorIds = indicators.map((i) => i.id);
  
  // Developer: All
  const developerIndicatorIds = indicators.map((i) => i.id);

  // Clean up existing relationships
  await prisma.roleIndicator.deleteMany({ where: { roleId: standardRole.id } });
  await prisma.roleIndicator.deleteMany({ where: { roleId: premiumRole.id } });
  await prisma.roleIndicator.deleteMany({ where: { roleId: developerRole.id } });

  // Create new relationships
  await prisma.roleIndicator.createMany({
    data: standardIndicatorIds.map((id) => ({ roleId: standardRole.id, indicatorId: id })),
  });
  await prisma.roleIndicator.createMany({
    data: premiumIndicatorIds.map((id) => ({ roleId: premiumRole.id, indicatorId: id })),
  });
  await prisma.roleIndicator.createMany({
    data: developerIndicatorIds.map((id) => ({ roleId: developerRole.id, indicatorId: id })),
  });

  console.log('Role-indicator entitlements seeded.');

  // ── Demo users ─────────────────────────────────────────────────────────────
  const BCRYPT_ROUNDS = 12;

  const users = [
    { name: 'Standard User',  email: 'standard@alumnus.app', password: 'Standard@123', roleId: standardRole.id },
    { name: 'Premium User',   email: 'premium@alumnus.app',  password: 'Premium@123',  roleId: premiumRole.id },
    { name: 'Dev User',       email: 'dev@alumnus.app',      password: 'Developer@123', roleId: developerRole.id },
  ];

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, BCRYPT_ROUNDS);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        name: u.name,
        email: u.email,
        passwordHash,
        roleId: u.roleId,
      },
    });
  }

  console.log('Demo users seeded.');
  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });