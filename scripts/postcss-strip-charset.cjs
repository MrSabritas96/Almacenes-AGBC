/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');

// Conserva la capa de AdminLTE, eliminando su @charset antes de procesar imports.
module.exports = () => ({
  postcssPlugin: 'adminlte-layer',
  Once(root, { postcss }) {
    root.walkAtRules('import', rule => {
      if (rule.params !== '"admin-lte/dist/css/adminlte.css" layer(adminlte)') return;
      const filename = require.resolve('admin-lte/dist/css/adminlte.css');
      const styles = postcss.parse(fs.readFileSync(filename, 'utf8'), { from: filename });
      styles.walkAtRules('charset', charset => charset.remove());
      const layer = postcss.atRule({ name: 'layer', params: 'adminlte' });
      layer.append(styles.nodes);
      rule.replaceWith(layer);
    });
  },
});
module.exports.postcss = true;
