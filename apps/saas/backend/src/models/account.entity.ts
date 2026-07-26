// dropicture/apps/saas/backend/src/models/account.entity.ts
import { Entity, Column, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Media } from './media.entity';

/**
 * Table `accounts`, une ligne par compte utilisateur. Porte l'identité affichée, le secret
 * d'authentification, les champs du profil public, le compteur de révocation globale des sessions et
 * la clé d'interface de programmation applicative.
 *
 * @remarks Trois index uniques verrouillent les identifiants, le nom d'utilisateur et l'adresse
 * électronique sur la totalité de la table, la clé d'API sur un index partiel restreint aux lignes où
 * elle est renseignée, ce qui laisse coexister sans conflit tous les comptes qui n'en ont pas.
 * Les deux colonnes secrètes, `passwordHash` et `apiKey`, sont déclarées `select: false` et sortent
 * donc des lectures par défaut, un `addSelect` explicite est nécessaire pour les charger. La suppression
 * d'un compte se propage en cascade aux médias, aux albums et aux abonnements qui le référencent.
 */
@Entity({ name: 'accounts' })
@Index('UQ_accounts_username', ['username'], { unique: true })
@Index('UQ_accounts_email', ['email'], { unique: true })
@Index('UQ_accounts_api_key', ['apiKey'], { unique: true, where: '"apiKey" IS NOT NULL' })
export class Account {
  /** Identifiant technique, UUID généré par la base. Sert de sujet d'authentification dans les sessions et de clé étrangère aux autres tables. */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Nom d'utilisateur unique, trente caractères au plus. Normalisé en minuscules et filtré en amont par
   * `USERNAME_PATTERN` et la liste `RESERVED_USERNAMES`, il constitue la clé d'adressage du profil public.
   */
  @Column({ type: 'varchar', length: 30 })
  username: string;

  /** Adresse électronique unique, identifiant de connexion. Longueur alignée sur la limite usuelle d'une adresse de courrier. */
  @Column({ type: 'varchar', length: 255 })
  email: string;

  /**
   * Empreinte Argon2id du mot de passe. Exclue des lectures par défaut par `select: false` afin qu'aucune
   * projection accidentelle ne la fasse remonter dans une réponse, seules la connexion, le changement de
   * mot de passe et la suppression de compte la chargent explicitement pour la vérifier.
   */
  @Column({ type: 'text', select: false })
  passwordHash: string;

  /** Prénom affiché, trente caractères au plus, validé en amont par `NAME_PATTERN`. */
  @Column({ type: 'varchar', length: 30 })
  firstname: string;

  /** Nom affiché, trente caractères au plus, validé en amont par `NAME_PATTERN`. */
  @Column({ type: 'varchar', length: 30 })
  lastname: string;

  /** Présentation libre exposée sur le profil public, cent soixante caractères au plus, nulle tant qu'elle n'est pas renseignée. */
  @Column({ type: 'varchar', length: 160, nullable: true })
  bio: string | null;

  /**
   * Média servant de photo de profil, nul par défaut. La contrainte étrangère `FK_accounts_avatar` est en
   * `ON DELETE SET NULL`, la suppression de l'image remet donc la colonne à nul sans détruire le compte.
   */
  @Column({ type: 'uuid', nullable: true })
  avatarMediaId: string | null;

  /** Relation de lecture vers le média d'avatar, alignée sur `avatarMediaId` et nulle lorsque aucun avatar n'est défini. */
  @ManyToOne(() => Media, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'avatarMediaId', foreignKeyConstraintName: 'FK_accounts_avatar' })
  avatar: Media | null;

  /**
   * Génération de session en cours, à un à la création du compte. La valeur est recopiée dans chaque
   * enregistrement de session, incrémenter la colonne invalide donc d'un coup toutes les sessions du compte
   * sans avoir à les énumérer dans Redis.
   */
  @Column({ type: 'int', default: 1 })
  tokenVersion: number;

  /**
   * Clé d'API en clair, nulle tant qu'aucune rotation n'a eu lieu. Exclue des lectures par défaut par
   * `select: false`, elle n'est révélée qu'à la route de rotation et à la route de consultation dédiée.
   * L'authentification par clé la recherche en base par égalité stricte.
   */
  @Column({ type: 'varchar', length: 64, nullable: true, select: false })
  apiKey: string | null;

  /** Horodatage de la dernière émission de clé d'API, remis à jour à chaque rotation et retourné avec la clé pour tracer son âge. */
  @Column({ type: 'timestamptz', nullable: true })
  apiKeyIssuedAt: Date | null;

  /**
   * Dernière activité observée sur une session. Écrite au plus une fois toutes les cinq minutes lors de la
   * rotation du cookie, ce bridage évite une écriture en base à chaque requête authentifiée.
   */
  @Column({ type: 'timestamptz', nullable: true })
  lastSeenAt: Date | null;

  /** Date de création de la ligne, renseignée par la base. */
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  /** Date de dernière modification de la ligne, entretenue par TypeORM à chaque écriture. */
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
