import 'reflect-metadata';
import { expect, test } from '@jest/globals';
import { t } from '@deepkit/type';
import { schemaMigrationRoundTrip } from '@deepkit/sql/dist/cjs/tests/setup';
import { MySQLDatabaseAdapter } from '../src/mysql-adapter';

test('mysql custom type', async () => {
    const post = t.schema({
        id: t.number.autoIncrement.primary,
        slug: t.string.mysql({ type: 'VARCHAR(255)' }),
        content: t.string,
    }, { name: 'post' });

    const adapter = new MySQLDatabaseAdapter({ host: 'localhost', user: 'root', database: 'default', password: process.env.MYSQL_PW });
    const [postTable] = adapter.platform.createTables([post]);
    expect(postTable.getColumn('slug').type).toBe('varchar');
    expect(postTable.getColumn('slug').size).toBe(255);

    await schemaMigrationRoundTrip([post], adapter);
});

const user = t.schema({
    id: t.number.autoIncrement.primary,
    username: t.string.index({ unique: true }),
    created: t.date,
    deleted: t.boolean,
    logins: t.number,
}, { name: 'user' });
user.addIndex(['deleted'], '', { unique: true });
user.addIndex(['deleted', 'created']);

const post = t.schema({
    id: t.number.autoIncrement.primary,
    user: t.type(user).reference(),
    created: t.date,
    slag: t.string.index({ unique: true }),
    title: t.string,
    content: t.string,
}, { name: 'post' });

test('mysql', async () => {
    await schemaMigrationRoundTrip([user, post], new MySQLDatabaseAdapter({ host: 'localhost', user: 'root', database: 'default', password: process.env.MYSQL_PW }));
});
