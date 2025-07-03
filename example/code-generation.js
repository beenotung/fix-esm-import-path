import { CodeFile } from 'code-gen'
import { pascalName } from './config'

let indexFile = new CodeFile('index.ts')

indexFile.write(`import * as ${NamePascal} from './${realName}/schema';\n`)
// prettier-ignore
indexFile.write(`import * as ${pascalName} from './${file.substring(0, file.length - ext.length)}';\n`);
