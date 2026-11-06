import path from 'path'
import { defineConfig } from '@tarojs/cli'
import devConfig from './dev'
import prodConfig from './prod'

export default defineConfig(async (merge) => {
  // Sub-path deployments (GitHub Pages project sites, CDN prefixes) need the
  // asset public path and the router basename to agree, otherwise lazy chunks
  // and deep links both 404.
  const rawH5Base = process.env.TARO_APP_H5_BASE || '/'
  const h5Base = rawH5Base.endsWith('/') ? rawH5Base : `${rawH5Base}/`
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
      // Needed at runtime for the PWA worker scope: a relative manifest link
      // would resolve against the SPA's current URL after pushState.
      __H5_BASE__: JSON.stringify(h5Base),
    },
    alias: {
      '@': path.resolve(__dirname, '..', 'src'),
    },
    copy: {
      patterns: [
        // PWA shell: manifest, service worker and icons live next to
        // index.html in the output so their relative URLs keep working on a
        // sub-path deployment (GitHub Pages project sites).
        { from: 'src/pwa/', to: 'dist/' },
      ],
      options: {},
    },
    framework: 'react',
    compiler: {
      type: 'webpack5',
      prebundle: { enable: false },
    },
    // Taro's default terser config sets quote_keys + keep_quoted_props, which
    // mangles ES class private fields (#name) into invalid `#"name"` tokens in
    // production bundles. Keep the defaults otherwise, but leave quoted keys
    // alone so modern class syntax survives minification.
    terser: {
      enable: true,
      config: {
        output: {
          comments: false,
          keep_quoted_props: false,
          quote_keys: false,
          beautify: false,
        },
      },
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
        // Taro's basename is a prefix, not a full public path: passing "/"
        // makes the router unable to match the home route. Only set it for
        // real sub-path deployments, and without the trailing slash.
        ...(h5Base !== '/' ? { basename: h5Base.replace(/\/$/, '') } : {}),
      },
    },
  }

  if (process.env.NODE_ENV === 'development') {
    return merge({}, baseConfig, devConfig)
  }
  return merge({}, baseConfig, prodConfig)
})
