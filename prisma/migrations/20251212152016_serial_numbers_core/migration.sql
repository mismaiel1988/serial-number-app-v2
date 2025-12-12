-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "orderNumber" INTEGER NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineItem" (
    "id" TEXT NOT NULL,
    "shopifyLineItemId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sku" TEXT,
    "quantity" INTEGER NOT NULL,
    "isSaddle" BOOLEAN NOT NULL DEFAULT false,
    "orderId" TEXT NOT NULL,

    CONSTRAINT "LineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SerialNumber" (
    "id" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT true,
    "warrantyActive" BOOLEAN NOT NULL DEFAULT false,
    "warrantyExpires" TIMESTAMP(3),
    "orderId" TEXT NOT NULL,
    "lineItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SerialNumber_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_shopifyOrderId_key" ON "Order"("shopifyOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "LineItem_shopifyLineItemId_key" ON "LineItem"("shopifyLineItemId");

-- CreateIndex
CREATE UNIQUE INDEX "SerialNumber_serial_key" ON "SerialNumber"("serial");

-- AddForeignKey
ALTER TABLE "LineItem" ADD CONSTRAINT "LineItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialNumber" ADD CONSTRAINT "SerialNumber_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialNumber" ADD CONSTRAINT "SerialNumber_lineItemId_fkey" FOREIGN KEY ("lineItemId") REFERENCES "LineItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
