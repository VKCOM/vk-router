import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';
import resolve from '@rollup/plugin-node-resolve';
export default {
  input: './src/index.ts',
  output: {
    dir: './dist', 
    format: 'cjs', 
  },
  plugins: [ 
    resolve(),
    typescript(),
    terser(),
  ], 
  external: ['react', 'react-dom', 'router5'],
}