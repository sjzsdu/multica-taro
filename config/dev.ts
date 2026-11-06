import type { UserConfigExport } from '@tarojs/cli'

export default {
  logger: {
    quiet: false,
    stats: true,
  },
  mini: {},
  h5: {
    devServer: {
      // webpack-dev-server's own HMR/live-reload socket also lives at /ws,
      // which would swallow the proxied Multica socket. Taro already runs this
      // dev server with HMR disabled, so trading live reload for a working
      // /ws proxy keeps realtime testable in development.
      webSocketServer: false,
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
        '/ws': {
          target: 'https://multica.wnbgj.com',
          // Keep the original Host: the backend's WS origin check accepts an
          // Origin whose host equals r.Host, so the browser's
          // http://localhost:10086 Origin must reach it unchanged.
          changeOrigin: false,
          secure: false,
          ws: true,
        },
      },
    },
  },
} satisfies UserConfigExport
