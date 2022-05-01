
const fs = require('fs')
const { paramCase } = require('change-case')
const mkdirp = require('mkdirp')
const babel = require('@babel/parser')

const PATHS = ['DefinitelyTyped/types/google.maps/index.d.ts']

let OUTPUT_PATH
let defined = {}
let writes = {}

PATHS.forEach(path => {
  console.log(path)
  const code = fs.readFileSync(path, 'utf-8')
  OUTPUT_PATH = path.replace('DefinitelyTyped/types/', '').split('.')
    .map(x => x.split('/').map(y => makeName(y)).join('/'))
  OUTPUT_PATH.pop()
  OUTPUT_PATH.pop()
  OUTPUT_PATH.pop()
  OUTPUT_PATH = OUTPUT_PATH.filter(x => x).join('/')

  const ast = babel.parse(code, {
    sourceType: 'module',
    strictMode: false,
    allowUndeclaredExports: true,
    errorRecovery: true,
    plugins: ['classProperties', 'typescript'],
  })

  const declared = {}

  ast.program.body.forEach(node => {
    handleImports(node, null, declared, true)
  })

  const hostsAndTasks = {
    imports: {},
    globals: {
      hosts: [],
      tasks: []
    },
    hosts: [],
    tasks: []
  }

  ast.program.body.forEach(node => {
    handleBody(node, null, declared, true, false, hostsAndTasks, '')
    handleBodyNames(node, null, declared, true)
  })

  const finalImportText = getImportText(hostsAndTasks.imports, declared)

  const path2 = `tmp/${OUTPUT_PATH}`

  const t = [
    ...hostsAndTasks.globals.hosts,
    '',
    ...hostsAndTasks.globals.tasks,
    '',
    ...hostsAndTasks.hosts,
    '',
    ...hostsAndTasks.tasks,
  ]

  writes[path2] = writes[path2] ?? { i: [], t: [], b: [] }
  writes[path2].i.push('\n', ...finalImportText)
  writes[path2].t.push('\n', ...t)
})

Object.keys(writes).forEach(path => {
  let parts = path.split('/')
  let name = parts.pop()
  let parentPath = parts.join('/')
  // if (parentPath === 'tmp') throw new Error(path)
  let importPath = path.replace(/^tmp/, 'bear @drumwork/moon/code/javascript')
  const write = writes[parentPath] = writes[parentPath] ?? { i: [], t: [], b: [] }
  write.b.push(importPath)
})

Object.keys(writes).forEach(path => {
  mkdir(path)
  const { i, t, b } = writes[path]
  let imports = Object.keys(i.reduce((m, x) => m[x] = true && m, {})).sort()
  let bears = Object.keys(b.reduce((m, x) => m[x] = true && m, {}))

  fs.writeFileSync(`${path}/base.link`, cleanText(bears.join('\n') + '\n' + imports.join('\n\n') + '\n' + t.join('\n')))
})

function handleImports(node, mod, declared, isTop = false) {
  switch (node.type) {
    case 'TSInterfaceDeclaration':
      makeInterfaceImports(node, mod, declared)
      break
    case 'TSModuleDeclaration':
      makeModuleImports(node, mod, declared, isTop)
      break
    case 'VariableDeclaration':
      break
    case 'TSDeclareFunction':
      // console.log('Function')
      break
    case 'TSTypeAliasDeclaration':
      makeAliasImports(node, mod, declared)
      break
    case 'ImportDeclaration':
      // console.log('ImportDeclaration')
      makeImportImports(node, mod, declared)
      break
    case 'TSImportEqualsDeclaration':
      // console.log('TSImportEqualsDeclaration')
      break
    case 'ClassDeclaration':
      // console.log('Class')
      break
    case 'TSExportAssignment':
      break
    case 'ExportAllDeclaration':
      break
    case 'ExportNamedDeclaration':
      // console.log('ExportNamedDeclaration')
      break
    case 'ExportDefaultDeclaration':
      // console.log('ExportDefaultDeclaration')
      break
    case 'TSEnumDeclaration':
      // console.log('TSEnumDeclaration')
      break
    default:
      console.log(node, OUTPUT_PATH)
      throw new Error(`Unknown program type`)
  }
}

function makeImportImports(node, mod, declared) {
  // const source = node.source.value.split(':').join('/')

  // node.specifiers.forEach(node => {
  //   const imported = node.imported.name
  //   const local = node.local.name
  // })

  // declared[typeName] = { OUTPUT_PATH, mod }
}

function handleBody(node, mod, declared, isTop = false, isGlobal, hostsAndTasks, ns) {
  switch (node.type) {
    case 'TSInterfaceDeclaration':
      makeInterface(node, mod, declared, isGlobal, ns)
      break
    case 'TSModuleDeclaration':
      makeModule(node, mod, declared, isTop, isGlobal, hostsAndTasks, ns)
      break
    case 'VariableDeclaration': {
      makeVariable(node, mod, hostsAndTasks.imports, declared, isGlobal, hostsAndTasks)
      break
    }
    case 'ExportDefaultDeclaration':
      // console.log('ExportDefaultDeclaration')
      break
    case 'TSDeclareFunction': {
      makeFunction(node, mod, hostsAndTasks.imports, declared, isGlobal, hostsAndTasks)
      break
    }
    case 'ImportDeclaration':
      // console.log('ImportDeclaration')
      break
    case 'TSTypeAliasDeclaration':
      makeAlias(node, mod, declared, isGlobal, ns)
      break
    case 'TSImportEqualsDeclaration':
      // console.log('TSImportEqualsDeclaration')
      break
    case 'ExportAllDeclaration':
      // console.log('ExportAllDeclaration')
      break
    case 'ClassDeclaration':
      makeClass(node, mod, declared, isGlobal, ns)
      break
    case 'ExportNamedDeclaration': {
      makeExportNamed(node, mod, declared, isGlobal, hostsAndTasks, ns)
      break
    }
    case 'TSExportAssignment':
      break
    case 'TSEnumDeclaration':
      // console.log('TSEnumDeclaration')
      break
    default:
      console.log(node)
      throw new Error(`Unknown program type`)
  }
}

