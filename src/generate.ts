import {
    Project,
    SourceFile,
    StatementStructures,
    StructureKind
} from "ts-morph";
import {camelCase, pascalCase} from 'change-case';
import {HTTP_METHODS} from "./http-methods";


async function generate() {
    let project = new Project({addFilesFromTsConfig: false});
    const swagger = require('./swagger.json');
    let paths: string[] = Object.keys(swagger.paths);
    let _db: PathItem = {
        name: '_db',
        callable: false,
        subpaths: {},
        pathBehind: ['_db'],
        isEndpoint: false
    };

    let dbName: PathItem = {
        name: 'database',
        callable: true,
        subpaths: {},
        pathBehind: ['_db', 'database'],
        isEndpoint: false
    };
    _db.subpaths['database'] = dbName;

    for (let path of paths) {
        let parts = path.split('/').filter(x => x != "");
        let info: PathInfo = {
            road: parts,
            ahead: parts,
            behind: [],
            current: ''
        };
        buildSubpaths(swagger, dbName, walkToNext(info))
    }
    let sourceFile: SourceFile = project.createSourceFile('src/generated/index.ts', undefined, {overwrite: true});
    sourceFile.addImportDeclarations([{
        namedImports: [{name: "Endpoint"}, {name: 'ApiNode'}],
        moduleSpecifier: '../basics'
    }, {defaultImport: '* as got', moduleSpecifier: 'got'}]);
    sourceFile.addStatements(buildSourceStructures(swagger, dbName));
    sourceFile.saveSync();
}

function buildSubpaths(swagger, root: PathItem, pathInfo: PathInfo) {
    let current = pathInfo.current;
    let callable = false;
    if (current.startsWith('{')) {
        current = current.substr(1, current.length - 2);
        callable = true;
    }
    let currentPathItem: PathItem;
    if (root.subpaths[current]) {
        currentPathItem = root.subpaths[current]!;
    } else {
        currentPathItem = {name: current, callable, subpaths: {}, pathBehind: pathInfo.behind, isEndpoint: false};
        root.subpaths[current] = currentPathItem;
    }
    if (pathInfo.ahead.length > 0) {
        buildSubpaths(swagger, currentPathItem, walkToNext(pathInfo));
    } else {
        currentPathItem.isEndpoint = true;
    }
}


function buildSourceStructures(swagger, root: PathItem): StatementStructures[] {
    let structures: StatementStructures[] = [];
    let suffix = root.isEndpoint ? 'Endpoint' : '';
    let className = pascalCase([...root.pathBehind, suffix].join(' '));
    root.classDecl = {
        kind: StructureKind.Class,
        extends: root.isEndpoint ? 'Endpoint' : 'ApiNode',
        name: className,
        isExported: true,
        properties: [],
        methods: []
    };
    const keys = Object.keys(root.subpaths);
    for (let key of keys) {
        let subpath = root.subpaths[key];
        structures.push(...buildSourceStructures(swagger, subpath));
        if (subpath.callable) {
            root.classDecl.methods!.push({
                name: camelCase(key),
                returnType: subpath.classDecl!.name,
                parameters: [{name: camelCase(key), type: 'string'}],
                statements: writer => {
                    writer.writeLine('const ops = this._options;').write('return new ').write(subpath.classDecl!.name!).write('(').inlineBlock(() => {
                        writer.write('database: ops.database,\n' +
                            `params: {...ops.params, ['${key}']:${camelCase(key)} },\n` +
                            'connection: ops.connection')
                    }).write(')')
                }
            });
        } else {
            let type = subpath.classDecl!.name;
            root.classDecl.properties!.push({
                name: camelCase(key),
                type: type,
                initializer: `new ${type}(this._options)`
            });
        }
    }

    if (root.isEndpoint) {

        root.interfaceDecl = {
            kind: StructureKind.Interface,
            name: className,
            isExported: true,
            methods: []
        };

        let path = '/' + root.pathBehind.join('/');
        let swaggerPath = swagger.paths[path];
        if (!swaggerPath) {
            path = path + '/';
            swaggerPath = swagger.paths[path];
        }

        for (let method of HTTP_METHODS) {
            if (swaggerPath[method]) {
                root.interfaceDecl!.methods!.push({
                    name: method,
                    parameters: [{
                        name: 'options',
                        hasQuestionToken: true,
                        type: 'Partial<got.GotJSONOptions|got.GotBodyOptions<any>>',
                    }]
                });
            }
        }
        root.classDecl!.properties!.push({
            name: '_path',
            leadingTrivia: 'protected ',
            initializer: `"/${root.pathBehind.join('/')}"`
        })
    }
    structures.push(root.classDecl);
    if (root.interfaceDecl) structures.push(root.interfaceDecl);
    return structures;
}

interface PathItem {
    name: string;
    classDecl?: ClassDeclarationStructure;
    interfaceDecl?: InterfaceDeclarationStructure;
    callable?: boolean;
    subpaths: { [key: string]: PathItem };
    pathBehind: string[];
    isEndpoint: boolean;
}

interface PathInfo {
    road: string[];
    current: string;
    behind: string[];
    ahead: string[];
}

function walkToNext(info: PathInfo): PathInfo {
    let current = info.ahead[0];
    if (!current) throw new Error("There is nothing next");
    return {
        current,
        ahead: info.ahead.slice(1),
        behind: info.behind.concat(current),
        road: info.road
    };
}

generate().catch(reason => {
    console.error(reason);
    process.exit(1)
});
