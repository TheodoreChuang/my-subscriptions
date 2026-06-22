CREATE TABLE "calendar_selection" (
	"id" text PRIMARY KEY NOT NULL,
	"integrationId" text NOT NULL,
	"externalCalendarId" text NOT NULL,
	"name" text NOT NULL,
	"createdAt" timestamp NOT NULL,
	CONSTRAINT "calendar_selection_integrationId_externalCalendarId_unique" UNIQUE("integrationId","externalCalendarId")
);
--> statement-breakpoint
CREATE TABLE "integration" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"category" text NOT NULL,
	"provider" text NOT NULL,
	"accessToken" text NOT NULL,
	"refreshToken" text,
	"expiresAt" timestamp NOT NULL,
	"scope" text,
	"status" text DEFAULT 'active' NOT NULL,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	CONSTRAINT "integration_userId_provider_unique" UNIQUE("userId","provider")
);
--> statement-breakpoint
ALTER TABLE "calendar_selection" ADD CONSTRAINT "calendar_selection_integrationId_integration_id_fk" FOREIGN KEY ("integrationId") REFERENCES "public"."integration"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration" ADD CONSTRAINT "integration_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;