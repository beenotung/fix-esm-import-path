#!/usr/bin/env node
import fs from 'fs/promises'
import path from 'path'
import debug from 'debug'

let entryPoints = []
let missingFiles = []

let log = debug('fix-esm-import-path')
// log.enabled = true

async function findNodeModuleDir(srcFile, name) {
  let dir = path.dirname(srcFile)
  for (;;) {
    let files = await fs.readdir(dir)
    if (files.includes('node_modules')) {
      let moduleDir = path.join(dir, 'node_modules', name)
      if (await isExists(moduleDir)) {
        return moduleDir
      }
    }
    dir = path.join(dir, '..')
    if (path.resolve(dir) === '/') {
      return null
    }
  }
}

async function getModuleEntryFile(dir) {
  let entryFile = 'index.js'
  let files = await fs.readdir(dir)
  if (files.includes('package.json')) {
    let text = await fs.readFile(path.join(dir, 'package.json'), 'utf8')
    let pkg = JSON.parse(text)
    entryFile = pkg.module || pkg.main || entryFile
  }
  return path.join(dir, entryFile)
}

async function fixImport({ srcFile, importCode, from, to }) {
  let newImportCode = importCode.replace(from, to)
  log(`[fixImport]`, { srcFile, importCode, from, to })
  let code = await fs.readFile(srcFile, 'utf8')
  code = code.replace(importCode, newImportCode)
  await fs.writeFile(srcFile, code, 'utf8')
  return newImportCode
}

function scanModuleMainFile({ file }) {
  // no need?
  // log(`[scanModuleMainFile] TODO`, { file })
}

async function scanModule({ srcFile, importCode, name }) {
  let numOfDirInName = name.split('/').length - 1
  if (name.includes('@')) {
    numOfDirInName--
  }
  if (numOfDirInName == 0) {
    return
  }
  let dir = await findNodeModuleDir(srcFile, name)
  if (dir) {
    let mainFile = (await isFileExists(dir)) ? dir : await getModuleEntryFile(dir)
    return scanModuleMainFile({ file: mainFile })
  }

  let jsName = name + '.js'
  let jsFile = await findNodeModuleDir(srcFile, jsName)
  if (!jsFile) {
    console.error(`Error: cannot resolve module`, {
      name,
      srcFile,
      importCode
    })
    process.exit(1)
  }
  await fixImport({ srcFile, importCode, from: name, to: jsName })
  scanModuleMainFile({ file: jsFile })
}

function resolveImportName({ srcFile, name }) {
  if (name.startsWith('/')) {
    return { type: 'absolute', name }
  }
  if (name.startsWith('./')) {
    let dir = path.dirname(srcFile)
    name = path.join(dir, name)
    return { type: 'relative', name }
  }
  if (name.startsWith('../')) {
    let dir = path.dirname(srcFile)
    name = path.join(dir, name)
    return { type: 'relative', name }
  }
  return { type: 'module', name }
}

async function scanImport({ srcFile, importCode, name }) {
  let { type, name: importName } = resolveImportName({ srcFile, name })
  if (type == 'module') {
    return await scanModule({ srcFile, importCode, name })
  }
  let importFile = await resolveImportFile(importName)
  if (!importFile) {
    console.error(`[scanImport] File not found:`, {
      srcFile,
      importName,
      importCode,
      name
    })
    process.exit(1)
  }
  let ext_list = ['.js', '.jsx', '.ts', 'tsx']
  if (!importFile.startsWith(importName + '/index') && !ext_list.some(ext => importName.endsWith(ext))) {
    for (let ext of ext_list) {
      if (!importName.endsWith('.js') && importFile.endsWith(ext)) {
        log(`[scanImport] fix import:`, {
          srcFile,
          importCode,
          importName,
          importFile
        })
        importCode = await fixImport({
          srcFile,
          importCode,
          from: name,
          to: name + '.js'
        })
        break
      }
    }
  }
  return await scanFile({ srcFile: importFile })
}

function isFileExists(file) {
  return isExists(file).then(() => isFile(file))
}

function isFile(file) {
  return fs
    .stat(file)
    .then(v => v.isFile())
    .catch(() => false)
}

function isExists(file) {
  return fs
    .access(file)
    .then(() => true)
    .catch(() => false)
}

async function resolveImportFile(file) {
  if (await isFileExists(file)) {
    return file
  }
  for (let jsExt of ['.js', '.jsx']) {
    let jsFile = file + jsExt
    if (await isFileExists(jsFile)) {
      return jsFile
    }
    for (let tsExt of ['.ts', '.tsx']) {
      let tsFile = file + tsExt
      if (await isFileExists(tsFile)) {
        return tsFile
      }
      if (file.endsWith(jsExt)) {
        tsFile = file.slice(0, file.length - jsExt.length) + tsExt
        if (await isFileExists(tsFile)) {
          return tsFile
        }
      }
    }
  }

  for (let indexFile of ['index.js', 'index.jsx', 'index.ts', 'index.tsx']) {
    indexFile = path.join(file, indexFile)
    if (await isFileExists(indexFile)) {
      return indexFile
    }
  }
  return null
}

let visit_file_set = new Set()
async function scanFile({ srcFile }) {
  if (visit_file_set.has(srcFile)) return
  visit_file_set.add(srcFile)
  log('[scanFile]', { srcFile })
  let code = await fs.readFile(srcFile, 'utf8')
  for (let regex of [
    /.*import .* from '(.*)'.*/g,
    /.*import .* from "(.*)".*/g,
    /.*export .* from '(.*)'.*/g,
    /.*export .* from "(.*)".*/g
  ]) {
    for (let match of code.matchAll(regex)) {
      let [importCode, name] = match
      if (importCode.includes('import type')) continue
      await scanImport({ srcFile, importCode, name })
    }
  }
}

async function scanEntryPoint(file) {
  log('[scanEntryPoint]', { file })
  let stat = await fs.stat(file)
  if (stat.isFile()) {
    if (file.endsWith('.js') || file.endsWith('.ts')) {
      await scanFile({ srcFile: file })
    }
    // e.g. package.json, .gitignore
    return
  }
  if (stat.isDirectory()) {
    await fs.readdir(file).then(files =>
      Promise.all(
        files.map(async filename => {
          if (filename == 'node_modules') return
          await scanEntryPoint(path.join(file, filename))
        })
      )
    )
    return
  }
  // e.g. socket file
  console.log('skip unsupported file:', file)
}

async function start() {
  await Promise.all(
    process.argv.slice(2).map(entryPoint =>
      isExists(entryPoint).then(exist => {
        if (exist) {
          entryPoints.push(entryPoint)
        } else {
          missingFiles.push(entryPoint)
        }
      })
    )
  )

  if (missingFiles.length > 0) {
    let name = missingFiles.map(name => JSON.stringify(name)).join(', ')
    console.error(`entryPoint ${name} does not exist`)
    process.exit(1)
  }

  if (entryPoints.length === 0) {
    console.error('missing entryPoint in argument')
    process.exit(1)
  }

  await Promise.all(entryPoints.map(entryPoint => scanEntryPoint(entryPoint)))

  console.log('done.')
}

start()
