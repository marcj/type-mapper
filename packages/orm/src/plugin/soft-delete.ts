import { AsyncEventSubscription, ClassType } from "@deepkit/core";
import { ClassSchema, getClassSchema, t } from "@deepkit/type";
import { Entity } from "../type";
import { Database, DatabaseAdapter } from "../database";
import { GenericQuery } from "../query";
import { DatabaseSession } from "src/database-session";

interface SoftDeleteEntity extends Entity {
    deletedAt?: Date;
    deletedBy?: any;
}

const deletedAtName = 'deletedAt';

export class SoftDeleteSession {
    protected deletedBy = new Map<ClassSchema, any>();
    protected restoreItems: SoftDeleteEntity[] = [];

    constructor(protected session: DatabaseSession<any>) {
        session.unitOfWorkEmitter.onDeletePre.subscribe(event => {
            const deletedBy = this.deletedBy.get(event.classSchema);
            if (!deletedBy) return;
            for (const item of event.items) {
                item.deletedBy = deletedBy;
            }
        });

        session.unitOfWorkEmitter.onCommitPre.subscribe(event => {
            for (const item of this.restoreItems) {
                item.deletedAt = undefined;
                item.deletedBy = undefined;
            }

            event.databaseSession.add(...this.restoreItems);
            this.restoreItems.length = 0;
        });
    }

    setDeletedBy<T extends SoftDeleteEntity>(classType: ClassType<T> | ClassSchema<T>, deletedBy: T['deletedBy']): this {
        this.deletedBy.set(getClassSchema(classType), deletedBy);
        return this;
    }

    restore<T extends SoftDeleteEntity>(item: T): this {
        this.restoreItems.push(item);
        return this;
    }
}

export class SoftDeleteQuery<T extends SoftDeleteEntity> extends GenericQuery<T> {
    includeSoftDeleted: boolean = false;
    setDeletedBy?: T['deletedBy'];

    clone(): this {
        const c = super.clone();
        c.includeSoftDeleted = this.includeSoftDeleted;
        c.setDeletedBy = this.setDeletedBy;
        return c;
    }

    /**
     * Enables fetching, updating, and deleting of soft-deleted records.
     */
    withSoftDeleted(): this {
        const m = this.clone();
        m.includeSoftDeleted = true;
        return m;
    }

    deletedBy(value: T['deletedBy']): this {
        const c = this.clone();
        c.setDeletedBy = value;
        return c;
    }

    async restoreOne() {
        const patch = { [deletedAtName]: undefined } as Partial<T>;
        if (this.classSchema.hasProperty('deletedBy')) patch['deletedBy'] = undefined;
        await this.withSoftDeleted().patchOne(patch);
    }

    async restoreMany() {
        const patch = { [deletedAtName]: undefined } as Partial<T>;
        if (this.classSchema.hasProperty('deletedBy')) patch['deletedBy'] = undefined;
        await this.withSoftDeleted().patchMany(patch);
    }

    async hardDeleteOne() {
        await this.withSoftDeleted().deleteOne();
    }

    async hardDeleteMany() {
        await this.withSoftDeleted().deleteMany();
    }
}

export class SoftDelete {
    protected listeners = new Map<ClassSchema, {
        queryFetch: AsyncEventSubscription, queryPatch: AsyncEventSubscription,
        queryDelete: AsyncEventSubscription, uowDelete: AsyncEventSubscription
    }>();

    constructor(protected database: Database<DatabaseAdapter>) {
    }

    enable<T extends SoftDeleteEntity>(...classSchemaOrTypes: (ClassSchema<T> | ClassType<T>)[]) {
        for (const type of classSchemaOrTypes) this.enableForSchema(type);
    }

    disable(...classSchemaOrTypes: (ClassSchema | ClassType)[]) {
        for (const type of classSchemaOrTypes) this.disableForSchema(type);
    }

    protected disableForSchema(classSchemaOrType: ClassSchema | ClassType) {
        const schema = getClassSchema(classSchemaOrType);
        const listener = this.listeners.get(schema);
        if (listener) {
            listener.queryFetch.unsubscribe();
            listener.queryPatch.unsubscribe();
            listener.queryDelete.unsubscribe();
            listener.uowDelete.unsubscribe();
            this.listeners.delete(schema);
        }
    }

    protected enableForSchema<T extends SoftDeleteEntity>(classSchemaOrType: ClassSchema<T> | ClassType<T>) {
        const schema = getClassSchema(classSchemaOrType);
        const hasDeletedBy = schema.hasProperty('deletedBy');

        if (!schema.hasProperty(deletedAtName)) {
            throw new Error(`Entity ${schema.getClassName()} has no ${deletedAtName} property. Please define one as type '${deletedAtName}: t.date.optional'`);
        }

        function queryFilter(event: { classSchema: ClassSchema, query: GenericQuery<any> }) {
            //this is for each query method: count, find, findOne(), etc.

            //we don't change SoftDeleteQuery instances as they operate on the raw records without filter
            if (event.query instanceof SoftDeleteQuery && event.query.includeSoftDeleted === true) return;

            if (event.classSchema !== schema) return; //do nothing

            //attach the filter to exclude deleted records
            event.query = event.query.addFilter(deletedAtName, undefined);
        }

        const queryFetch = this.database.queryEvents.onFetch.subscribe(queryFilter);
        const queryPatch = this.database.queryEvents.onPatchPre.subscribe(queryFilter);

        const queryDelete = this.database.queryEvents.onDeletePre.subscribe(async event => {
            if (event.classSchema !== schema) return; //do nothing

            //we don't change SoftDeleteQuery instances as they operate on the raw records without filter
            if (event.query instanceof SoftDeleteQuery && event.query.includeSoftDeleted === true) return;

            //stop actual query delete query
            event.stop();

            const patch = { [deletedAtName]: new Date } as Partial<T>;
            if (hasDeletedBy && event.query instanceof SoftDeleteQuery && event.query.setDeletedBy !== undefined) {
                patch.deletedBy = event.query.setDeletedBy;
            }

            await event.query.patchMany(patch);
        });

        const uowDelete = this.database.unitOfWorkEvents.onDeletePre.subscribe(async event => {
            if (event.classSchema !== schema) return; //do nothing

            //stop actual query delete query
            event.stop();

            //instead of removing, we move it into the current session (creating a new SessionRound)
            //to let the current commit know we want to rather update it, instead of deleting.
            for (const item of event.items) {
                item[deletedAtName] = new Date;
            }

            //this creates a new SessionRound, and commits automatically once the current is done (in the same transaction).
            event.databaseSession.add(...event.items);
        });

        this.listeners.set(schema, { queryFetch, queryPatch, queryDelete, uowDelete });
    }
}