function getMemberExpressionName(node) {
  switch (node.type) {
    case 'MemberExpression':
      const name = []
      name.push(getMemberExpressionName(node.object))
      name.push(getMemberExpressionName(node.property))
      return name.join('-')
    default:
      return makeName(node.name)
  }
}

function makeClass(node, mod, declared, isGlobal, ns) {
  const imports = {}
  const heads = {}
  const name = makeName(node.id.name)
  const typeParams = node.id.typeParameters ? makeTypeParameters('', node.id.typeParameters, imports, heads) : []
  const superclass = node.superClass && getMemberExpressionName(node.superClass)
  const superclassTypeParams = node.superClass?.typeParameters ? makeTypeParameters('', node.superClass.typeParameters, imports, heads) : []
  const text = []
  const staticMethods = []
  const instanceMethods = []
  const staticProperties = []
  const instanceProperties = []
  const classText = []
  text.push(`form ${name}, name <${ns}.${node.id.name}>`)
  if (isGlobal) text.push(`  home true`)
  typeParams.forEach(line => {
    text.push(`  ${line}`)
  })
  if (superclass) {
    text.push(`  base ${superclass}`)
  }
  superclassTypeParams.forEach(line => {
    text.push(`    ${line}`)
  })
  node.body.body.forEach(node => {
    switch (node.type) {
      case 'TSDeclareMethod': {
        const methodHeads = { ...heads }
        const typeParams = node.typeParameters ? makeTypeParameters('', node.typeParameters, imports, methodHeads) : []
        const params = makeFunctionParams(mod, node, imports, methodHeads)
        if (node.kind === 'constructor') {
          staticMethods.push(`  hook make`)
          typeParams.forEach(line => {
            staticMethods.push(`    ${line}`)
          })
          params.forEach(line => {
            staticMethods.push(`    ${line}`)
          })
          staticMethods.push(``)
        } else {
          const t = node.static ? staticMethods : instanceMethods
          if (node.computed) {
            const left = makeName(node.key.object.name)
            const right = makeName(node.key.property.name)
            const name = [left, right].join('/')
            t.push(`  task loan ${name}`)
            t.push(`    name <${node.key.object.name}.${node.key.property.name}>`)
          } else {
            const methodName = makeName(node.key.name)
            t.push(`  task ${methodName}, name <${node.key.name}>`)
          }
          typeParams.forEach(line => {
            t.push(`    ${line}`)
          })
          params.forEach(line => {
            t.push(`    ${line}`)
          })
          if (node.key.name.match(/getMap/i)) {
          console.log(imports)
          }
          const returnType = makeTypeAnnotation('', node.returnType.typeAnnotation, `like`, imports, methodHeads)

        if (node.key.name.match(/getMap/i)) {
          console.log('returnType', node, imports)
        }
          let x = [`    free seed`]
          if (returnType.length === 1) {
            x[0] += `, ${returnType[0]}`
          } else {
            returnType.forEach(line => {
              x.push(`      ${line}`)
            })
          }
          t.push(...x)
          t.push(``)
        }

        break
      }
      case 'ClassProperty': {
        const t = node.static ? staticProperties : instanceProperties
        const type = makeTypeAnnotation('', node.typeAnnotation.typeAnnotation, `like`, imports, heads)
        if (node.computed) {
          const left = makeName(node.key.object.name)
          const right = makeName(node.key.property.name)
          const name = [left, right].join('/')
          t.push(`  take loan ${name}`)
          type.forEach(line => {
            t.push(`    ${line}`)
          })
        } else {
          const name = makeName(node.key.name)
          t.push(`  take ${name}`)
          if (type.length === 1) {
            t[t.length - 1] += `, ${type[0]}`
          } else {
            type.forEach(line => {
              t.push(`    ${line}`)
            })
          }
        }
        break
      }
      default:
        console.log(node)
        throw new Error('Oops')
    }
  })

  if (staticMethods.length || staticProperties.length) {
    classText.push('')
    classText.push(`form ${name}-constructor`)
    if (staticProperties.length) {
      classText.push(...staticProperties)
      classText.push('')
    }
    classText.push(...staticMethods)
  }

  text.push(...instanceProperties)
  if (instanceProperties.length) {
    text.push('')
  }

  text.push(...instanceMethods)

  text.push(...classText)

  const finalImportText = getImportText(imports, declared)

  const path = mod
    ? `tmp/${OUTPUT_PATH}/${mod}/${makeName(name)}`
    : `tmp/${OUTPUT_PATH}/${makeName(name)}`

  writes[path] = writes[path] ?? { i: [], t: [], b: [] }
  writes[path].i.push('\n', ...finalImportText)
  writes[path].t.push('\n', ...text)
}

function makeExportNamed(node, mod, declared, isGlobal, hostsAndTasks, ns) {
  if (node.specifiers?.length) {

  } else {
    switch (node.declaration.type) {
      case 'TSDeclareFunction':
        makeFunction(node.declaration, mod, hostsAndTasks.imports, declared, isGlobal, hostsAndTasks)
        break
      case 'TSInterfaceDeclaration':
        makeInterface(node.declaration, mod, declared, ns)
        break
      case 'VariableDeclaration':
        makeVariable(node.declaration, mod, hostsAndTasks.imports, declared, isGlobal, hostsAndTasks)
        break
      case 'TSModuleDeclaration':
        makeModule(node.declaration, mod, declared)
        break
      case 'ClassDeclaration':
        // console.log('ClassDeclaration')
        makeClass(node.declaration, mod, declared, isGlobal, ns)
        break
      case 'TSTypeAliasDeclaration':
        makeAlias(node.declaration, mod, declared, ns)
        break
      default:
        console.log(node)
        throw new Error('Named export error')
    }
  }
}

