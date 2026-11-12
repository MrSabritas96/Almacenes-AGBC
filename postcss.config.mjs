import path from "node:path";
const config = {
  plugins: {
    [path.resolve("scripts/postcss-strip-charset.cjs")]: {},
    "@tailwindcss/postcss": {},
  },
};
export default config;
