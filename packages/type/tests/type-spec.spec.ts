import { ClassType } from '@deepkit/core';
import { expect, test } from '@jest/globals';
import 'reflect-metadata';
import { t } from '../src/decorators';
import { FieldDecoratorResult, isFieldDecorator } from '../src/field-decorator';
import { jsonSerializer } from '../src/json-serializer';
import { ClassSchema, getClassSchema } from '../src/model';

/**
 * When the value is not existent anymore (don't confuse with being undefined.).
 * Equal to check with `in`.
*/
export const RoundTripNoValue: unique symbol = Symbol('NoValue');

export function roundTrip<T>(s: ClassSchema<T> | ClassType<T> | FieldDecoratorResult<T>, value: T): T {
    if (isFieldDecorator(s)) {
        const wrapped = t.schema({ v: s });
        const serializer = jsonSerializer.for(wrapped);
        const json = serializer.serialize({ v: value } as any);
        const item = serializer.deserialize(json);
        if ('v' in item) return (item as any).v;
        return RoundTripNoValue as any;
    } else {
        const serializer = jsonSerializer.for(s);
        const json = serializer.serialize(value);
        const item = serializer.deserialize(json);
        return item as any;
    }
}

export function serializeToJson<T>(s: ClassSchema<T> | ClassType<T> | FieldDecoratorResult<T>, value: T): T {
    if (isFieldDecorator(s)) {
        const wrapped = t.schema({ v: s });
        const serializer = jsonSerializer.for(wrapped);
        const json = serializer.serialize({ v: value } as any);
        return json.v;
    } else {
        const serializer = jsonSerializer.for(s);
        const json = serializer.serialize(value);
        return json;
    }
}

export function deserializeFromJson<T>(s: ClassSchema<T> | ClassType<T> | FieldDecoratorResult<T>, value: T): T {
    if (isFieldDecorator(s)) {
        const wrapped = t.schema({ v: s });
        const serializer = jsonSerializer.for(wrapped);
        const json = serializer.deserialize({ v: value } as any) as any;
        return json.v;
    } else {
        const serializer = jsonSerializer.for(s);
        const json = serializer.deserialize(value);
        return json;
    }
}

enum MyEnum {
    a, b, c
}

class Config {
    @t color: string = '#fff';
    @t big: boolean = false;
}

class Model {
    @t id: number = 0;
    @t title: string = '';

    @t config?: Config;
}

test('basics with value', () => {
    expect(roundTrip(t.string, 'asd')).toBe('asd');
    expect(roundTrip(t.number, 22)).toBe(22);
    expect(roundTrip(t.boolean, false)).toBe(false);
    expect(roundTrip(t.date, new Date)).toBeInstanceOf(Date);
});

test('model', () => {
    {
        const item = new Model;
        item.id = 23;
        item.title = '2322';
        const back = roundTrip(Model, item);
        expect(back).toEqual({ id: 23, title: '2322' });
        expect(back).toBeInstanceOf(Model);
    }
});

test('with implicit default value', () => {
    const defaultDate = new Date;

    class Product {
        @t id: number = 0;

        @t created: Date = defaultDate;
    }

    //having a default value doesn't mean we are optional;
    expect(getClassSchema(Product).getProperty('created').isOptional).toBe(false);

    expect(roundTrip(Product, { id: 23 } as any)).toEqual({ id: 23, created: defaultDate });
    expect(roundTrip(Product, { id: 23, created: undefined } as any)).toEqual({ id: 23, created: defaultDate });

    expect(roundTrip(t.partial(Product), { id: 23 } as any)).toEqual({ id: 23 });
    expect(roundTrip(t.partial(Product), { id: 23, created: undefined } as any)).toEqual({ id: 23 });

    //not set properties are ommited
    expect('created' in roundTrip(t.partial(Product), { id: 23 } as any)).toEqual(false);

    //we need to keep undefined values otherwise there is not way to reset a value
    //for JSON/BSON on the transport layer is null used to communicate the fact that we set explictely `created` to undefined
    expect('created' in roundTrip(t.partial(Product), { id: 23, created: undefined } as any)).toEqual(true);
});

