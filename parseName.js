
const fs = require('fs')
const to = require('to-case')
const mkdirp = require('mkdirp')
const babel = require('@babel/parser')

const code = fs.readFileSync('example.ts', 'utf-8')

const ast = babel.parse(code, {
  sourceType: 'module',
  strictMode: false,
  plugins: ['classProperties', 'typescript'],
})

ast.program.body.forEach(node => {
  switch (node.type) {
    case 'TSInterfaceDeclaration':
      makeInterface(node)
      break
    case 'TSModuleDeclaration':
      makeModule(node)
      break
    case 'VariableDeclaration':
      makeVariable(node)
      break
    case 'TSDeclareFunction':
      break
    case 'TSTypeAliasDeclaration':
      break
    default:
      console.log(node)
      throw new Error(`Unknown program type`)
  }
})

function cleanText(text) {
  return text.replace(/\n\n+/g, '\n\n')
}

function makeModule(node) {
  const text = []
  return text
}

function makeVariable(node) {
  const text = []
  return text
}

function makeTypeExtends(name, node) {
  const text = []
  node.extends.forEach(node => {
    switch (node.type) {
      case 'TSExpressionWithTypeArguments':
        switch (node.expression.type) {
          case 'Identifier':
            // text.push(`base ${makeName(node.expression.name)}, text <${node.expression.name}>`)
            break
          default:
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

function makeInterface(node) {
  const typeName = node.id.name

  const text = [`form ${makeName(typeName)}, text <${typeName}>`]
  let hasLink = false
  const has = {}

  let bases = node.extends ? makeTypeExtends(typeName, node) : []

  bases.forEach(line => {
    text.push(`  ${line}`)
  })

  if (bases.length) {
    text.push(``)
  }

  node.body.body.forEach(node => {
    switch (node.type) {
      case 'TSPropertySignature':
        makeProperty(node)
        hasLink = true
        break
    }
  })

  if (hasLink) {
    text.push('')
  }

  let hasMethods = false

  node.body.body.forEach(node => {
    switch (node.type) {
      case 'TSMethodSignature':
        makeMethod(node)
        hasMethods = true
        break
    }
  })

  if (hasMethods) {
    text.push('')
  }

  node.body.body.forEach(node => {
    switch (node.type) {
      case 'TSIndexSignature':
        break
      case 'TSConstructSignatureDeclaration':
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

  const finalImportText = ['']
  finalImportText.push(`load @drumwork/land/code/javascript/form/${makeName(typeName)}\n  take form ${makeName(typeName)}`)
  finalImportText.push('')

  mkdirp.sync(`tmp/name/${makeName(typeName)}`)
  fs.writeFileSync(`tmp/name/${makeName(typeName)}/base.link`, finalImportText.join('\n') + '\n' + cleanText(text.join('\n')))

  function makeProperty(node) {
    const t = []
    const name = node.key.name
    if (has[name]) return
    has[name] = true
    t.push(`  link ${makeName(name)}, text <${name}>`)
    text.push(...t)
  }

  function makeMethod(node) {
    const name = node.key.name
    if (has[name]) return
    has[name] = true
    text.push(`  task ${makeName(name)}, text <${name}>`)
  }
}

function makeName(text) {
  return to.slug(text.replace('URI', 'Uri'))
}
