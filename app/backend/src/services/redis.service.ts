// dropicture/app/backend/src/services/redis.service.ts
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
    private readonly client: Redis;
    private readonly logger = new Logger(RedisService.name);

    constructor() {
        this.client = new Redis({
            host: process.env.REDIS_HOST,
            port: 6379,
            password: undefined,
            db: 0,
            connectTimeout: 10000,
            maxRetriesPerRequest: 3,
        });
        this.client.on('connect', () => {
            this.logger.log('Redis connected');
        });
        this.client.on('error', (err) => {
            this.logger.error(`Redis error: ${err.message}`);
        });
    }

    incr(key: string) {
        return this.client.incr(key);
    }

    expire(key: string, seconds: number) {
        return this.client.expire(key, seconds);
    }

    setex(key: string, ttl: number, value: string) {
        return this.client.setex(key, ttl, value);
    }

    get(key: string) {
        return this.client.get(key);
    }

    del(key: string) {
        return this.client.del(key);
    }

    set(
        key: string,
        value: string,
        ...args: Array<string | number>
    ): Promise<'OK' | null> {
        return (this.client as any).set(key, value, ...args);
    }

    async setnx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
        const result = await this.set(key, value, 'EX', ttlSeconds, 'NX');
        return result === 'OK';
    }

    sadd(key: string, ...members: Array<string | number>): Promise<number> {
        return this.client.sadd(key, ...members);
    }

    srem(key: string, ...members: Array<string | number>): Promise<number> {
        return this.client.srem(key, ...members);
    }

    smembers(key: string): Promise<string[]> {
        return this.client.smembers(key);
    }

    async onModuleDestroy() {
        await this.client.quit();
    }
}