test('t.schema', () => {
    {
        const s = t.schema({ type: t.literal('m'), name: t.string });
        const item = roundTrip(s, { type: 'm' as 'm', name: 'peter' });
        expect(item).toEqual({ type: 'm', name: 'peter' });
        expect(item).toBeInstanceOf(s.classType);
    }
});

test('partial keeps explicitely undefined fields', () => {
    expect(roundTrip(t.partial(Model), {})).toEqual({});
    expect('name' in roundTrip(t.partial(Model), {})).toBe(false);
    expect(roundTrip(t.partial(Model), { title: undefined })).toEqual({ title: undefined });

    {
        const item = roundTrip(t.partial(Model), { title: undefined });
        expect('title' in item).toBe(true); //all fields in partial become optional
    }

    {
        const item = roundTrip(t.partial(Model), {});
        expect('title' in item).toBe(false);
    }

    class Purchase {
        @t.primary.autoIncrement id: number = 0;

        @t sentAt?: Date;
        @t canceledAt?: Date;
    }

    expect(roundTrip(t.partial(Purchase), { sentAt: undefined })).toEqual({ sentAt: undefined });
    expect('sentAt' in roundTrip(t.partial(Purchase), { sentAt: undefined })).toEqual(true);

});

test('map removes undefined when not allowed', () => {
    expect(roundTrip(t.map(t.string), {})).toEqual({});
    expect(roundTrip(t.map(t.string), { foo: 'bar' })).toEqual({ foo: 'bar' });
    expect(roundTrip(t.map(t.string), { foo: undefined } as any)).toEqual({});
    expect('foo' in roundTrip(t.map(t.string), { foo: undefined } as any)).toEqual(false);
});

test('map allows undefined when allowed', () => {
    expect(roundTrip(t.map(t.string.optional), {})).toEqual({});
    expect(roundTrip(t.map(t.string.optional), { foo: 'bar' })).toEqual({ foo: 'bar' });
    expect(roundTrip(t.map(t.string.optional), { foo: undefined } as any)).toEqual({ foo: undefined });
    expect('foo' in roundTrip(t.map(t.string.optional), { foo: undefined } as any)).toEqual(true);
});

test('union basics', () => {
    expect(roundTrip(t.union(t.string, t.number), 'asd')).toEqual('asd');
    expect(roundTrip(t.union(t.string, t.number), 23)).toEqual(23);

    expect(roundTrip(t.union(t.boolean, t.number), true)).toEqual(true);
    expect(roundTrip(t.union(t.boolean, t.number), 23)).toEqual(23);

    expect(roundTrip(t.union(t.string, Model), new Model)).toBeInstanceOf(Model);
    {
        const item = new Model;
        item.id = 23;
        item.title = '23';
        const back = roundTrip(t.union(t.string, Model), item);
        expect(back).toEqual({ id: 23, title: '23' });
    }

    {
        const item = new Model;
        item.id = 23;
        item.title = '23';
        const back = roundTrip(t.union(Model), item);
        expect(back).toEqual({ id: 23, title: '23' });
    }

    expect(roundTrip(t.union(t.string, Model), 'asd')).toEqual('asd');

    expect(roundTrip(t.union(t.string, Model).optional, undefined)).toEqual(undefined);
    expect(roundTrip(t.union(t.string, Model).optional, null)).toEqual(undefined);

    expect(roundTrip(t.union(t.string, Model).nullable, undefined)).toEqual(null);
    expect(roundTrip(t.union(t.string, Model).nullable, null)).toEqual(null);
});

