import * as got from 'got';
import {GotInstance, GotJSONOptions} from "got";
import {GotJSONFn} from "got";

export interface ConnectionOptions {
    auth?: {
        username: string;
        password?: string;
    }
}

export class Connection {
    public got: GotInstance<GotJSONFn>;

    constructor(protected options: ConnectionOptions) {
        let gotOptions: GotJSONOptions = {
            json: true,
        };
        if (options.auth) {
            gotOptions.auth = `${options.auth.username}:${options.auth.password}`;
        }
        this.got = got.extend(gotOptions);
    }
}

export interface Context {
    connection: Connection;
    params: any;
    database?: string;
}

export abstract class ApiNode{
    constructor(protected _options: Context) {
    }
}

export abstract class Endpoint {
    protected abstract _path: string;
    _got: GotInstance<GotJSONFn>;
    constructor(protected _options: Context) {
        this._got = _options.connection.got;
    }

}
