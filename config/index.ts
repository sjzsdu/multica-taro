import path from 'path'
import { defineConfig } from '@tarojs/cli'
import devConfig from './dev'
import prodConfig from './prod'

export default defineConfig(async (merge) => {
  // Sub-path deployments (GitHub Pages project sites, CDN prefixes) need the
  // asset public path and the router basename to agree, otherwise lazy chunks
  // and deep links both 404.
  const h5Base = process.env.TARO_APP_H5_BASE || '/'
  const baseConfig = {
    projectName: 'multica-taro',
    date: '2026-11-05',
    designWidth: 375,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      375: 2,
      828: 1.81 / 2,
    },
    sourceRoot: 'src',
    outputRoot: 'dist',
    plugins: [],
    defineConstants: {
      // H5 serves from the same origin and relies on a reverse proxy for
      // /api and /auth; native builds must point at an absolute origin.
      __API_BASE_URL__: JSON.stringify(process.env.TARO_APP_API_BASE || ''),
    },
    alias: {
      '@': path.resolve(__dirname, '..', 'src'),
    },
    copy: {
      patterns: [],
      options: {},
    },
    framework: 'react',
    compiler: {
      type: 'webpack5',
      prebundle: { enable: false },
    },
    mini: {
      postcss: {
        pxtransform: {
          enable: true,
          config: {},
        },
        cssModules: {
          enable: true,
          config: {
            namingPattern: 'module',
            generateScopedName: '[name]__[local]___[hash:base64:5]',
          },
        },
      },
    },
    h5: {
      publicPath: h5Base,
      staticDirectory: 'static',
      html: {
        template: path.resolve(__dirname, '..', 'src/index.html'),
      },
      postcss: {
        autoprefixer: {
          enable: true,
          config: {},
        },
        cssModules: {
          enable: true,
          config: {
            namingPattern: 'module',
            generateScopedName: '[name]__[local]___[hash:base64:5]',
          },
        },
      },
      router: {
        mode: 'browser',
        basename: h5Base,
      },
    },
  }

  if (process.env.NODE_ENV === 'development') {
    return merge({}, baseConfig, devConfig)
  }
  return merge({}, baseConfig, prodConfig)
})