test('union 2', () => {
    const s = t.schema({ type: t.literal('m'), name: t.string });

    expect(deserializeFromJson(t.union(s), { type: 'm', name: 'Peter' })).toEqual({ type: 'm', name: 'Peter' });
    expect(deserializeFromJson(t.union(s), { name: 'Peter' } as any)).toEqual({ type: 'm', name: 'Peter' });

    expect(serializeToJson(t.union(s), { type: 'm', name: 'Peter' })).toEqual({ type: 'm', name: 'Peter' });
    expect(serializeToJson(t.union(s), { name: 'Peter' } as any)).toEqual({ type: 'm', name: 'Peter' });

    expect(roundTrip(t.union(s), { type: 'm', name: 'Peter' })).toEqual({ type: 'm', name: 'Peter' });
    expect(roundTrip(t.union(s), { name: 'Peter' } as any)).toEqual({ type: 'm', name: 'Peter' });
});

test('union 3', () => {
    expect(roundTrip(t.union(t.string, Model), 'asd')).toBe('asd');
    expect(roundTrip(t.union(t.string, Model), {title: 'foo'} as any)).toBeInstanceOf(Model);

    expect(deserializeFromJson(t.union(t.string, Model), 'asd')).toBe('asd');
    expect(deserializeFromJson(t.union(t.string, Model), {title: 'foo'} as any)).toEqual({id: 0, title: 'foo'});

    expect(deserializeFromJson(t.union(t.string, Model).optional, undefined)).toBe(undefined);
    expect(deserializeFromJson(t.union(t.string, Model).nullable, null)).toBe(null);

    expect(serializeToJson(t.union(t.string, Model), 'asd')).toBe('asd');
    expect(serializeToJson(t.union(t.string, Model), {title: 'foo'} as any)).toEqual({title: 'foo'});

    expect(serializeToJson(t.union(t.string, Model).optional, undefined)).toBe(null);
    expect(serializeToJson(t.union(t.string, Model).nullable, null)).toBe(null);
});

test('explicitely set undefined on optional triggers default value', () => {
    class Product {
        @t id: number = 0;
        @t.optional created?: Date = new Date;
    }

    //no value means the default triggers
    expect(roundTrip(Product, { id: 23 }).created).toBeInstanceOf(Date);

    //this is important for database patches
    expect(roundTrip(Product, { id: 23, created: undefined }).created).toBe(undefined);
    expect('created' in roundTrip(Product, { id: 23, created: undefined })).toBe(true);
});

test('partial explicitely set undefined on optional is handled', () => {
    class Product {
        @t id: number = 0;
        @t.optional created?: Date = new Date;
    }

    //no value means the default triggers
    expect(roundTrip(t.partial(Product), { id: 23 }).created).toBe(undefined);

    //this is important for database patches
    expect(roundTrip(t.partial(Product), { id: 23, created: undefined }).created).toBe(undefined);
    expect('created' in roundTrip(t.partial(Product), { id: 23, created: undefined })).toBe(true);
});

test('partial explicitely set undefined on required is not ignored', () => {
    class Product {
        @t id: number = 0;
        @t created: Date = new Date;
    }

    //no value means the default triggers
    expect(roundTrip(t.partial(Product), { id: 23 }).created).toBe(undefined);

    //this is important for database patches
    //important to keep undefined, as t.partial() makes all properties optional, no matter what it originally was, otherwise it would be a partial
    expect(roundTrip(t.partial(Product), { id: 23, created: undefined }).created).toBe(undefined);
    expect('created' in roundTrip(t.partial(Product), { id: 23, created: undefined } as any)).toBe(true);
});

test('explicitely set undefined on required is ignored', () => {
    class Product {
        @t id: number = 0;
        @t created: Date = new Date;
    }

    expect(roundTrip(Product, { id: 23 } as any).created).toBeInstanceOf(Date);
    expect(roundTrip(Product, { id: 23, created: undefined } as any).created).toBeInstanceOf(Date);
});

test('partial does not return the model on root', () => {
    expect(roundTrip(t.partial(Model), { id: 23 } as any)).toEqual({ id: 23 });
    expect(roundTrip(t.partial(Model), { id: 23 } as any)).not.toBeInstanceOf(Model);
});

test('partial returns the model at second level', () => {
    const config = new Config;
    config.color = 'red';

    expect(roundTrip(t.partial(Model), { id: 23, config: config } as any)).toEqual({
        id: 23,
        config: { big: false, color: 'red' }
    });
    expect(roundTrip(t.partial(Model), { id: 23, config: config } as any).config).toBeInstanceOf(Config);
});