function makeFunction(node, mod, imports, declared, isGlobal, hostsAndTasks) {
  const heads = {}
  const name = node.id.name
  if (!name) {
    console.log(node)
    throw new Error
  }
  const typeParams = node.typeParameters ? makeTypeParameters('', node.typeParameters, imports, heads) : []
  const functionParams = makeFunctionParams('', node, imports, heads)
  const returnType = makeTypeAnnotation('', node.returnType.typeAnnotation, `like`, imports, heads)
  const t = []
  const globalsText = []
  t.push(`task ${makeName(name)}, name <${name}>`)
  if (isGlobal) t.push(`  home true`)
  typeParams.forEach(line => {
    t.push(`  ${line}`)
  })
  functionParams.forEach(line => {
    t.push(`  ${line}`)
  })
  let x = [`  free seed`]
  if (returnType.length === 1) {
    x[0] += `, ${returnType[0]}`
  } else {
    returnType.forEach(line => {
      x.push(`    ${line}`)
    })
  }
  t.push(...x)
  t.push('')

  hostsAndTasks.globals.tasks.push(...globalsText)
  hostsAndTasks.tasks.push(...t)
}

function handleBodyNames(node, mod, declared, isTop, isGlobal) {
  switch (node.type) {
    case 'TSInterfaceDeclaration':
      makeInterfaceNames(node, mod, declared, isGlobal)
      break
    case 'ImportDeclaration':
      // console.log('ImportDeclaration')
      break
    case 'ExportDefaultDeclaration':
      // console.log('ExportDefaultDeclaration')
      break
    case 'ExportNamedDeclaration':
      // console.log('ExportNamedDeclaration')
      break
    case 'TSModuleDeclaration':
      makeModuleNames(node, mod, declared, isTop, isGlobal)
      break
    case 'VariableDeclaration':
      makeVariableNames(node, mod, declared, isGlobal)
      break
    case 'TSExportAssignment':
      // console.log('TSExportAssignment')
      break
    case 'TSImportEqualsDeclaration':
      // console.log('TSImportEqualsDeclaration')
      break
    case 'ExportAllDeclaration':
      // console.log('ExportAllDeclaration')
      break
    case 'TSDeclareFunction':
      makeFunctionNames(node, mod, declared, isGlobal)
      break
    case 'TSTypeAliasDeclaration':
      makeAliasNames(node, mod, declared, isGlobal)
      break
    case 'ClassDeclaration':
      break
    case 'TSEnumDeclaration':
      // console.log('TSEnumDeclaration')
      break
    default:
      console.log(node)
      throw new Error(`Unknown program type`)
  }
}

function makeInterfaceNames(node, mod, declared) {
  return
  const typeName = node.id.name
  const _typeName = makeName(typeName)
  const text = [`form ${_typeName}, text <${typeName}>`]
  let hasLink = false

  let done = {}

  node.body.body.forEach(node => {
    switch (node.type) {
      case 'TSPropertySignature': {
        if (node.key.type === 'MemberExpression') {
          break
        }
        const name = node.key.name ?? node.key.value
        if (done[name]) break
        done[name] = true
        text.push(`  take ${makeName(name)}, text <${name}>`)
        hasLink = true
        break
      }
    }
  })

  if (hasLink) {
    text.push('')
  }

  node.body.body.forEach(node => {
    switch (node.type) {
      case 'TSMethodSignature': {
        if (node.key.type === 'MemberExpression') {
          break
        }
        const name = node.key.name
        if (done[name]) break
        done[name] = true
        text.push(`  task ${makeName(name)}, text <${name}>`)
        break
      }
    }
  })

  const path = mod
    ? `tmp/${OUTPUT_PATH}/${mod}/${makeName(typeName)}/name`
    : `tmp/${OUTPUT_PATH}/${makeName(typeName)}/name`

  mkdirp.sync(path)
  fs.appendFileSync(`${path}/base.link`, cleanText(text.join('\n')))
}

function makeModuleNames(node, mod, declared, isTop, isGlobal) {
  return
  const name = makeName(node.id.name ?? node.id.value)
  isGlobal = isGlobal || (name === 'global')
  let n = isGlobal ? null : name
  const p = isTop ? mod : [mod, n].filter(x => x).join('/')
  if (node.body.type === 'TSModuleDeclaration') {
    makeModuleNames(node.body, p, declared, false, isGlobal)
  } else {
    node.body.body.forEach(node => {
      handleBodyNames(node, p, declared, false, isGlobal)
    })
  }
}

function makeFunctionNames(node, mod, declared) {
  return
  const typeName = node.id.name
  const _typeName = makeName(typeName)
  const text = [`task ${_typeName}, text <${typeName}>`]

  const path = mod
    ? `tmp/${OUTPUT_PATH}/${mod}/${makeName(typeName)}/name`
    : `tmp/${OUTPUT_PATH}/${makeName(typeName)}/name`

  mkdirp.sync(path)
  fs.appendFileSync(`${path}/base.link`, cleanText(text.join('\n')))
}

function makeVariableNames(node, mod, declared) {
  return
  node.declarations.forEach(dec => {
    const typeName = dec.id.name
    const _typeName = makeName(typeName)
    const text = [`host ${_typeName}, text <${typeName}>`]

    const path = mod
      ? `tmp/${OUTPUT_PATH}/${mod}/${makeName(typeName)}/name`
      : `tmp/${OUTPUT_PATH}/${makeName(typeName)}/name`

    mkdirp.sync(path)
    fs.appendFileSync(`${path}/base.link`, cleanText(text.join('\n')))
  })
}

function makeAliasNames(node, mod, declared, isGlobal) {
  return
  const typeName = node.id.name
  const _typeName = makeName(typeName)
  const text = [`form ${_typeName}, text <${typeName}>`]

  const path = mod
    ? `tmp/${OUTPUT_PATH}/${mod}/${makeName(typeName)}/name`
    : `tmp/${OUTPUT_PATH}/${makeName(typeName)}/name`

  mkdirp.sync(path)
  fs.appendFileSync(`${path}/base.link`, cleanText(text.join('\n')))
}

function cleanText(text) {
  let array = []
  let n = 0
  let isStart = true
  text.split('\n').forEach(line => {
    if (!line.trim()) {
      n++
      if (!isStart && n < 2) {
        array.push('')
      }
    } else {
      isStart = false
      array.push(line)
      n = 0
    }
  })
  if (array[array.length - 1] === '\n') array.pop()
  return '\n' + array.join('\n')
}

