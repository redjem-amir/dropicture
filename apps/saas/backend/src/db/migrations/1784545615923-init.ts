import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1784545615923 implements MigrationInterface {
  name = 'Init1784545615923';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."media_role_enum" AS ENUM('content', 'avatar')`);
    await queryRunner.query(
      `CREATE TABLE "media" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ownerId" uuid NOT NULL, "role" "public"."media_role_enum" NOT NULL DEFAULT 'content', "mimeType" character varying(64) NOT NULL, "bytes" bigint NOT NULL, "width" integer, "height" integer, "durationMs" integer, "capturedAt" TIMESTAMP WITH TIME ZONE, "publishedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f4e0fcac36e050de337b670d8bd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_media_feed" ON "media"  ("publishedAt") WHERE "publishedAt" IS NOT NULL AND role = 'content'`);
    await queryRunner.query(`CREATE INDEX "IDX_media_library" ON "media"  ("ownerId", "capturedAt") `);
    await queryRunner.query(
      `CREATE TABLE "accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "username" character varying(30) NOT NULL, "email" character varying(255) NOT NULL, "passwordHash" text NOT NULL, "firstname" character varying(30) NOT NULL, "lastname" character varying(30) NOT NULL, "bio" character varying(160), "avatarMediaId" uuid, "tokenVersion" integer NOT NULL DEFAULT '1', "apiKey" character varying(64), "apiKeyIssuedAt" TIMESTAMP WITH TIME ZONE, "lastSeenAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5a7a02c20412299d198e097a8fe" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_accounts_api_key" ON "accounts"  ("apiKey") WHERE "apiKey" IS NOT NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_accounts_email" ON "accounts"  ("email") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_accounts_username" ON "accounts"  ("username") `);
    await queryRunner.query(
      `CREATE TABLE "follows" ("followerId" uuid NOT NULL, "followingId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_follows_not_self" CHECK ("followerId" <> "followingId"), CONSTRAINT "PK_105079775692df1f8799ed0fac8" PRIMARY KEY ("followerId", "followingId"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_follows_following" ON "follows"  ("followingId") `);
    await queryRunner.query(
      `CREATE TABLE "albums" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ownerId" uuid NOT NULL, "title" character varying(60) NOT NULL, "coverMediaId" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_838ebae24d2e12082670ffc95d7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_albums_owner_title" ON "albums"  ("ownerId", "title") `);
    await queryRunner.query(
      `CREATE TABLE "placements" ("albumId" uuid NOT NULL, "mediaId" uuid NOT NULL, "position" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_888f6b0f184c51bff2d28656bee" PRIMARY KEY ("albumId", "mediaId"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_placements_media" ON "placements"  ("mediaId") `);
    await queryRunner.query(`CREATE INDEX "IDX_placements_order" ON "placements"  ("albumId", "position") `);
    await queryRunner.query(`ALTER TABLE "media" ADD CONSTRAINT "FK_media_owner" FOREIGN KEY ("ownerId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "accounts" ADD CONSTRAINT "FK_accounts_avatar" FOREIGN KEY ("avatarMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "follows" ADD CONSTRAINT "FK_follows_follower" FOREIGN KEY ("followerId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "follows" ADD CONSTRAINT "FK_follows_following" FOREIGN KEY ("followingId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "albums" ADD CONSTRAINT "FK_albums_owner" FOREIGN KEY ("ownerId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "albums" ADD CONSTRAINT "FK_albums_cover" FOREIGN KEY ("coverMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "placements" ADD CONSTRAINT "FK_placements_album" FOREIGN KEY ("albumId") REFERENCES "albums"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "placements" ADD CONSTRAINT "FK_placements_media" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "placements" DROP CONSTRAINT "FK_placements_media"`);
    await queryRunner.query(`ALTER TABLE "placements" DROP CONSTRAINT "FK_placements_album"`);
    await queryRunner.query(`ALTER TABLE "albums" DROP CONSTRAINT "FK_albums_cover"`);
    await queryRunner.query(`ALTER TABLE "albums" DROP CONSTRAINT "FK_albums_owner"`);
    await queryRunner.query(`ALTER TABLE "follows" DROP CONSTRAINT "FK_follows_following"`);
    await queryRunner.query(`ALTER TABLE "follows" DROP CONSTRAINT "FK_follows_follower"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP CONSTRAINT "FK_accounts_avatar"`);
    await queryRunner.query(`ALTER TABLE "media" DROP CONSTRAINT "FK_media_owner"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_placements_order"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_placements_media"`);
    await queryRunner.query(`DROP TABLE "placements"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_albums_owner_title"`);
    await queryRunner.query(`DROP TABLE "albums"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_follows_following"`);
    await queryRunner.query(`DROP TABLE "follows"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_accounts_username"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_accounts_email"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_accounts_api_key"`);
    await queryRunner.query(`DROP TABLE "accounts"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_media_library"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_media_feed"`);
    await queryRunner.query(`DROP TABLE "media"`);
    await queryRunner.query(`DROP TYPE "public"."media_role_enum"`);
  }
}