test('partial allowed undefined', () => {
    class Product {
        @t id: number = 0;
        @t created?: Date;
    }

    expect(roundTrip(t.partial(Product), { id: 23, created: undefined } as any)).not.toBeInstanceOf(Product);

    expect(roundTrip(t.partial(Product), { id: 23 } as any).created).toBe(undefined);
    expect('created' in roundTrip(t.partial(Product), { id: 23 } as any)).toBe(false);

    //important for databas epatches
    expect(roundTrip(t.partial(Product), { id: 23, created: undefined } as any).created).toBe(undefined);
    expect('created' in roundTrip(t.partial(Product), { id: 23, created: undefined } as any)).toBe(true);
})

test('optional basics', () => {
    expect(roundTrip(t.string.optional, undefined)).toBe(undefined);
    expect(roundTrip(t.string.optional, null)).toBe(undefined);

    expect(roundTrip(t.number.optional, undefined)).toBe(undefined);
    expect(roundTrip(t.number.optional, null)).toBe(undefined);

    expect(roundTrip(t.boolean.optional, undefined)).toBe(undefined);
    expect(roundTrip(t.boolean.optional, null)).toBe(undefined);

    expect(roundTrip(t.uuid.optional, undefined)).toBe(undefined);
    expect(roundTrip(t.uuid.optional, null)).toBe(undefined);

    expect(roundTrip(t.mongoId.optional, undefined)).toBe(undefined);
    expect(roundTrip(t.mongoId.optional, null)).toBe(undefined);

    expect(roundTrip(t.date.optional, undefined)).toBe(undefined);
    expect(roundTrip(t.date.optional, null)).toBe(undefined);

    expect(roundTrip(t.map(t.any).optional, undefined)).toBe(undefined);
    expect(roundTrip(t.map(t.any).optional, null)).toBe(undefined);

    expect(roundTrip(t.array(t.any).optional, undefined)).toBe(undefined);
    expect(roundTrip(t.array(t.any).optional, null)).toBe(undefined);

    expect(roundTrip(t.partial({ a: t.string }).optional, undefined)).toBe(undefined);
    expect(roundTrip(t.partial({ a: t.string }).optional, null)).toBe(undefined);

    // expect(roundTrip(t.patch({a: t.string}).optional, undefined)).toBe(undefined);
    // expect(roundTrip(t.patch({a: t.string}).optional, null)).toBe(undefined);

    expect(roundTrip(t.union(t.string).optional, undefined)).toBe(undefined);
    expect(roundTrip(t.union(t.string).optional, null)).toBe(undefined);

    expect(roundTrip(t.literal('a').optional, undefined)).toBe(undefined);
    expect(roundTrip(t.literal('a').optional, null)).toBe(undefined);

    expect(roundTrip(t.enum(MyEnum).optional, undefined)).toBe(undefined);
    expect(roundTrip(t.enum(MyEnum).optional, null)).toBe(undefined);

    expect(roundTrip(t.type(Model).optional, undefined)).toBe(undefined);
    expect(roundTrip(t.type(Model).optional, null)).toBe(undefined);

    expect(roundTrip(t.type(ArrayBuffer).optional, undefined)).toBe(undefined);
    expect(roundTrip(t.type(ArrayBuffer).optional, null)).toBe(undefined);

    expect(roundTrip(t.type(Uint8Array).optional, undefined)).toBe(undefined);
    expect(roundTrip(t.type(Uint8Array).optional, null)).toBe(undefined);
});

test('nullable container', () => {
    const s = t.schema({
        tags: t.array(t.string).nullable,
        tagMap: t.map(t.string).nullable,
        tagPartial: t.partial({ name: t.string }).nullable,
    });

    expect(roundTrip(s, { tags: null, tagMap: null, tagPartial: null })).toEqual({ tags: null, tagMap: null, tagPartial: null });
    expect(roundTrip(s, {} as any)).toEqual({ tags: null, tagMap: null, tagPartial: null });

    expect(serializeToJson(s, {} as any)).toEqual({ tags: null, tagMap: null, tagPartial: null });
});

