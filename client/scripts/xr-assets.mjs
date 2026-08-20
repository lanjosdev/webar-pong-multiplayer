import { createHash } from 'node:crypto'
import { cp, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const clientRoot = resolve(import.meta.dirname, '..')
const engineEntry = require.resolve('@8thwall/engine-binary')
const sourceRoot = join(dirname(engineEntry), 'dist')
const publicRoot = join(clientRoot, 'public', 'external', 'xr')
const buildRoot = join(clientRoot, 'dist', 'external', 'xr')
const requiredFiles = ['LICENSE', 'xr.js', 'xr-slam.js', 'resources/powered-by.svg']

async function listFiles(root) {
  const files = []

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true })
    entries.sort((left, right) => left.name.localeCompare(right.name))

    for (const entry of entries) {
      const absolutePath = join(directory, entry.name)
      if (entry.isDirectory()) {
        await visit(absolutePath)
      } else if (entry.isFile()) {
        files.push(relative(root, absolutePath).replaceAll('\\', '/'))
      }
    }
  }

  await visit(root)
  return files
}

async function assertRequiredFiles(root) {
  for (const file of requiredFiles) {
    const fileStats = await stat(join(root, file))
    if (!fileStats.isFile()) {
      throw new Error(`Required XR Engine artifact is not a file: ${file}`)
    }
  }
}

async function digest(file) {
  const contents = await readFile(file)
  return createHash('sha256').update(contents).digest('hex')
}

async function verifyTrees(expectedRoot, actualRoot) {
  await assertRequiredFiles(actualRoot)

  const expectedFiles = await listFiles(expectedRoot)
  const actualFiles = await listFiles(actualRoot)

  if (JSON.stringify(expectedFiles) !== JSON.stringify(actualFiles)) {
    throw new Error('XR Engine artifact inventory differs from the installed package')
  }

  for (const file of expectedFiles) {
    const [expectedDigest, actualDigest] = await Promise.all([
      digest(join(expectedRoot, file)),
      digest(join(actualRoot, file)),
    ])

    if (expectedDigest !== actualDigest) {
      throw new Error(`XR Engine artifact was modified while copying: ${file}`)
    }
  }

  return expectedFiles.length
}

async function syncAssets() {
  await assertRequiredFiles(sourceRoot)
  await rm(publicRoot, { recursive: true, force: true })
  await mkdir(dirname(publicRoot), { recursive: true })
  await cp(sourceRoot, publicRoot, { recursive: true, force: true, verbatimSymlinks: true })
  const fileCount = await verifyTrees(sourceRoot, publicRoot)
  console.log(`Copied ${fileCount} original XR Engine artifacts to public/external/xr`)
}

async function verifyBuild() {
  const fileCount = await verifyTrees(sourceRoot, buildRoot)
  console.log(`Verified ${fileCount} byte-identical XR Engine artifacts in dist/external/xr`)
}

const command = process.argv[2]

if (command === 'sync') {
  await syncAssets()
} else if (command === 'verify-dist') {
  await verifyBuild()
} else {
  throw new Error('Usage: node scripts/xr-assets.mjs <sync|verify-dist>')
}
