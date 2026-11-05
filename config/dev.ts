import type { UserConfigExport } from '@tarojs/cli'

export default {
  logger: {
    quiet: false,
    stats: true,
  },
  mini: {},
  h5: {
    devServer: {
      proxy: {
        '/auth': {
          target: 'https://multica.wnbgj.com',
          changeOrigin: true,
          secure: false,
        },
        '/api': {
          target: 'https://multica.wnbgj.com',
          changeOrigin: true,
          secure: false,
        },
        '/v1': {
          target: 'https://multica.wnbgj.com',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  },
} satisfies UserConfigExport
