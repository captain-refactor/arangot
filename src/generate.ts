import {ClassDeclarationStructure, Project, SourceFile, StatementStructures, StructureKind} from "ts-morph";
import {camelCase, pascalCase} from 'change-case';


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
    sourceFile.addImportDeclaration({
        namedImports: [{name: "Endpoint"}, {name: 'Connection'}, {name: 'ApiNode'}],
        moduleSpecifier: '../basics'
    });
    sourceFile.addStatements(buildSourceStructures(swagger, _db));
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


function buildSourceStructures(swagger, root: PathItem): ClassDeclarationStructure[] {
    let structures: ClassDeclarationStructure[] = [];
    let suffix = root.isEndpoint ? 'Endpoint' : '';
    let className = pascalCase([...root.pathBehind, suffix].join(' '));
    root.morph = {
        kind: StructureKind.Class,
        extends: root.isEndpoint ? 'Endpoint' : 'ApiNode',
        name: className,
        properties: [],
        methods: []
    };
    const keys = Object.keys(root.subpaths);
    for (let key of keys) {
        let subpath = root.subpaths[key];
        structures.push(...buildSourceStructures(swagger, subpath));
        if (subpath.callable) {
            root.morph.methods!.push({
                name: camelCase(key),
                returnType: subpath.morph!.name,
                parameters: [{name: camelCase(key), type: 'string'}],
                statements: writer => {
                    writer.writeLine('const ops = this._options;').write('return new ').write(subpath.morph!.name!).write('(').inlineBlock(() => {
                        writer.write('database: ops.database,\n' +
                            `params: {...ops.params, ${camelCase(key)} },\n` +
                            'connection: ops.connection')
                    }).write(')')
                }
            });
        } else {
            root.morph.properties!.push({name: camelCase(key), type: subpath.morph!.name});
        }
    }

    if (root.isEndpoint) {
        let path = '/' + root.pathBehind.join('/');
        let swaggerPath = swagger.paths[path];
        if (!swaggerPath) {
            path = path + '/';
            swaggerPath = swagger.paths[path];
        }
        let httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
        for (let method of httpMethods) {
            if (swaggerPath[method]) {
                root.morph!.methods!.push({
                    name: method,
                    isAsync: true,
                    statements: writer => {
                        writer
                            .writeLine(`let result = await this._got.${method}(this._path,{});`)
                            .writeLine(`return result.body`);
                    }
                });
            }
        }
        root.morph!.properties!.push({
            name: '_path',
            leadingTrivia: 'protected ',
            initializer: `"/${root.pathBehind.join('/')}"`
        })
    }
    structures.push(root.morph);
    return structures;
}

interface PathItem {
    name: string;
    morph?: ClassDeclarationStructure;
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