test('map serializes default', () => {
    const defaultMap = {};
    expect(serializeToJson(t.map(t.any).optional.default(defaultMap), undefined)).not.toBe(defaultMap);
    expect(serializeToJson(t.map(t.any).optional.default(defaultMap), undefined)).toBeInstanceOf(Object);

    expect(serializeToJson(t.map(t.any).optional.default(defaultMap), null)).toBeInstanceOf(Object);
    expect(serializeToJson(t.map(t.any).optional.default(defaultMap), null)).not.toBe(defaultMap);
});

test('serialize default', () => {
    expect(serializeToJson(t.string.optional.default('123'), undefined)).toBe('123');
    expect(serializeToJson(t.string.optional.default('123'), null)).toBe('123');

    expect(serializeToJson(t.number.optional.default(123), undefined)).toBe(123);
    expect(serializeToJson(t.number.optional.default(123), null)).toBe(123);

    expect(serializeToJson(t.boolean.optional.default(false), undefined)).toBe(false);
    expect(serializeToJson(t.boolean.optional.default(false), null)).toBe(false);

    expect(serializeToJson(t.uuid.optional.default('5c58e474-82ad-4e92-ad9f-487bbc11e8ed'), undefined)).toBe('5c58e474-82ad-4e92-ad9f-487bbc11e8ed');
    expect(serializeToJson(t.uuid.optional.default('5c58e474-82ad-4e92-ad9f-487bbc11e8ed'), null)).toBe('5c58e474-82ad-4e92-ad9f-487bbc11e8ed');

    expect(serializeToJson(t.mongoId.optional.default('507f1f77bcf86cd799439011'), undefined)).toBe('507f1f77bcf86cd799439011');
    expect(serializeToJson(t.mongoId.optional.default('507f1f77bcf86cd799439011'), null)).toBe('507f1f77bcf86cd799439011');

    expect(serializeToJson(t.date.optional.default(new Date), undefined)).toBeInstanceOf(Date);
    expect(serializeToJson(t.date.optional.default(new Date), null)).toBeInstanceOf(Date);

    const defaultMap = {};
    expect(serializeToJson(t.map(t.any).optional.default(defaultMap), undefined)).not.toBe(defaultMap);
    expect(serializeToJson(t.map(t.any).optional.default(defaultMap), undefined)).toBeInstanceOf(Object);
    expect(serializeToJson(t.map(t.any).optional.default(defaultMap), null)).toBeInstanceOf(Object);
    expect(serializeToJson(t.map(t.any).optional.default(defaultMap), null)).not.toBe(defaultMap);

    const defaultArray: any[] = [];
    expect(serializeToJson(t.array(t.any).optional.default(defaultArray), undefined)).not.toBe(defaultArray);
    expect(serializeToJson(t.array(t.any).optional.default(defaultArray), undefined)).toBeInstanceOf(Array);
    expect(serializeToJson(t.array(t.any).optional.default(defaultArray), null)).toBeInstanceOf(Array);
    expect(serializeToJson(t.array(t.any).optional.default(defaultArray), null)).not.toBe(defaultArray);

    expect(serializeToJson(t.partial({ a: t.string }).optional.default(defaultMap), undefined)).not.toBe(defaultMap);
    expect(serializeToJson(t.partial({ a: t.string }).optional.default(defaultMap), undefined)).toBeInstanceOf(Object);
    expect(serializeToJson(t.partial({ a: t.string }).optional.default(defaultMap), null)).not.toBe(defaultMap);
    expect(serializeToJson(t.partial({ a: t.string }).optional.default(defaultMap), null)).toBeInstanceOf(Object);

    expect(serializeToJson(t.union(t.string).optional.default('asd'), undefined)).toBe('asd');
    expect(serializeToJson(t.union(t.string).optional.default('asd'), null)).toBe('asd');

    expect(serializeToJson(t.literal('a').optional.default('a'), undefined)).toBe('a');
    expect(serializeToJson(t.literal('a').optional.default('a'), null)).toBe('a');

    expect(serializeToJson(t.enum(MyEnum).optional.default(MyEnum.b), undefined)).toBe(MyEnum.b);
    expect(serializeToJson(t.enum(MyEnum).optional.default(MyEnum.b), null)).toBe(MyEnum.b);

    expect(serializeToJson(t.type(Model).optional.default(() => new Model), undefined)).toBeInstanceOf(Object);
    expect(serializeToJson(t.type(Model).optional.default(() => new Model), null)).toBeInstanceOf(Object);
});