function makeModule(node, mod, declared, isTop, isGlobal, hostsAndTasks, ns) {
  const NAME = node.id.name ?? node.id.value
  const name = makeName(NAME)
  isGlobal = isGlobal || (name === 'global')
  let n = isGlobal ? null : name
  if (node.body.type === 'TSModuleDeclaration') {
    makeModule(node.body, isTop ? mod : [mod, n].filter(x => x).join('/').replace(/google\/maps\/?/, ''), declared, false, isGlobal, hostsAndTasks, [ns, NAME].filter(x => x).join('.'))
  } else {
    const mods = isTop ? n : [mod, n].filter(x => x).join('/').replace(/google\/maps\/?/, '')
    const ht = {
      imports: {},
      hosts: [],
      tasks: [],
      globals: {
        hosts: [],
        tasks: []
      }
    }

    node.body.body.forEach(node => {
      handleBody(node, mods, declared, false, isGlobal, ht, [ns, NAME].filter(x => x).join('.'))
    })

    const finalImportText = getImportText(ht.imports, declared)

    const path = mods
      ? `tmp/${OUTPUT_PATH}/${mods}`
      : `tmp/${OUTPUT_PATH}`

    const t = [
      ...ht.globals.hosts,
      '',
      ...ht.globals.tasks,
      '',
      ...ht.hosts,
      '',
      ...ht.tasks,
    ]

    writes[path] = writes[path] ?? { i: [], t: [], b: [] }
    writes[path].i.push('\n', ...finalImportText)
    writes[path].t.push('\n', ...t)
  }
}

function mkdir(path) {
  if (fs.existsSync(`${path}/base.link`)) {
    console.error('MKDIR', path)
  } else {
    console.log('mkdir', path)
    mkdirp.sync(path)
  }
}

function makeModuleImports(node, mod, declared, isTop, isGlobal) {
  const name = makeName(node.id.name ?? node.id.value)
  isGlobal = isGlobal || name === 'global'
  let n = isGlobal ? null : name

  if (node.body.type === 'TSModuleDeclaration') {
    makeModuleImports(node.body, isTop ? mod : [mod, n].filter(x => x).join('/').replace(/google\/maps\/?/, ''), declared, isGlobal)
  } else {
    node.body.body.forEach(node => {
      handleImports(node, isTop ? mod : [mod, n].filter(x => x).join('/').replace(/google\/maps\/?/, ''), declared, isGlobal)
    })
  }
}

function makeAliasImports(node, mod, declared) {
  const typeName = makeName(node.id.name)

  declared[typeName] = { OUTPUT_PATH, mod }
}

function makeAlias(node, mod, declared, isGlobal, ns) {
  const typeName = node.id.name
  const imports = {}
  defined[makeName(typeName)] = { OUTPUT_PATH, mod }
  const heads = { [makeName(typeName)]: true }
  const typeParams = node.typeParameters ? makeTypeParameters(typeName, node.typeParameters, imports, heads) : []

  const text = []
  text.push(`form ${makeName(typeName)}, name <${ns}.${typeName}>`)
  if (isGlobal) text.push(`  home true`)

  typeParams.forEach(line => {
    text.push(`  ${line}`)
  })

  if (typeParams.length) {
    text.push(``)
  }

  makeTypeAnnotation(typeName, node.typeAnnotation, 'like', imports, heads).forEach(line => {
    text.push(`  ${line}`)
  })

  const finalImportText = getImportText(imports, declared)

  const path = mod
    ? `tmp/${OUTPUT_PATH}/${mod}/${makeName(typeName)}`
    : `tmp/${OUTPUT_PATH}/${makeName(typeName)}`

  writes[path] = writes[path] ?? { i: [], t: [], b: [] }
  writes[path].i.push('\n', ...finalImportText)
  writes[path].t.push('\n', ...text)
}

function makeVariable(node, mod, imports, declared, isGlobal, hostsAndTasks) {
  const text = []
  const globalsText = []

  node.declarations.forEach(dec => {
    const name = dec.id.name
    if (dec.id.typeAnnotation) {
      const like = makeTypeAnnotation(name, dec.id.typeAnnotation.typeAnnotation, 'like', imports, {})
      text.push(`host ${makeName(name)}, name <${name}>`)
      if (isGlobal) text.push(`  home true`)
      like.forEach(line => {
        text.push(`  ${line}`)
      })
    } else {

    }
  })

  hostsAndTasks.globals.hosts.push(...globalsText)
  hostsAndTasks.hosts.push(...text)
}

function makeTypeExtends(name, node, imports) {
  const text = []
  node.extends.forEach(node => {
    switch (node.type) {
      case 'TSExpressionWithTypeArguments':
        switch (node.expression.type) {
          case 'Identifier':
            imports[makeName(node.expression.name)] = true
            text.push(`base ${makeName(node.expression.name)}`)
            break
          case 'TSQualifiedName':
            const n = getQualifiedName(node.expression)
            console.log(n)
            if (n.match('google.maps')) {
              imports[n] = true
            }
            let k = makeName(n)
            text.push(`base ${k}`)
            break
          default:
            console.log(node)
            throw new Error(`Unknown extends expression on ${name}`)
        }

        break
      default:
        console.log(node)
        throw new Error(`Unknown extends on ${name}`)
    }
  })
  return text
}

function makeInterfaceImports(node, mod, declared) {
  const typeName = node.id.name
  const _typeName = makeName(typeName)
  declared[_typeName] = { OUTPUT_PATH, mod }
}

