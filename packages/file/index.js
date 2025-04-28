import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import * as zlib from 'node:zlib'
import { SizeLimitError } from 'size-limit'

async function sum(array, fn) {
  return (await Promise.all(array.map(fn))).reduce((all, i) => all + i, 0)
}

function promiseSize(path, destination) {
  return new Promise((resolve, reject) => {
    let size = 0
    let pipe = createReadStream(path).pipe(destination)
    pipe.on('error', reject)
    pipe.on('data', buf => {
      size += buf.length
    })
    pipe.on('end', () => {
      resolve(size)
    })
  })
}

function brotliSize(path) {
  return promiseSize(
    path,
    zlib.createBrotliCompress({
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 11
      }
    })
  )
}

function gzipSize(path) {
  return promiseSize(path, zlib.createGzip({ level: 9 }))
}

function zstdSize(path) {
  /* c8 ignore next 3 */
  if (!Object.hasOwn(zlib, 'createZstdCompress')) {
    throw new SizeLimitError('unsupportZstd') // Remove after drop support Node.js v22
  }

  return promiseSize(
    path,
    zlib.createZstdCompress({
      params: {
        [zlib.constants.ZSTD_c_compressionLevel]: 22
      }
    })
  )
}

export default [
  {
    name: '@size-limit/file',
    async step60(_config, check) {
      let files = check.bundles || check.files

      if (check.gzip === true) {
        check.size = await sum(files, async i => gzipSize(i))
      } else if (check.zstd === true) {
        check.size = await sum(files, async i => zstdSize(i))
      } else if (check.brotli === false) {
        check.size = await sum(files, async i => (await stat(i)).size)
      } else {
        check.size = await sum(files, async i => brotliSize(i))
      }
    }
  }
]