test('deserialize default', () => {
    expect(deserializeFromJson(t.string.optional.default('123'), undefined)).toBe('123');
    expect(deserializeFromJson(t.string.optional.default('123'), null)).toBe('123');

    expect(deserializeFromJson(t.number.optional.default(123), undefined)).toBe(123);
    expect(deserializeFromJson(t.number.optional.default(123), null)).toBe(123);

    expect(deserializeFromJson(t.boolean.optional.default(false), undefined)).toBe(false);
    expect(deserializeFromJson(t.boolean.optional.default(false), null)).toBe(false);

    expect(deserializeFromJson(t.uuid.optional.default('5c58e474-82ad-4e92-ad9f-487bbc11e8ed'), undefined)).toBe('5c58e474-82ad-4e92-ad9f-487bbc11e8ed');
    expect(deserializeFromJson(t.uuid.optional.default('5c58e474-82ad-4e92-ad9f-487bbc11e8ed'), null)).toBe('5c58e474-82ad-4e92-ad9f-487bbc11e8ed');

    expect(deserializeFromJson(t.mongoId.optional.default('507f1f77bcf86cd799439011'), undefined)).toBe('507f1f77bcf86cd799439011');
    expect(deserializeFromJson(t.mongoId.optional.default('507f1f77bcf86cd799439011'), null)).toBe('507f1f77bcf86cd799439011');

    expect(deserializeFromJson(t.date.optional.default(new Date), undefined)).toBeInstanceOf(Date);
    expect(deserializeFromJson(t.date.optional.default(new Date), null)).toBeInstanceOf(Date);

    const defaultMap = {};
    expect(deserializeFromJson(t.map(t.any).optional.default(defaultMap), undefined)).not.toBe(defaultMap);
    expect(deserializeFromJson(t.map(t.any).optional.default(defaultMap), undefined)).toBeInstanceOf(Object);
    expect(deserializeFromJson(t.map(t.any).optional.default(defaultMap), null)).toBeInstanceOf(Object);
    expect(deserializeFromJson(t.map(t.any).optional.default(defaultMap), null)).not.toBe(defaultMap);

    const defaultArray: any[] = [];
    expect(deserializeFromJson(t.array(t.any).optional.default(defaultArray), undefined)).not.toBe(defaultArray);
    expect(deserializeFromJson(t.array(t.any).optional.default(defaultArray), undefined)).toBeInstanceOf(Array);
    expect(deserializeFromJson(t.array(t.any).optional.default(defaultArray), null)).toBeInstanceOf(Array);
    expect(deserializeFromJson(t.array(t.any).optional.default(defaultArray), null)).not.toBe(defaultArray);

    expect(deserializeFromJson(t.partial({ a: t.string }).optional.default(defaultMap), undefined)).not.toBe(defaultMap);
    expect(deserializeFromJson(t.partial({ a: t.string }).optional.default(defaultMap), undefined)).toBeInstanceOf(Object);
    expect(deserializeFromJson(t.partial({ a: t.string }).optional.default(defaultMap), null)).not.toBe(defaultMap);
    expect(deserializeFromJson(t.partial({ a: t.string }).optional.default(defaultMap), null)).toBeInstanceOf(Object);

    expect(deserializeFromJson(t.union(t.string).optional.default('asd'), undefined)).toBe('asd');
    expect(deserializeFromJson(t.union(t.string).optional.default('asd'), null)).toBe('asd');

    expect(deserializeFromJson(t.literal('a').optional.default('a'), undefined)).toBe('a');
    expect(deserializeFromJson(t.literal('a').optional.default('a'), null)).toBe('a');

    expect(deserializeFromJson(t.enum(MyEnum).optional.default(MyEnum.b), undefined)).toBe(MyEnum.b);
    expect(deserializeFromJson(t.enum(MyEnum).optional.default(MyEnum.b), null)).toBe(MyEnum.b);

    const defaultModel = new Model;
    expect(deserializeFromJson(t.type(Model).optional.default(() => new Model), undefined)).not.toBe(defaultModel);
    expect(deserializeFromJson(t.type(Model).optional.default(() => new Model), undefined)).toBeInstanceOf(Model);
    expect(deserializeFromJson(t.type(Model).optional.default(() => new Model), null)).not.toBe(defaultModel);
    expect(deserializeFromJson(t.type(Model).optional.default(() => new Model), null)).toBeInstanceOf(Model);
});

