-- CreateTable
CREATE TABLE "email_otps" (
    "id"         TEXT         NOT NULL,
    "email"      TEXT         NOT NULL,
    "otp_hash"   TEXT         NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_otps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_otps_email_idx" ON "email_otps"("email");
