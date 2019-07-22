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
    protected got: GotInstance<GotJSONFn>;

    constructor(protected options: ConnectionOptions) {
        let gotOptions: GotJSONOptions = {
            json: true,
        };
        if(options.auth){
            gotOptions.auth = `${options.auth.username}:${options.auth.password}`;
        }
        this.got = got.extend(gotOptions);
    }
}
