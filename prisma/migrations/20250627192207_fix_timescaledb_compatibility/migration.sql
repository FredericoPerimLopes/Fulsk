/*
  Warnings:

  - The primary key for the `device_data` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `device_data` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "device_data_deviceId_timestamp_idx";

-- AlterTable
ALTER TABLE "device_data" DROP CONSTRAINT "device_data_pkey",
DROP COLUMN "id",
ALTER COLUMN "timestamp" SET DATA TYPE TIMESTAMPTZ,
ADD CONSTRAINT "device_data_pkey" PRIMARY KEY ("deviceId", "timestamp");