test('default basics', () => {
    expect(roundTrip(t.string.optional.default('123'), undefined)).toBe('123');
    expect(roundTrip(t.string.optional.default('123'), null)).toBe('123');

    expect(roundTrip(t.number.optional.default(123), undefined)).toBe(123);
    expect(roundTrip(t.number.optional.default(123), null)).toBe(123);

    expect(roundTrip(t.boolean.optional.default(false), undefined)).toBe(false);
    expect(roundTrip(t.boolean.optional.default(false), null)).toBe(false);

    expect(roundTrip(t.uuid.optional.default('5c58e474-82ad-4e92-ad9f-487bbc11e8ed'), undefined)).toBe('5c58e474-82ad-4e92-ad9f-487bbc11e8ed');
    expect(roundTrip(t.uuid.optional.default('5c58e474-82ad-4e92-ad9f-487bbc11e8ed'), null)).toBe('5c58e474-82ad-4e92-ad9f-487bbc11e8ed');

    expect(roundTrip(t.mongoId.optional.default('507f1f77bcf86cd799439011'), undefined)).toBe('507f1f77bcf86cd799439011');
    expect(roundTrip(t.mongoId.optional.default('507f1f77bcf86cd799439011'), null)).toBe('507f1f77bcf86cd799439011');

    expect(roundTrip(t.date.optional.default(new Date), undefined)).toBeInstanceOf(Date);
    expect(roundTrip(t.date.optional.default(new Date), null)).toBeInstanceOf(Date);

    const defaultMap = {};
    expect(roundTrip(t.map(t.any).optional.default(defaultMap), undefined)).not.toBe(defaultMap);
    expect(roundTrip(t.map(t.any).optional.default(defaultMap), undefined)).toBeInstanceOf(Object);
    expect(roundTrip(t.map(t.any).optional.default(defaultMap), null)).toBeInstanceOf(Object);
    expect(roundTrip(t.map(t.any).optional.default(defaultMap), null)).not.toBe(defaultMap);

    const defaultArray: any[] = [];
    expect(roundTrip(t.array(t.any).optional.default(defaultArray), undefined)).not.toBe(defaultArray);
    expect(roundTrip(t.array(t.any).optional.default(defaultArray), undefined)).toBeInstanceOf(Array);
    expect(roundTrip(t.array(t.any).optional.default(defaultArray), null)).toBeInstanceOf(Array);
    expect(roundTrip(t.array(t.any).optional.default(defaultArray), null)).not.toBe(defaultArray);

    expect(roundTrip(t.partial({ a: t.string }).optional.default(defaultMap), undefined)).not.toBe(defaultMap);
    expect(roundTrip(t.partial({ a: t.string }).optional.default(defaultMap), undefined)).toBeInstanceOf(Object);
    expect(roundTrip(t.partial({ a: t.string }).optional.default(defaultMap), null)).not.toBe(defaultMap);
    expect(roundTrip(t.partial({ a: t.string }).optional.default(defaultMap), null)).toBeInstanceOf(Object);

    expect(roundTrip(t.union(t.string).optional.default('asd'), undefined)).toBe('asd');
    expect(roundTrip(t.union(t.string).optional.default('asd'), null)).toBe('asd');

    expect(roundTrip(t.literal('a').optional.default('a'), undefined)).toBe('a');
    expect(roundTrip(t.literal('a').optional.default('a'), null)).toBe('a');

    expect(roundTrip(t.enum(MyEnum).optional.default(MyEnum.b), undefined)).toBe(MyEnum.b);
    expect(roundTrip(t.enum(MyEnum).optional.default(MyEnum.b), null)).toBe(MyEnum.b);

    const defaultModel = new Model;
    expect(roundTrip(t.type(Model).optional.default(defaultModel), undefined)).not.toBe(defaultModel);
    expect(roundTrip(t.type(Model).optional.default(defaultModel), undefined)).toBeInstanceOf(Model);
    expect(roundTrip(t.type(Model).optional.default(defaultModel), null)).not.toBe(defaultModel);
    expect(roundTrip(t.type(Model).optional.default(defaultModel), null)).toBeInstanceOf(Model);
});