function makeInterface(node, mod = '', declared, isGlobal, ns) {
  const typeName = node.id.name
  const _typeName = makeName(typeName)
  const imports = {}
  if (defined[_typeName]) {
    imports[_typeName] = { value: defined[_typeName], fromFile: true }
  }
  defined[_typeName] = declared[_typeName]
  const heads = { [_typeName]: true }
  const typeParams = node.typeParameters ? makeTypeParameters(typeName, node.typeParameters, imports, heads) : []

  const text = []
  text.push(`form ${_typeName}, name <${ns}.${typeName}>`)
  if (isGlobal) text.push(`  home true`)
  let hasLink = false
  let hasTypeParams = !!typeParams.length

  let bases = node.extends ? makeTypeExtends(typeName, node, imports) : []

  bases.forEach(line => {
    text.push(`  ${line}`)
  })

  if (bases.length) {
    text.push(``)
  }

  typeParams.forEach(line => {
    text.push(`  ${line}`)
  })

  if (hasTypeParams) {
    text.push(``)
  }

  node.body.body.forEach(node => {
    switch (node.type) {
      case 'TSPropertySignature':
        text.push(...makeProperty(node, imports, heads))
        hasLink = true
        break
    }
  })

  if (hasLink) {
    text.push('')
  }

  node.body.body.forEach(node => {
    switch (node.type) {
      case 'TSMethodSignature':
        text.push(...makeMethod(typeName, node, imports, heads))
        text.push(``)
        break
    }
  })

  node.body.body.forEach(node => {
    switch (node.type) {
      case 'TSIndexSignature':
        text.push(...makeIndex(typeName, node, imports, heads))
        text.push('')
        break
      case 'TSConstructSignatureDeclaration':
        text.push(...makeConstructor(typeName, node, imports, heads))
        break
      case 'TSCallSignatureDeclaration':
        break
      case 'TSMethodSignature':
      case 'TSPropertySignature':
        break
      default:
        console.log(node)
        throw new Error(`Unknown interface thing on ${typeName}`)
    }
  })

  const finalImportText = getImportText(imports, declared)

  const path = mod
    ? `tmp/${OUTPUT_PATH}/${mod}/${makeName(typeName)}`
    : `tmp/${OUTPUT_PATH}/${makeName(typeName)}`

  writes[path] = writes[path] ?? { i: [], t: [], b: [] }
  writes[path].i.push('\n', ...finalImportText)
  writes[path].t.push('\n', ...text)
}

function getImportText(imports, declared) {
  let importText = []
  Object.keys(imports).forEach(key => {
    let out
    let mod
    if (key.match(/^native-/)) {
      out = 'base'
      mod = ''
    }
    const x = imports[key]
    let val
    if (x && x.fromFile) {
      out = x.value.OUTPUT_PATH ?? 'base'
      mod = x.value.mod
      const parts = [out, mod].filter(x => x).join('/')
      val = `load @drumwork/moon/code/javascript/${parts}/${key}\n  take form ${key}`
    } else if (x === true) {
      let v
      let parts
      if (key.match('google.maps')) {
        parts = key.replace(/^google\/./, '').split(/\./).map(x => makeName(x))
        key = parts.pop()
        parts = parts.join('/')
      } else {
        v = declared[key] ?? defined[key] ?? {}
        out = v.OUTPUT_PATH ?? 'base'
        mod = v.mod
        parts = [out, mod].filter(x => x).join('/')
      }
      val = `load @drumwork/moon/code/javascript/${parts}/${key}\n  take form ${key}`
    } else {
      val = imports[key]
    }
    importText.push(val)
  })

  importText.sort()

  const finalImportText = ['']
  importText.forEach(line => {
    finalImportText.push(line)
    finalImportText.push('')
  })

  return finalImportText
}

function makeIndex(typeName, node, imports, heads) {
  if (node.parameters.length > 1) {
    throw new Error('Unknown index type')
  }

  const t = []

  makeIdentifier(typeName, node.parameters[0], 'cite', imports, heads).forEach(line => {
    t.push(`  ${line}`)
  })
  makeTypeAnnotation(typeName, node.typeAnnotation.typeAnnotation, 'like', imports, heads).forEach(line => {
    t.push(`    ${line}`)
  })

  return t
}

function makeConstructor(typeName, node, imports, heads) {
  const computed = node.computed
  const constructorHeads = { ...heads }
  const typeParams = node.typeParameters ? makeTypeParameters(typeName, node.typeParameters, imports, constructorHeads) : []
  const functionParams = makeFunctionParams(typeName, node, imports, constructorHeads)
  const returnType = makeTypeAnnotation(typeName, node.typeAnnotation.typeAnnotation, `like`, imports, constructorHeads)
  const t = []
  t.push(`  hook make`)
  typeParams.forEach(line => {
    t.push(`    ${line}`)
  })
  functionParams.forEach(line => {
    t.push(`    ${line}`)
  })
  let x = [`    free seed`]
  if (returnType.length === 1) {
    x[0] += `, ${returnType[0]}`
  } else {
    returnType.forEach(line => {
      x.push(`      ${line}`)
    })
  }
  t.push(...x)
  t.push('')
  return t
}

function makeMethod(typeName, node, imports, heads) {
  const methodHeads = { ...heads }
  const computed = node.computed
  const text = []

  // if (computed) {
  //   console.log(node)
  //   throw new Error(`Unknown computed method for ${typeName}`)
  // }

  switch (node.key.type) {
    case 'MemberExpression': {
      const left = node.key.object.name
      const right = node.key.property.name
      const name = [makeName(left), makeName(right)].join('/')
      const typeParams = node.typeParameters ? makeTypeParameters(typeName, node.typeParameters, imports, methodHeads) : []
      const functionParams = makeFunctionParams(typeName, node, imports, methodHeads)
      text.push(`  task loan ${name}`)
      typeParams.forEach(line => {
        text.push(`    ${line}`)
      })
      functionParams.forEach(line => {
        text.push(`    ${line}`)
      })
      if (node.kind === 'set') {
        text.push(`    free seed, like void-link-text`)
      } else {
        const returnType = makeTypeAnnotation(typeName, node.typeAnnotation.typeAnnotation, `like`, imports, methodHeads)
        let x = [`    free seed`]
        if (returnType.length === 1) {
          x[0] += `, ${returnType[0]}`
        } else {
          returnType.forEach(line => {
            x.push(`      ${line}`)
          })
        }
        text.push(...x)
      }
      break
    }
    default: {
      const name = node.key.name
      const loan = computed ? `loan ` : ``
      if (computed) {
        throw new Error('computed')
      }
      const typeParams = node.typeParameters ? makeTypeParameters(typeName, node.typeParameters, imports, methodHeads) : []
      const functionParams = makeFunctionParams(typeName, node, imports, methodHeads)
      text.push(`  task ${makeName(name)}, name <${name}>`)
      typeParams.forEach(line => {
        text.push(`    ${line}`)
      })
      functionParams.forEach(line => {
        text.push(`    ${line}`)
      })
      if (node.kind === 'set') {
        text.push(`    free seed, like void-link-text`)
      } else {
        const returnType = makeTypeAnnotation(typeName, node.typeAnnotation.typeAnnotation, `like`, imports, methodHeads)

        let x = [`    free seed`]
        if (returnType.length === 1) {
          x[0] += `, ${returnType[0]}`
        } else {
          returnType.forEach(line => {
            x.push(`      ${line}`)
          })
        }
        text.push(...x)
      }
    }
  }

  return text
}

