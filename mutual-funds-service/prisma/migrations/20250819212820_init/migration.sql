-- CreateTable
CREATE TABLE "mutual_funds"."MutualFund" (
    "id" TEXT NOT NULL,
    "schemeCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "fundHouse" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MutualFund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mutual_funds"."NAVHistory" (
    "schemeCode" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "nav" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "NAVHistory_pkey" PRIMARY KEY ("schemeCode","date")
);

-- CreateTable
CREATE TABLE "mutual_funds"."FundMetrics" (
    "schemeCode" TEXT NOT NULL,
    "asOfDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cagr1y" DECIMAL(65,30),
    "cagr3y" DECIMAL(65,30),
    "vol1y" DECIMAL(65,30),
    "rating" INTEGER,
    "riskLabel" TEXT,

    CONSTRAINT "FundMetrics_pkey" PRIMARY KEY ("schemeCode")
);

-- CreateIndex
CREATE UNIQUE INDEX "MutualFund_schemeCode_key" ON "mutual_funds"."MutualFund"("schemeCode");

-- CreateIndex
CREATE INDEX "NAVHistory_schemeCode_date_idx" ON "mutual_funds"."NAVHistory"("schemeCode", "date");

-- AddForeignKey
ALTER TABLE "mutual_funds"."NAVHistory" ADD CONSTRAINT "NAVHistory_schemeCode_fkey" FOREIGN KEY ("schemeCode") REFERENCES "mutual_funds"."MutualFund"("schemeCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mutual_funds"."FundMetrics" ADD CONSTRAINT "FundMetrics_schemeCode_fkey" FOREIGN KEY ("schemeCode") REFERENCES "mutual_funds"."MutualFund"("schemeCode") ON DELETE RESTRICT ON UPDATE CASCADE;