test('nullable basics', () => {
    expect(roundTrip(t.string.nullable, undefined)).toBe(null);
    expect(roundTrip(t.string.nullable, null)).toBe(null);

    expect(roundTrip(t.number.nullable, undefined)).toBe(null);
    expect(roundTrip(t.number.nullable, null)).toBe(null);

    expect(roundTrip(t.boolean.nullable, undefined)).toBe(null);
    expect(roundTrip(t.boolean.nullable, null)).toBe(null);

    expect(roundTrip(t.date.nullable, undefined)).toBe(null);
    expect(roundTrip(t.date.nullable, null)).toBe(null);

    expect(roundTrip(t.uuid.nullable, undefined)).toBe(null);
    expect(roundTrip(t.uuid.nullable, null)).toBe(null);

    expect(roundTrip(t.mongoId.nullable, undefined)).toBe(null);
    expect(roundTrip(t.mongoId.nullable, null)).toBe(null);

    expect(roundTrip(t.map(t.any).nullable, undefined)).toBe(null);
    expect(roundTrip(t.map(t.any).nullable, null)).toBe(null);

    expect(roundTrip(t.array(t.any).nullable, undefined)).toBe(null);
    expect(roundTrip(t.array(t.any).nullable, null)).toBe(null);

    expect(roundTrip(t.partial({ a: t.string }).nullable, undefined)).toBe(null);
    expect(roundTrip(t.partial({ a: t.string }).nullable, null)).toBe(null);

    expect(roundTrip(t.union(t.string).nullable, undefined)).toBe(null);
    expect(roundTrip(t.union(t.string).nullable, null)).toBe(null);

    expect(roundTrip(t.literal('a').nullable, undefined)).toBe('a');
    expect(roundTrip(t.literal('a').nullable, null)).toBe(null);

    expect(roundTrip(t.enum(MyEnum).nullable, undefined)).toBe(null);
    expect(roundTrip(t.enum(MyEnum).nullable, null)).toBe(null);

    expect(roundTrip(t.type(Model).nullable, undefined)).toBe(null);
    expect(roundTrip(t.type(Model).nullable, null)).toBe(null);

    expect(roundTrip(t.type(ArrayBuffer).nullable, undefined)).toBe(null);
    expect(roundTrip(t.type(ArrayBuffer).nullable, null)).toBe(null);

    expect(roundTrip(t.type(Uint8Array).nullable, undefined)).toBe(null);
    expect(roundTrip(t.type(Uint8Array).nullable, null)).toBe(null);
});

test('constructor argument', () => {
    class Product {
        @t id: number = 0;

        constructor(@t public title: string) {
        }
    }

    class Purchase {
        @t id: number = 0;

        constructor(@t public product: Product) {
        }
    }

    {
        const item = roundTrip(Purchase, { id: 4, product: new Product('asd') });
        expect(item.product).toBeInstanceOf(Product);
    }
})
