/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { BaseResponse, Command } from './command';
import { ClassSchema, ExtractClassType, getClassSchema, t } from '@deepkit/type';
import { ClassType, toFastProperties } from '@deepkit/core';
import { DEEP_SORT } from '../../query.model';

const findSchema = t.schema({
    find: t.string,
    $db: t.string,
    batchSize: t.number,
    limit: t.number,
    skip: t.number,
    filter: t.any,
    projection: t.any.optional,
    sort: t.any.optional,
});

export class FindCommand<T extends ClassSchema | ClassType> extends Command {

    constructor(
        public classSchema: T,
        public filter: { [name: string]: any } = {},
        public projection?: { [name: string]: 1 | 0 },
        public sort?: DEEP_SORT<any>,
        public limit: number = 0,
        public skip: number = 0,
    ) {
        super();
    }

    async execute(config): Promise<ExtractClassType<T>[]> {
        const schema = getClassSchema(this.classSchema);

        const cmd: InstanceType<typeof findSchema.classType> = {
            find: schema.collectionName || schema.name || 'unknown',
            $db: schema.databaseSchemaName || config.defaultDb || 'admin',
            filter: this.filter,
            limit: this.limit,
            skip: this.skip,
            batchSize: 1_000_000, //todo make configurable
        };

        if (this.projection) cmd.projection = this.projection;
        if (this.sort) cmd.sort = this.sort;

        const jit = schema.jit;
        let specialisedResponse = this.projection ? jit.mdbFindPartial : jit.mdbFind;
        if (!specialisedResponse) {
            if (this.projection) {
                specialisedResponse = t.extendSchema(BaseResponse, {
                    cursor: {
                        id: t.number,
                        firstBatch: t.array(t.partial(schema)),
                        nextBatch: t.array(t.partial(schema)),
                    },
                });
                jit.mdbFindPartial = specialisedResponse;
            } else {
                specialisedResponse = t.extendSchema(BaseResponse, {
                    cursor: {
                        id: t.number,
                        firstBatch: t.array(schema),
                        nextBatch: t.array(schema),
                    },
                });
                jit.mdbFind = specialisedResponse;
            }
            toFastProperties(jit);
        }

        const res = await this.sendAndWait(findSchema, cmd, specialisedResponse) as { cursor: { id: BigInt, firstBatch: any[], nextBatch: any[] } };
        //todo: implement fetchMore and decrease batchSize
        return res.cursor.firstBatch;
    }

    needsWritableHost(): boolean {
        return false;
    }
}
