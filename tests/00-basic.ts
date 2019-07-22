import * as nock from 'nock';
import {Connection} from "../src";
import {test} from "./_utils";

test.afterEach(() => nock.restore());

test.serial("do request", async t => {
    let connection = t.context.injector.get(Connection);
    let x = await connection.database().admin.statistics.get({json: true});
    t.is(typeof x, 'object');
});

test.serial("create document, update and delete", async (t) => {
    let db = t.context.injector.get(Connection).database();
    let result = await db.api.collection.post({
        json: true, body: {
            name: 'testing'
        }
    });
    t.log(result);
    result = await db.api.collection.collectionName("testing").count.get();
    t.log(result);
    result = await db.api.collection.collectionName("testing").delete();
    t.log(result);
});
