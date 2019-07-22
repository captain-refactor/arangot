import * as got from 'got';
import {GotBodyFn, GotInstance, GotOptions} from "got";
import {GotJSONFn} from "got";
import {HTTP_METHODS, HttpMethod} from "./http-methods";

export interface Context {
    connection: BaseConnection;
    params: any;
    database?: string;
}

export abstract class ApiNode {
    constructor(protected _options: Context) {
    }
}

function httpMethod(method: HttpMethod) {
    return async function (this: Endpoint, options?: Partial<got.GotJSONOptions>) {
        let path = this._path;
        if (this._options.database) path = `/_db/${this._options.database}${path}`;
        for (let param of Object.keys(this._options.params)) {
            path = path.replace(`{${param}}`, this._options.params[param]);
        }
        let result = await this.connection.got[method](path, options);
        return result.body
    }
}

export abstract class Endpoint {
    protected abstract _path: string;

    constructor(protected _options: Context) {
    }

    get connection(): BaseConnection {
        return this._options.connection;
    }
}

for (let method of HTTP_METHODS) {
    Endpoint.prototype[method] = httpMethod(method);
}

export interface LoginPasswordAuth {
    username: string;
    password?: string;
}

export interface TokenAuth {
    token: string
}

function isTokenAuth(auth: LoginPasswordAuth | TokenAuth): auth is TokenAuth {
    return !!(auth as any).token
}

export interface ConnectionOptions {
    auth?: LoginPasswordAuth | TokenAuth;
    url?:string;
}

export class BaseConnection {
    got: GotInstance<GotJSONFn | GotBodyFn<any>>;

    constructor(protected options: ConnectionOptions = {}) {
        let gotOptions: GotOptions<any> = {
            baseUrl: options.url || 'http://localhost:8529',
            headers:{}
        };
        let auth = options.auth;
        if (auth) {
            if (isTokenAuth(auth)) {
                gotOptions.headers!.Authorization = "Bearer " + auth.token;
            }else{
                gotOptions.auth = `${auth.username}:${auth.password}`;
            }
        }
        this.got = got.extend(gotOptions);
    }
}
