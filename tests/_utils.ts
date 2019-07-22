import avaTest, {TestInterface} from "ava";
import {Injector, ReflectiveInjector} from "injection-js";
import {Connection} from "../src";

export interface TestContext {
    injector: Injector;
}

export const test: TestInterface<TestContext> = avaTest;

test.beforeEach(t => {
    t.context.injector = ReflectiveInjector.resolveAndCreate([
        {
            provide: Connection,
            useFactory() {
                return new Connection({auth: {username: 'root', password: 'arangot123'}, url: 'http://127.0.0.1:8529'});
            }, deps: []
        }
    ])
});
