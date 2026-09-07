CREATE TABLE "mimic_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"customer_id" text,
	"subscription_id" text,
	"status" text DEFAULT 'free' NOT NULL,
	"period_end" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mimic_accounts_customer_id_unique" UNIQUE("customer_id")
);
--> statement-breakpoint
CREATE TABLE "mimic_devices" (
	"hash" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mimic_stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mimic_reservations" (
	"user_id" text NOT NULL,
	"operation_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mimic_reservations_user_id_operation_id_pk" PRIMARY KEY("user_id","operation_id")
);
--> statement-breakpoint
CREATE TABLE "mimic_usage" (
	"user_id" text NOT NULL,
	"month" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "mimic_usage_user_id_month_pk" PRIMARY KEY("user_id","month")
);
--> statement-breakpoint
ALTER TABLE "mimic_devices" ADD CONSTRAINT "mimic_devices_user_id_mimic_accounts_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mimic_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mimic_reservations" ADD CONSTRAINT "mimic_reservations_user_id_mimic_accounts_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mimic_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mimic_usage" ADD CONSTRAINT "mimic_usage_user_id_mimic_accounts_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."mimic_accounts"("id") ON DELETE cascade ON UPDATE no action;