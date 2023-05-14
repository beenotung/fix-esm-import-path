# fix-esm-import-path

Auto fix import path for esm compatibility.

[![npm Package Version](https://img.shields.io/npm/v/fix-esm-import-path.svg?maxAge=2592000)](https://www.npmjs.com/package/fix-esm-import-path)

This cli tool modifies specified Typescript / Javascript files recursively. It appends `.js` extension on the import / export statements of relative module path.

## Installation

```bash
## for global cli
npm install --global fix-esm-import-path

## for npm script
npm install -D fix-esm-import-path
```

## Usage

```bash
fix-esm-import-path [options] <file-or-directory>
```

### Options

`--process-import-type`: To add `.js` extension in the import path of `import type` statements when needed.

`--preserve-import-type`: To preserve the import path of `import type` statements as is.

Default mode is `--process-import-type`.

<details>
<summary>(Click to expand the reason)</summary>

In previous version, `fix-esm-import-path` does not modify the import path of `import type` statements because they are supposed to be removed in the javascript output.

However, [under some settings](https://github.com/beenotung/fix-esm-import-path/issues/5), import path with extension is required for `import type` statements as well. So now `fix-esm-import-path` now modifies the import path of `import type` statements as well.

If your setup does not require fixing the import path for `import type` statements and you want to minimize git changes, you can use the `--preserve-import-type` flag to leave them as is.

</details>

### Usage Example

Example on shell:

```bash
npx fix-esm-import-path dist/server/index.js
```

Example on npm script (in `package.json`):

```json
{
  "type": "module",
  "scripts": {
    "build": "run-s tsc fix",
    "test": "run-s build js",
    "tsc": "tsc -p .",
    "fix": "fix-esm-import-path dist/test.js",
    "js": "node dist/test"
  },
  "devDependencies": {
    "fix-esm-import-path": "^1.0.1",
    "npm-run-all": "^4.1.5",
    "ts-node": "^10.1.0",
    "typescript": "^4.3.5"
  }
}
```

Details refer to [example](./example)

## Related discussions

- [Appending .js extension on relative import statements during Typescript compilation (ES6 modules)](https://stackoverflow.com/questions/62619058/appending-js-extension-on-relative-import-statements-during-typescript-compilat)
- [Provide a way to add the '.js' file extension to the end of module specifiers](https://github.com/microsoft/TypeScript/issues/16577)
- [[FEATURE] absolute->relative module path transformation](https://github.com/microsoft/TypeScript/issues/15479)
- [Support TypeScript import type when targeting ESNext with NodeNext module](https://github.com/beenotung/fix-esm-import-path/issues/5)

## License

This is free and open-source software (FOSS) with
[BSD-2-Clause License](./LICENSE)
