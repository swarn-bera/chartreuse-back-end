/*
  Warnings:

  - You are about to drop the column `name` on the `MutualFund` table. All the data in the column will be lost.
  - Added the required column `schemeName` to the `MutualFund` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "mutual_funds"."MutualFund" DROP COLUMN "name",
ADD COLUMN     "schemeName" TEXT NOT NULL;