function makeProperty(node, imports, heads) {
  const t = []
  const propHeads = { ...heads }
  switch (node.key.type) {
    case 'MemberExpression': {
      const left = node.key.object.name
      const right = node.key.property.name
      const name = [makeName(left), makeName(right)].join('/')
      t.push(`  take loan ${name}`)
      const like = makeTypeAnnotation(name, node.typeAnnotation.typeAnnotation, 'like', imports, propHeads)
      like.forEach(line => {
        t.push(`    ${line}`)
      })
      if (!node.readonly && !node.computed) {
        t.push(`    lock false`)
      }
      if (node.computed) {
        t.push(`    read true`)
      }
      break
    }
    default: {
      const name = node.key.name ?? node.key.value
      const loan = node.computed ? `loan ` : ``
      if (node.computed) {
        throw new Error('computed')
      }
      t.push(`  take ${makeName(name)}, name <${name}>`)
      const like = makeTypeAnnotation(name, node.typeAnnotation.typeAnnotation, 'like', imports, propHeads)
      like.forEach(line => {
        t.push(`    ${line}`)
      })
      if (!node.readonly && !node.computed) {
        t.push(`    lock false`)
      }
      if (node.computed) {
        t.push(`    read true`)
      }
    }
  }
  return t
}

function makeIdentifier(name, node, type = 'take', imports, heads, isLink = false) {
  const text = []
  text.push(`${type} ${makeName(node.name)}`)
  if (isLink) text[0] += `, name <${node.name}>`
  const tsType = node.typeAnnotation.typeAnnotation
  const like = makeTypeAnnotation(name, tsType, 'like', imports, heads)

  if (like.length === 1) {
    text[0] += `, ${like[0]}`
  } else {
    like.forEach(line => {
      text.push(`  ${line}`)
    })
  }
  if (node.optional) {
    text.push(`  void true`)
  }
  return text
}

function makeIntersectionType(name, node, type = 'like', imports, heads) {
  const text = []
  imports['and-link-text'] = `load @drumwork/seed/code/form/and\n  take form and\n    save form and-link-text`
  text.push(`${type} and-link-text`)
  node.types.forEach(node => {
    switch (node.type) {
      case 'TSTypeReference':
        makeTypeReference(name, node, 'like', imports, heads).forEach(line => {
          text.push(`  ${line}`)
        })
        break
      case 'TSTypeQuery':
        let k
        if (node.exprName.type === 'TSQualifiedName') {
          k = `${makeName(node.exprName.left.name)}-${makeName(node.exprName.right.name)}`
        } else {
          k = makeName(node.exprName.name)
        }
        text.push(`  like ${k}`)
        break
      case 'TSMappedType': {
        makeMappedType(name, node, 'like', imports, heads).forEach(line => {
          text.push(`  ${line}`)
        })
        break
      }
      case 'TSTypeLiteral':
        makeTypeLiteral(name, node, type, imports, heads).forEach(line => {
          text.push(`  ${line}`)
        })
        break
      case 'TSPropertySignature':
        makeProperty(node, imports, heads).forEach(line => {
          text.push(`  ${line}`)
        })
        break
      default:
        console.log(node)
        throw new Error(`Unknown intersection type on ${name}`)
    }
  })
  return text
}

function makeTypeReference(name, node, type = 'like', imports, heads) {
  const text = []
  switch (node.typeName.type) {
    case 'Identifier': {
      const key = makeName(node.typeName.name)
      if (!heads[key]) {
        imports[key] = true
      }
      text.push(`${type} ${makeName(node.typeName.name)}`)
      break
    }
    case 'TSQualifiedName': {
      const n = getQualifiedName(node.typeName)
      console.log(n)
      if (n.match('google.maps')) {
        imports[n] = true
      }
      const key = makeName(n)
      if (!n.match('google.maps') && !heads[key]) imports[key] = true
      text.push(`${type} ${key}`)
      break
    }
    default:
      console.log(node)
      throw new Error(`Unknown type reference on ${name}`)
  }

  if (node.typeParameters) {
    node.typeParameters.params.forEach(param => {
      makeTypeAnnotation(name, param, 'like', imports, heads).forEach(line => {
        text.push(`  ${line}`)
      })
    })
  }

  return text
}

function getQualifiedName(node) {
  let name = []
  if (node.left.type === 'TSQualifiedName') {
    name.push(getQualifiedName(node.left))
  } else {
    name.push(node.left.name)
  }
  if (node.right.type === 'TSQualifiedName') {
    name.push(getQualifiedName(node.right))
  } else {
    name.push(node.right.name)
  }
  return name.join('.')
}

function makeUnionType(name, node, type = 'like', imports, heads) {
  const text = [`${type} or-link-text`]
  imports['or-link-text'] = `load @drumwork/seed/code/form/or\n  take form or\n    save form or-link-text`
  node.types.forEach(child => {
    makeTypeAnnotation(name, child, 'like', imports, heads).forEach(line => {
      text.push(`  ${line}`)
    })
  })
  return text
}

