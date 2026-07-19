import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1784500000000 implements MigrationInterface {
  name = 'InitialSchema1784500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "accounts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "username" character varying(30) NOT NULL,
        "firstname" character varying(30) NOT NULL,
        "lastname" character varying(30) NOT NULL,
        "email" character varying NOT NULL,
        "password" text NOT NULL,
        "tokenVersion" integer NOT NULL DEFAULT 1,
        "avatarMediaId" uuid,
        "bio" character varying(160),
        "apiKey" character varying(64),
        "apiKeyCreatedAt" TIMESTAMP WITH TIME ZONE,
        "lastSeenAt" TIMESTAMP WITH TIME ZONE,
        "lastUpdate" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_accounts" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_accounts_username" ON "accounts" ("username")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_accounts_email" ON "accounts" ("email")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_accounts_api_key" ON "accounts" ("apiKey")`);

    await queryRunner.query(`
      CREATE TABLE "media" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "ownerId" uuid NOT NULL,
        "kind" character varying(8) NOT NULL,
        "purpose" character varying(8) NOT NULL DEFAULT 'content',
        "status" character varying(12) NOT NULL DEFAULT 'pending',
        "visibility" character varying(8) NOT NULL DEFAULT 'private',
        "mimeType" character varying(64) NOT NULL,
        "ext" character varying(8) NOT NULL,
        "bytes" bigint NOT NULL DEFAULT '0',
        "width" integer,
        "height" integer,
        "durationMs" integer,
        "thumbhash" bytea,
        "widths" jsonb NOT NULL DEFAULT '[]',
        "capturedAt" TIMESTAMP WITH TIME ZONE,
        "errorCode" character varying(32),
        "error" text,
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_media" PRIMARY KEY ("id"),
        CONSTRAINT "FK_media_owner" FOREIGN KEY ("ownerId") REFERENCES "accounts" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_media_owner_captured" ON "media" ("ownerId", "capturedAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_media_owner_status" ON "media" ("ownerId", "status")`);

    await queryRunner.query(`
      CREATE TABLE "galleries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "ownerId" uuid NOT NULL,
        "title" character varying(60) NOT NULL,
        "slug" character varying(72) NOT NULL,
        "tags" jsonb NOT NULL DEFAULT '[]',
        "tagLabels" jsonb NOT NULL DEFAULT '[]',
        "visibility" character varying(8) NOT NULL DEFAULT 'private',
        "coverMediaId" uuid,
        "publishedAt" TIMESTAMP WITH TIME ZONE,
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_galleries" PRIMARY KEY ("id"),
        CONSTRAINT "FK_galleries_owner" FOREIGN KEY ("ownerId") REFERENCES "accounts" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_galleries_cover" FOREIGN KEY ("coverMediaId") REFERENCES "media" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_galleries_owner_slug" ON "galleries" ("ownerId", "slug") WHERE "deletedAt" IS NULL`);
    await queryRunner.query(`CREATE INDEX "IDX_galleries_public_published" ON "galleries" ("visibility", "publishedAt")`);

    await queryRunner.query(`
      CREATE TABLE "gallery_media" (
        "galleryId" uuid NOT NULL,
        "mediaId" uuid NOT NULL,
        "position" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_gallery_media" PRIMARY KEY ("galleryId", "mediaId"),
        CONSTRAINT "FK_gallery_media_gallery" FOREIGN KEY ("galleryId") REFERENCES "galleries" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_gallery_media_media" FOREIGN KEY ("mediaId") REFERENCES "media" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_gallery_media_order" ON "gallery_media" ("galleryId", "position")`);
    await queryRunner.query(`CREATE INDEX "IDX_gallery_media_media" ON "gallery_media" ("mediaId")`);

    await queryRunner.query(`
      CREATE TABLE "follows" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "followerId" uuid NOT NULL,
        "followingId" uuid NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_follows" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_follows_not_self" CHECK ("followerId" <> "followingId"),
        CONSTRAINT "FK_follows_follower" FOREIGN KEY ("followerId") REFERENCES "accounts" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_follows_following" FOREIGN KEY ("followingId") REFERENCES "accounts" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_follows_pair" ON "follows" ("followerId", "followingId")`);
    await queryRunner.query(`CREATE INDEX "IDX_follows_following" ON "follows" ("followingId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "follows"`);
    await queryRunner.query(`DROP TABLE "gallery_media"`);
    await queryRunner.query(`DROP TABLE "galleries"`);
    await queryRunner.query(`DROP TABLE "media"`);
    await queryRunner.query(`DROP TABLE "accounts"`);
  }
}
