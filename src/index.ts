import {BaseConnection} from "./basics";
import {DbDatabase} from "./generated";

export class Connection extends BaseConnection{
    database(databaseName?: string): DbDatabase {
        return new DbDatabase({
            params: {},
            database: databaseName,
            connection: this
        })
    }
}