function makeTypeAnnotation(name, node, type = 'like', imports, heads) {
  const text = []
  switch (node.type) {
    case 'TSStringKeyword':
      imports['native-string'] = true
      text.push(`${type} native-string`)
      break
    case 'TSArrayType':
      imports['list-link-text'] = `load @drumwork/seed/code/form/list\n  take form list\n    save form list-link-text`
      text.push(`${type} list-link-text`)
      makeTypeAnnotation(name, node.elementType, 'like', imports, heads).forEach(line => {
        text.push(`  ${line}`)
      })
      break
    case 'TSUnknownKeyword':
      imports['native-unknown'] = true
      text.push(`${type} native-unknown`)
      break
    case 'TSTypeQuery':
      let k
      if (node.exprName.type === 'TSQualifiedName') {
        k = `${makeName(node.exprName.left.name)}-${makeName(node.exprName.right.name)}`
      } else {
        k = makeName(node.exprName.name)
      }
      text.push(`${type} ${k}`)
      break
    case 'TSVoidKeyword':
      imports['native-void'] = true
      text.push(`${type} native-void`)
      break
    // form partial
    // head t
    //
    // walk t/link
    //   link p
    //   tool self
    //     link loan p
    //       like form-link
    //         like t
    //         like p
    //       void true
    case 'TSMappedType': {
      text.push(...makeMappedType(name, node, type, imports, heads))
      break
    }
    case 'TSLiteralType':
      text.push(`text <${node.literal.value}>`)
      break
    case 'TSThisType':
      imports['native-this'] = true
      text.push(`${type} native-this`)
      break
    case 'TSTypeLiteral':
      text.push(...makeTypeLiteral(name, node, type, imports, heads))
      break
    case 'TSNeverKeyword':
      imports['native-never'] = true
      text.push(`${type} native-never`)
      break
    case 'TSBooleanKeyword':
      imports['native-boolean'] = true
      text.push(`${type} native-boolean`)
      break
    case 'TSIntrinsicKeyword':
      text.push(`intrinsic`)
      break
    case 'TSTypePredicate':
      text.push(...makePredicate(name, node, type, imports, heads))
      break
    case 'TSTypeOperator':
      switch (node.operator) {
        case 'readonly':
          text.push(...makeTypeAnnotation(name, node.typeAnnotation, type, imports, heads))
          // do nothing, since it is lock false in our situation already.
          break
        case 'unique':
          text.push(...makeTypeAnnotation(name, node.typeAnnotation, type, imports, heads))
          text.push(`  cool true`)
          break
        case 'keyof':
          imports['link-read-link-text'] = `load @drumwork/seed/code/form/link/read\n  take form link-read\n    save form link-read-link-text`
          text.push(`${type} link-read-link-text`)
          makeTypeAnnotation(name, node.typeAnnotation, 'like', imports, heads).forEach(line => {
            text.push(`  ${line}`)
          })
          break
        default:
          console.log(node)
          throw new Error(`Unknown type operator ${node.operator} on ${node.name}`)
      }
      break
    case 'TSFunctionType':
      text.push(...makeFunctionType(name, node, type, imports, heads))
      break
    case 'TSIndexedAccessType':
      imports['form-link-link-text'] = `load @drumwork/seed/code/form/form/link\n  take form form-link\n    save form form-link-link-text`
      text.push(`${type} form-link-link-text`)
      makeTypeAnnotation(name, node.objectType, 'like', imports, heads).forEach(line => {
        text.push(`  ${line}`)
      })
      makeTypeAnnotation(name, node.indexType, 'like', imports, heads).forEach(line => {
        text.push(`  ${line}`)
      })
      break
    case 'TSSymbolKeyword':
      imports['native-symbol'] = true
      text.push(`${type} native-symbol`)
      break
    case 'TSConstructorType':
      // console.log(node, name)
      // TODO: https://www.typescriptlang.org/docs/handbook/2/generics.html#using-class-types-in-generics
      // console.log('TODO TSConstructorType')
      break
    case 'TSBigIntKeyword':
      imports['native-bigint'] = true
      text.push(`${type} native-bigint`)
      break
    case 'TSNullKeyword':
      imports['native-null'] = true
      text.push(`${type} native-null`)
      break
    case 'TSConditionalType':
      text.push(...makeConditionalType(name, node, type, imports, heads))
      break
    case 'TSObjectKeyword':
      imports['native-object'] = true
      text.push(`${type} native-object`)
      break
    case 'TSInferType': {
      switch (node.typeParameter.type) {
        case 'TSTypeParameter':
          const key = makeName(node.typeParameter.name)
          if (!heads[key]) {
            imports[key] = true
          }
          text.push(`name ${key}`)
          break
        default:
          console.log(node)
          throw new Error('Infer type')
      }
      break
    }
    case 'TSUndefinedKeyword':
      imports['native-undefined'] = true
      text.push(`${type} native-undefined`)
      break
    case 'TSParenthesizedType':
      makeTypeAnnotation(name, node.typeAnnotation, type, imports, heads).forEach(line => {
        text.push(line)
      })
      break
    case 'TSTupleType':
      imports['band-link-text'] = `load @drumwork/seed/code/form/band\n  take form band\n    save form band-link-text`
      text.push(`${type} band-link-text`)
      node.elementTypes.forEach(node => {
        makeTypeAnnotation(name, node, 'like', imports, heads).forEach(line => {
          text.push(`  ${line}`)
        })
      })
      break
    case 'TSNumberKeyword':
      imports['native-number'] = true
      text.push(`${type} native-number`)
      break
    case 'TSAnyKeyword':
      imports['native-any'] = true
      text.push(`${type} native-any`)
      break
    case 'TSUnionType':
      text.push(...makeUnionType(name, node, type, imports, heads))
      break
    case 'TSIntersectionType':
      text.push(...makeIntersectionType(name, node, type, imports, heads))
      break
    case 'TSTypeReference':
      text.push(...makeTypeReference(name, node, type, imports, heads))
      break
    default:
      console.log(node)
      throw new Error(`Unknown type annotation on ${name}`)
  }
  return text
}

// form partial
//   head t
//
//   walk t/link
//     link p
//     tool self
//       link loan p
//         like form-link
//           like t
//           like p
//         void true
function makeMappedType(name, node, type, imports, heads) {
  const text = []
  const paramName = makeName(node.typeParameter.name)
  const childHeads = { ...heads, [paramName]: true }
  const constraint = makeTypeAnnotation(name, node.typeParameter.constraint, 'like', imports, childHeads)
  text.push(`slot self`)
  text.push(`walk link-name-like-list`)
  text.push(`  loan`)
  if (constraint.length === 1) {
    text[2] += ` ${constraint[0]}`
  } else {
    constraint.forEach(line => {
      text.push(`  ${line}`)
    })
  }
  text.push(`  take name`)
  text.push(`  take ${paramName}`)
  text.push(`  beam self`)
  text.push(`    take loan name`)
  const anno = makeTypeAnnotation(name, node.typeAnnotation, 'like', imports, childHeads)
  anno.forEach(line => {
    text.push(`      ${line}`)
  })

  return text
}

