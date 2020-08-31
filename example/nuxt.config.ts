import 'reflect-metadata';
import { resolve } from 'path';
import { NuxtIocModule } from '~/../../';

module.exports = {
  mode: 'universal',
  buildModules: ['@nuxt/typescript-build'],
  render: {
    bundleRenderer: {
      runInNewContext: false,
    },
  },
  rootDir: resolve(__dirname, '..'),
  buildDir: resolve(__dirname, '.nuxt'),
  srcDir: __dirname,
  router: {
    middleware: [],
  },
  modules: [{ handler: NuxtIocModule }],
};