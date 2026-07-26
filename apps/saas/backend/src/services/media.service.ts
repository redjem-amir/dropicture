// dropicture/apps/saas/backend/src/services/media.service.ts
import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { Transform, type Readable } from 'node:stream';
import { SSMClient, GetParametersByPathCommand } from '@aws-sdk/client-ssm';
import { DeleteObjectsCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { Media, type MediaKind, type MediaRole } from '../models/media.entity';

/**
 * Préfixe de premier niveau des clés S3. Isole les médias des autres objets du bucket et sert de racine commune
 * aux chemins d'invalidation CloudFront.
 */
export const MEDIA_PREFIX = 'media';

/**
 * Liste blanche des types MIME acceptés, associée à l'extension inscrite dans la clé S3 et à la nature du média.
 * Le filtrage par liste blanche interdit tout format non prévu, notamment les exécutables et les SVG porteurs de script.
 */
export const MEDIA_TYPES: Record<string, { ext: string; kind: MediaKind }> = {
  'image/jpeg': { ext: 'jpg', kind: 'image' },
  'image/png': { ext: 'png', kind: 'image' },
  'image/webp': { ext: 'webp', kind: 'image' },
  'image/avif': { ext: 'avif', kind: 'image' },
  'image/heic': { ext: 'heic', kind: 'image' },
  'video/mp4': { ext: 'mp4', kind: 'video' },
  'video/quicktime': { ext: 'mov', kind: 'video' },
  'video/webm': { ext: 'webm', kind: 'video' },
};

/**
 * Sous-ensemble autorisé pour la photo de profil. Restreint l'avatar aux trois formats image lus nativement par
 * tous les navigateurs, AVIF et HEIC ainsi que les formats vidéo sont donc refusés sur ce rôle.
 */
export const MEDIA_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Bornes de téléversement et de suppression. Les plafonds de poids protègent le stockage et la bande passante
 * sortante, la taille de part de 5 Mo correspond au minimum imposé par le téléversement multipart S3 et la
 * concurrence de deux parts plafonne l'empreinte mémoire d'un envoi à environ 10 Mo. Le lot de 1000 objets est le
 * maximum accepté par une commande `DeleteObjects`.
 */
export const MEDIA_LIMITS = {
  IMAGE_MAX_BYTES: 8 * 1024 * 1024,
  AVATAR_MAX_BYTES: 8 * 1024 * 1024,
  VIDEO_MAX_BYTES: 100 * 1024 * 1024,
  PART_SIZE: 5 * 1024 * 1024,
  PART_CONCURRENCY: 2,
  DELETE_BATCH: 1000,
} as const;

/**
 * Retourne l'extension de fichier associée à un type MIME.
 *
 * @param mimeType - Type MIME déclaré du média.
 * @returns Extension issue de `MEDIA_TYPES`, ou `bin` lorsque le type est absent de la liste blanche.
 */
export const extOf = (mimeType: string): string => MEDIA_TYPES[mimeType]?.ext ?? 'bin';
/**
 * Retourne la nature d'un média déduite de son type MIME.
 *
 * @param mimeType - Type MIME déclaré du média.
 * @returns `image` ou `video` d'après `MEDIA_TYPES`, `image` par défaut lorsque le type est inconnu.
 */
export const kindOf = (mimeType: string): MediaKind => MEDIA_TYPES[mimeType]?.kind ?? 'image';

/** Projection d'un média destinée aux clients. Ne porte ni la clé S3 ni le poids, et expose l'URL de diffusion déjà construite. */
export type MediaView = {
  id: string;
  kind: MediaKind;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  url: string;
};

/**
 * Paramètres d'un téléversement. `contentLength` n'est qu'une longueur annoncée par le client, la borne de poids
 * qui fait foi est appliquée sur les octets réellement lus dans le flux.
 */
export type UploadParams = {
  ownerId: string;
  role: MediaRole;
  stream: Readable;
  mimeType: string;
  contentLength?: number;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  capturedAt?: Date | null;
};

/** Sentinelle interne signalant le dépassement de la borne d'octets, émise par le flux de garde et interceptée par `upload`. */
class TooLargeError extends Error {}

/**
 * Service du domaine média. Résout la configuration CDN au démarrage, calcule les clés d'objet S3, téléverse les
 * fichiers en flux, publie ou dépublie les médias et les supprime avec invalidation du cache de diffusion.
 *
 * @remarks Le flux entrant est borné par un `Transform` qui compte les octets et rompt le téléversement dès le
 * dépassement de la limite du rôle, ce qui évite de matérialiser le fichier en mémoire et rend inopérant un
 * en-tête de longueur mensonger. Toute lecture, mise à jour ou suppression est filtrée par `ownerId`, un compte
 * n'agit donc que sur ses propres médias. La visibilité publique est portée par la seule colonne `publishedAt`.
 */
@Injectable()
export class MediaService implements OnModuleInit {
  private readonly logger = new Logger(MediaService.name);
  /** Région AWS des appels S3 et SSM, `eu-west-3` par défaut lorsque `AWS_REGION` est absent. */
  private readonly region = process.env.AWS_REGION ?? 'eu-west-3';
  /** Chemin SSM racine où sont lus le bucket, le domaine de diffusion et l'identifiant de distribution. */
  private readonly ssmPrefix = process.env.CDN_SSM_PREFIX ?? '/dropicture/cloudfront';

  private readonly s3 = new S3Client({ region: this.region });
  /** Client CloudFront épinglé sur `us-east-1`, seul point d'entrée régional de l'API de distribution. */
  private readonly cloudfront = new CloudFrontClient({ region: 'us-east-1' });
  /** Configuration résolue par `onModuleInit`, non renseignée avant l'initialisation du module. */
  private bucket!: string;
  private domain!: string;
  private distributionId!: string;

  /** @param mediaRepository - Dépôt TypeORM de l'entité `Media`. */
  constructor(
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
  ) {}

  /**
   * Charge la configuration de diffusion depuis SSM au démarrage du module et vérifie qu'elle est complète.
   *
   * @remarks Parcourt récursivement le chemin `ssmPrefix` page par page en suivant `NextToken`, puis détruit le
   * client SSM dans un `finally` afin de libérer la connexion même en cas d'échec. Le préfixe est retiré du nom de
   * chaque paramètre pour ne conserver que la clé courte. L'échec au démarrage est volontaire, il empêche le
   * service de répondre plus tard avec un bucket ou un domaine vide.
   * @returns Rien, les champs `bucket`, `domain` et `distributionId` sont renseignés en place.
   * @throws Error si le bucket, le domaine ou l'identifiant de distribution est absent de SSM, le message énumère
   * les clés manquantes.
   */
  async onModuleInit(): Promise<void> {
    const ssm = new SSMClient({ region: this.region });
    const params: Record<string, string> = {};
    try {
      let token: string | undefined;
      do {
        const page = await ssm.send(new GetParametersByPathCommand({ Path: this.ssmPrefix, Recursive: true, NextToken: token }));
        for (const p of page.Parameters ?? []) {
          if (p.Name && p.Value) params[p.Name.slice(this.ssmPrefix.length + 1)] = p.Value;
        }
        token = page.NextToken;
      } while (token);
    } finally {
      ssm.destroy();
    }
    this.bucket = params['bucket'];
    this.domain = params['domain'];
    this.distributionId = params['distribution_id'];
    const missing = Object.entries({ bucket: this.bucket, domain: this.domain, distribution_id: this.distributionId })
      .filter(([, v]) => !v)
      .map(([k]) => k);
    if (missing.length) {
      throw new Error(`Configuration CDN incomplète dans SSM ${this.ssmPrefix} (${missing.join(', ')}).`);
    }
    this.logger.log(`Média prêt · ${this.domain}`);
  }

  /**
   * Construit la clé de l'objet S3 correspondant à un média.
   *
   * @remarks Le partitionnement par identifiant de propriétaire regroupe les objets d'un même compte et rend la clé
   * non devinable, les deux segments variables étant des UUID.
   * @param media - Média réduit à son identifiant, son propriétaire et son type MIME.
   * @returns Clé de la forme `media/<ownerId>/<id>.<ext>`.
   */
  key(media: Pick<Media, 'id' | 'ownerId' | 'mimeType'>): string {
    return `${MEDIA_PREFIX}/${media.ownerId}/${media.id}.${extOf(media.mimeType)}`;
  }

  /**
   * Projette une entité média en vue exposable au client.
   *
   * @remarks Aucune donnée sensible n'est reprise, ni le nom du bucket ni le rôle ni le poids stocké.
   * @param media - Entité média chargée depuis la base.
   * @returns Identifiant, nature déduite du type MIME, largeur, hauteur, durée en millisecondes et URL de diffusion
   * composée du domaine CDN et de la clé S3.
   */
  view(media: Media): MediaView {
    return {
      id: media.id,
      kind: kindOf(media.mimeType),
      width: media.width,
      height: media.height,
      durationMs: media.durationMs,
      url: `${this.domain}/${this.key(media)}`,
    };
  }

  /**
   * Expose les bornes de téléversement pour permettre au client de refuser un fichier avant tout envoi.
   *
   * @remarks Ce contrôle côté client n'est qu'un confort, la borne opposable reste celle appliquée par `upload`.
   * @returns Poids maximal des images, poids maximal des vidéos, poids maximal et types acceptés pour l'avatar,
   * puis la liste complète des types MIME acceptés.
   */
  limits() {
    return {
      image: { maxBytes: MEDIA_LIMITS.IMAGE_MAX_BYTES },
      video: { maxBytes: MEDIA_LIMITS.VIDEO_MAX_BYTES },
      avatar: { maxBytes: MEDIA_LIMITS.AVATAR_MAX_BYTES, accepted: MEDIA_AVATAR_TYPES },
      accepted: Object.keys(MEDIA_TYPES),
    };
  }

  /**
   * Détermine le poids maximal autorisé pour un média.
   *
   * @remarks Le rôle prime sur la nature, un avatar reste plafonné à la borne avatar quel que soit son type MIME.
   * @param kind - Nature du média, image ou vidéo.
   * @param role - Rôle du média, contenu ou photo de profil.
   * @returns Nombre d'octets maximal applicable au couple nature et rôle.
   */
  maxBytes(kind: MediaKind, role: MediaRole): number {
    if (role === 'avatar') return MEDIA_LIMITS.AVATAR_MAX_BYTES;
    return kind === 'video' ? MEDIA_LIMITS.VIDEO_MAX_BYTES : MEDIA_LIMITS.IMAGE_MAX_BYTES;
  }

  /**
   * Téléverse un média vers S3 en flux, puis enregistre la ligne correspondante en base.
   *
   * @remarks Trois contrôles se succèdent avant l'envoi, la liste blanche des types MIME, la restriction propre au
   * rôle avatar et la longueur annoncée. Cette longueur ne fait pas foi, un `Transform` compte les octets
   * effectivement reçus et rompt le flux au dépassement, ce qui borne la mémoire consommée et neutralise un
   * en-tête falsifié. Un échec déclenche l'abandon du téléversement multipart pour ne pas laisser de parts
   * orphelines facturées, et un flux vide voit son objet supprimé de S3 avant le rejet afin de ne pas laisser de
   * fichier de taille nulle. L'objet est écrit avec un cache immuable d'un an, la clé étant unique par UUID. Le
   * rôle avatar est publié dès l'enregistrement, un contenu reste privé jusqu'à publication explicite.
   * @param params - Propriétaire, rôle, flux lisible, type MIME, longueur annoncée facultative et métadonnées
   * facultatives de largeur, hauteur, durée et date de prise de vue.
   * @returns Entité `Media` enregistrée, portant le poids réel en octets et un `publishedAt` renseigné pour un avatar.
   * @throws BadRequestException `UNSUPPORTED_MEDIA_TYPE` avec le statut 400 si le type MIME est hors liste blanche,
   * ou hors des trois formats admis pour un avatar.
   * @throws BadRequestException `FILE_TOO_LARGE` avec le statut 400 si la longueur annoncée ou le nombre d'octets
   * reçus dépasse la borne du rôle.
   * @throws BadRequestException `UPLOAD_FAILED` avec le statut 400 si le téléversement S3 échoue pour toute autre raison.
   * @throws BadRequestException `FILE_REQUIRED` avec le statut 400 si le flux n'a transporté aucun octet.
   */
  async upload(params: UploadParams): Promise<Media> {
    const type = MEDIA_TYPES[params.mimeType];
    if (!type) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: `Type non accepté. Formats : ${Object.keys(MEDIA_TYPES).join(', ')}.`,
      });
    }
    const isAvatar = params.role === 'avatar';
    if (isAvatar && !MEDIA_AVATAR_TYPES.includes(params.mimeType)) {
      throw new BadRequestException({ code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Photo de profil : JPEG, PNG ou WEBP.' });
    }
    const max = this.maxBytes(type.kind, params.role);
    if (params.contentLength && params.contentLength > max) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: `Poids maximal : ${Math.round(max / 1024 / 1024)} Mo.`,
      });
    }
    const id = randomUUID();
    const key = `${MEDIA_PREFIX}/${params.ownerId}/${id}.${type.ext}`;
    let bytes = 0;
    const guard = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        bytes += chunk.length;
        if (bytes > max) return cb(new TooLargeError());
        cb(null, chunk);
      },
    });
    params.stream.pipe(guard);
    const upload = new Upload({
      client: this.s3,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: guard,
        ContentType: params.mimeType,
        CacheControl: 'public, max-age=31536000, immutable',
      },
      partSize: MEDIA_LIMITS.PART_SIZE,
      queueSize: MEDIA_LIMITS.PART_CONCURRENCY,
    });
    try {
      await upload.done();
    } catch (err) {
      await upload.abort().catch(() => undefined);
      if (err instanceof TooLargeError || (err as Error)?.cause instanceof TooLargeError) {
        throw new BadRequestException({
          code: 'FILE_TOO_LARGE',
          message: `Poids maximal : ${Math.round(max / 1024 / 1024)} Mo.`,
        });
      }
      throw new BadRequestException({ code: 'UPLOAD_FAILED', message: 'Envoi interrompu.' });
    }
    if (!bytes) {
      await this.s3.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: [{ Key: key }], Quiet: true },
        }),
      );
      throw new BadRequestException({ code: 'FILE_REQUIRED' });
    }
    return this.mediaRepository.save(
      this.mediaRepository.create({
        id,
        ownerId: params.ownerId,
        role: params.role,
        mimeType: params.mimeType,
        bytes: String(bytes),
        width: params.width ?? null,
        height: params.height ?? null,
        durationMs: params.durationMs ?? null,
        capturedAt: params.capturedAt ?? null,
        publishedAt: isAvatar ? new Date() : null,
      }),
    );
  }

  /**
   * Publie les médias désignés en leur affectant une date de publication.
   *
   * @remarks La mise à jour est filtrée par `ownerId`, une demande visant le média d'un autre compte ne modifie
   * aucune ligne et n'est pas distinguable d'un identifiant inexistant. `COALESCE("publishedAt", NOW())` rend
   * l'appel idempotent, une seconde publication conserve la date d'origine. Un lot vide court-circuite la requête.
   * @param ownerId - Identifiant du compte propriétaire, restreint la portée de la mise à jour.
   * @param mediaIds - Identifiants des médias à publier.
   * @returns Identifiants réellement mis à jour, ce qui permet à l'appelant de repérer les identifiants ignorés.
   */
  async publish(ownerId: string, mediaIds: string[]): Promise<string[]> {
    if (!mediaIds.length) return [];
    const result = await this.mediaRepository
      .createQueryBuilder()
      .update(Media)
      .set({ publishedAt: () => 'COALESCE("publishedAt", NOW())' })
      .where('id IN (:...ids)', { ids: mediaIds })
      .andWhere('"ownerId" = :ownerId', { ownerId })
      .returning('id')
      .execute();
    return ((result.raw ?? []) as { id: string }[]).map((r) => r.id);
  }

  /**
   * Retire les médias désignés de la diffusion publique en effaçant leur date de publication.
   *
   * @remarks Même filtrage par `ownerId` que la publication. La clause `role <> 'avatar'` écarte la photo de
   * profil, qui reste publiée tant qu'elle existe. Un lot vide court-circuite la requête.
   * @param ownerId - Identifiant du compte propriétaire, restreint la portée de la mise à jour.
   * @param mediaIds - Identifiants des médias à dépublier.
   * @returns Identifiants réellement dépubliés, les avatars et les médias d'un autre compte en sont absents.
   */
  async unpublish(ownerId: string, mediaIds: string[]): Promise<string[]> {
    if (!mediaIds.length) return [];
    const result = await this.mediaRepository
      .createQueryBuilder()
      .update(Media)
      .set({ publishedAt: null })
      .where('id IN (:...ids)', { ids: mediaIds })
      .andWhere('"ownerId" = :ownerId', { ownerId })
      .andWhere("role <> 'avatar'")
      .returning('id')
      .execute();
    return ((result.raw ?? []) as { id: string }[]).map((r) => r.id);
  }

  /**
   * Supprime définitivement les médias désignés, leurs objets S3 et leur trace dans le cache de diffusion.
   *
   * @remarks Les lignes sont d'abord relues avec le filtre `ownerId`, aucune clé n'est donc calculée pour un média
   * qui n'appartient pas au compte. Les objets partent par lots de `DELETE_BATCH` clés, borne maximale d'une
   * commande `DeleteObjects`. La suppression en base intervient après celle des objets, un échec laisse ainsi un
   * média référencé plutôt qu'un objet orphelin. L'invalidation CloudFront porte sur les chemins supprimés et son
   * échec n'est que journalisé en avertissement, la suppression restant acquise.
   * @param ownerId - Identifiant du compte propriétaire, restreint la portée de la suppression.
   * @param mediaIds - Identifiants des médias à supprimer.
   * @returns Identifiants effectivement supprimés, tableau vide si aucun média correspondant n'appartient au compte.
   */
  async destroy(ownerId: string, mediaIds: string[]): Promise<string[]> {
    if (!mediaIds.length) return [];
    const rows = await this.mediaRepository.find({ where: { id: In(mediaIds), ownerId } });
    if (!rows.length) return [];
    const keys = rows.map((m) => this.key(m));

    for (let i = 0; i < keys.length; i += MEDIA_LIMITS.DELETE_BATCH) {
      const slice = keys.slice(i, i + MEDIA_LIMITS.DELETE_BATCH);
      if (!slice.length) continue;
      await this.s3.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: slice.map((Key) => ({ Key })), Quiet: true },
        }),
      );
    }

    await this.mediaRepository.delete({ id: In(rows.map((r) => r.id)), ownerId });

    const paths = keys.map((k) => `/${k}`);
    if (paths.length) {
      try {
        await this.cloudfront.send(
          new CreateInvalidationCommand({
            DistributionId: this.distributionId,
            InvalidationBatch: {
              CallerReference: randomUUID(),
              Paths: { Quantity: paths.length, Items: paths },
            },
          }),
        );
      } catch (err) {
        this.logger.warn(`Invalidation CloudFront échouée : ${(err as Error).message}`);
      }
    }

    return rows.map((r) => r.id);
  }
}
