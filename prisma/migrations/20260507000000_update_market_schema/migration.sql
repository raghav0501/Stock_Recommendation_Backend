-- AlterTable: replace exchange with fullName, country, description
ALTER TABLE "markets" DROP COLUMN "exchange";
ALTER TABLE "markets" ADD COLUMN "full_name"    TEXT NOT NULL DEFAULT '';
ALTER TABLE "markets" ADD COLUMN "country"      TEXT NOT NULL DEFAULT '';
ALTER TABLE "markets" ADD COLUMN "description"  TEXT;

-- Upsert market data
INSERT INTO "markets" ("id", "name", "full_name", "country", "description", "is_active")
VALUES
  (
    'india',
    'NSE & BSE',
    'National Stock Exchange of India & Bombay Stock Exchange',
    'India',
    'Leading stock exchange in India by market capitalization and trading volume',
    true
  ),
  (
    'us',
    'NASDAQ & NYSE',
    'National Association of Securities Dealers Automated Quotations & New York Stock Exchange',
    'United States',
    'Largest stock exchange in the world by market capitalization',
    true
  )
ON CONFLICT ("id") DO UPDATE SET
  "name"        = EXCLUDED."name",
  "full_name"   = EXCLUDED."full_name",
  "country"     = EXCLUDED."country",
  "description" = EXCLUDED."description",
  "is_active"   = EXCLUDED."is_active";

-- Remove temporary defaults now that data is populated
ALTER TABLE "markets" ALTER COLUMN "full_name" DROP DEFAULT;
ALTER TABLE "markets" ALTER COLUMN "country"   DROP DEFAULT;