function makeTypeLiteral(name, node, type, imports, heads) {
  const text = []
  text.push(`${type} form-link-text`)
  imports['form-link-text'] = `load @drumwork/seed/code/form/form\n  take form form\n    save form form-link-text`
  node.members.forEach(node => {
    switch (node.type) {
      case 'TSPropertySignature':
        text.push(...makeProperty(node, imports, heads))
        break
      case 'TSConstructSignatureDeclaration':
        text.push(...makeConstructor(name, node, imports, heads))
        break
      case 'TSMethodSignature':
        text.push(...makeMethod(name, node, imports, heads))
        text.push(``)
        break
      case 'TSCallSignatureDeclaration':

        break
      case 'TSIndexSignature':
        text.push(...makeIndex(name, node, imports, heads))
        break
      default:
        console.log(node)
        throw new Error('Type literal')
    }
  })
  return text
}

// form unpack
//   head a

//   like test
//     test extends
//       like a
//       like list
//         name e
//       hook take
//         like e
//       hook free
//         like a
function makeConditionalType(name, node, type, imports, heads) {
  const text = []
  text.push(`${type} test-link-text`)
  imports['test-link-text'] = `load @drumwork/seed/code/form/test\n  take form test\n    save form test-link-text`
  text.push(`  stem roll`)

  makeTypeAnnotation(name, node.checkType, 'like', imports, heads).forEach(line => {
    text.push(`    ${line}`)
  })

  makeTypeAnnotation(name, node.extendsType, 'like', imports, heads).forEach(line => {
    text.push(`    ${line}`)
  })

  text.push(`    hook true`)
  makeTypeAnnotation(name, node.trueType, 'like', imports, heads).forEach(line => {
    text.push(`      ${line}`)
  })

  text.push(`    hook false`)
  makeTypeAnnotation(name, node.falseType, 'like', imports, heads).forEach(line => {
    text.push(`      ${line}`)
  })

  return text
}

function makePredicate(name, node, type, imports, heads) {
  imports['native-boolean'] = true
  const text = [`free seed, like native-boolean`]
  switch (node.parameterName.type) {
    case 'TSThisType':
      text.push(`rank self`)
      break
    case 'Identifier':
      text.push(`rank ${node.parameterName.name}`)
      break
    default:
      throw new Error(`Unknown predicate on ${name}`)
  }

  if (node.typeAnnotation) {
    const like = makeTypeAnnotation(name, node.typeAnnotation.typeAnnotation, 'like', imports, heads)

    if (like.length === 1) {
      text[1] += `, ${like[0]}`
    } else {
      like.forEach(line => {
        text.push(`  ${line}`)
      })
    }
  }

  return text
}

function makeFunctionType(name, node, type = 'like', imports, heads) {
  const text = [`${type} task-link-text`]
  imports['task-link-text'] = `load @drumwork/seed/code/form/task\n  take form task\n    save form task-link-text`
  const functionHeads = { ...heads }
  const typeParams = (node.typeParameters ? makeTypeParameters(name, node.typeParameters, imports, functionHeads) : [])
  typeParams.forEach(line => {
    text.push(`  ${line}`)
  })
  makeFunctionParams(name, node, imports, functionHeads).forEach(line => {
    text.push(`  ${line}`)
  })
  const returnType = makeTypeAnnotation(name, node.typeAnnotation?.typeAnnotation ?? node.typeAnnotation, `like`, imports, functionHeads)
  let x = [`  free seed`]
  if (returnType.length === 1) {
    x[0] += `, ${returnType[0]}`
  } else {
    returnType.forEach(line => {
      x.push(`    ${line}`)
    })
  }
  text.push(...x)
  return text
}

function makeFunctionParams(name, node, imports, heads) {
  const text = []
  ;(node.parameters ?? node.params).forEach(node => {
    switch (node.type) {
      case 'Identifier':
        text.push(...makeIdentifier(name, node, 'take', imports, heads))
        break
      case 'RestElement':
        text.push(...makeRestElement(name, node, imports, heads))
        break
      default:
        console.log(node)
        throw new Error(`Unknown function param on ${name}`)
    }
  })
  return text
}

function makeRestElement(name, node, imports, heads) {
  const text = []
  switch (node.argument.type) {
    case 'Identifier':
      text.push(`take ${makeName(node.argument.name)}`)
      break
    default:
      console.log(node)
      throw new Error(`Unknown rest arg type on ${name}`)
  }
  const tsType = node.typeAnnotation.typeAnnotation
  const like = makeTypeAnnotation(name, tsType, 'like', imports, heads)

  if (like.length === 1) {
    text[0] += `, ${like[0]}`
  } else {
    like.forEach(line => {
      text.push(`  ${line}`)
    })
  }

  text.push(`  rest true`)

  return text
}

function makeTypeParameters(name, node, imports, heads) {
  const text = []
  node.params.forEach(tsTypeParam => {
    imports['like-link-text'] = `load @drumwork/seed/code/form/like\n  take form like\n    save form like-link-text`
    heads[makeName(tsTypeParam.name)] = true
    text.push(`head ${makeName(tsTypeParam.name)}, like like-link-text`)
    if (tsTypeParam.constraint) {
      makeTypeAnnotation(name, tsTypeParam.constraint, 'base', imports, heads).forEach(line => {
        text.push(`  ${line}`)
      })
    }
    if (tsTypeParam.default) {
      makeTypeAnnotation(name, tsTypeParam.default, 'back', imports, heads).forEach(line => {
        text.push(`  ${line}`)
      })
    }
  })
  return text
}

function makeName(text) {
  return paramCase(text.replace(/google[\.\/\-]maps[\.\/\-]?/ig, ''))
}
